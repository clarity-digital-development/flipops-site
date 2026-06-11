/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M2.3 — Populate the ParcelFeature silver mart (model-ready features).
//
//   DATABASE_URL=... npx tsx scripts/ml/build-parcel-features.ts            # default metros
//   DATABASE_URL=... npx tsx scripts/ml/build-parcel-features.ts --county 12086,12011
//   ... --chunk-size 150000 --timeout-ms 300000 --dry-run
//
// One row per Parcel in the requested counties. Field semantics follow the
// column comments in prisma/schema.prisma (ParcelFeature):
//   - value ratios / sqft / lot / age / propertyType from Parcel
//   - ownerOccupied from the derive-owner-occupancy pass; absenteeOwner =
//     NOT ownerOccupied (mailing present); outOfStateOwner from the trailing
//     ", ST[, ZIP]" of ownerMailingAddress; corporateOwner via entity regex
//   - lastSalePrice / yearsSinceLastSale from latest ParcelSale, falling back
//     to the roll's SALE_PRC1 / SALE_YR1
//   - TAX_FAMILY from TaxDelinquencySummary (onset = Apr 1 of earliestYear+1,
//     FL Ch.197 statutory delinquency date)
//   - FORECLOSURE_FAMILY from AuctionSummary + earliest Foreclosure.filingDate
//     (fallback firstCapturedAt); auctionInDays = nextAuctionDate - today
//   - ZIP aggregates copied BY VALUE from ZipMarketStats (snapshot, not a
//     read-time join — run build-zip-market-stats.ts FIRST or they land NULL)
//
// Execution: per-county keyset pagination on apn, ~150K parcels per UPSERT
// statement (OPERATIONS.md landmine: the Railway proxy kills silent
// long-running statements — never one giant county-wide UPSERT). Each chunk
// runs in its own transaction with SET LOCAL statement_timeout +
// synchronous_commit=OFF. Idempotent: ON CONFLICT ("countyFips","apn").
//
// featureVersion = 1. Bump on ANY semantic change to a feature column and
// re-run — the exporter filters on featureVersion so a half-finished
// recompute never mixes semantics inside one training frame.
// ---------------------------------------------------------------------------

// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../lib/prisma";

const FEATURE_VERSION = 1;
const DEFAULT_COUNTIES = ["12086", "12011"]; // Miami-Dade + Broward — v1 training metros
const DEFAULT_CHUNK = 150_000;

// ownerName entity pattern → corporateOwner. \m/\M = PG word boundaries.
// Deliberately conservative: entity suffixes + institutional keywords only.
const CORPORATE_REGEX =
  "\\m(LLC|L L C|INC|CORP|CORPORATION|TRUST|TR|TRS|LTD|LP|LLP|LLLP|COMPANY|HOLDINGS|PROPERTIES|INVESTMENTS|ENTERPRISES|PARTNERS|PARTNERSHIP|ASSN|ASSOC|ASSOCIATION|CONDO|CONDOMINIUM|HOA|BANK|MORTGAGE|CHURCH|MINISTRIES|CITY OF|COUNTY OF|STATE OF|DEPT|AUTHORITY)\\M";

// Trailing "..., ST[, ZIP]" or "..., ST ZIP" of ownerMailingAddress (NAL
// format: "OWN_ADDR1[, OWN_ADDR2], OWN_CITY, OWN_STATE[, OWN_ZIPCD]").
// No match (foreign / malformed) → NULL = honest unknown.
const MAIL_STATE_SQL = `(regexp_match(UPPER(p."ownerMailingAddress"), ',\\s*([A-Z]{2})\\s*(?:,?\\s*[0-9]{5}(?:-?[0-9]{4})?)?\\s*$'))[1]`;

/** Keyset page bounds — $1=countyFips, $2=apnCursor, $3=chunkSize. */
const PAGE_BOUNDS_SQL = `
  SELECT MAX(apn) AS "pageEnd", COUNT(*)::int AS "pageCount"
  FROM (
    SELECT "apn" AS apn
    FROM flipops."Parcel"
    WHERE "countyFips" = $1 AND "apn" > $2
    ORDER BY "apn"
    LIMIT $3
  ) page
`;

/**
 * The per-chunk UPSERT. $1=countyFips, $2=apnCursor (exclusive), $3=pageEnd
 * (inclusive). Every joined subquery repeats the APN range so the planner
 * stays on the (countyFips, apn) indexes instead of county-wide aggregates.
 */
const UPSERT_SQL = `
  INSERT INTO flipops."ParcelFeature" (
    "id", "countyFips", "apn",
    "situsZip", "latitude", "longitude",
    "marketValue", "assessedValue", "assessedToMarketRatio", "landToMarketRatio", "valuePerSqft",
    "squareFeet", "lotSize", "ageYears", "propertyType",
    "ownerOccupied", "absenteeOwner", "outOfStateOwner", "corporateOwner",
    "lastSalePrice", "yearsSinceLastSale",
    "taxDelinquent", "taxDelinquencyAgeDays", "taxYearsCount", "taxTotalAmount",
    "foreclosureActive", "foreclosureAgeDays", "auctionScheduled", "auctionInDays",
    "zipMedianSalePrice", "zipPricePerSqft", "zipSaleVelocity12mo", "zipTrend12moPct",
    "featureVersion", "computedAt"
  )
  SELECT
    'pf_' || md5(p."countyFips" || ':' || p."apn")  AS id,  -- deterministic; kept on conflict
    p."countyFips",
    p."apn",
    p."situsZip",
    p."latitude",
    p."longitude",
    p."marketValue"::float,
    p."assessedValue"::float,
    CASE WHEN COALESCE(p."marketValue", 0) > 0
         THEN (p."assessedValue" / p."marketValue")::float END,
    CASE WHEN COALESCE(p."marketValue", 0) > 0
         THEN (p."landValue" / p."marketValue")::float END,
    CASE WHEN COALESCE(p."squareFeet", 0) > 0
         THEN (p."marketValue" / p."squareFeet")::float END,
    p."squareFeet",
    p."lotSize"::float,
    CASE WHEN p."yearBuilt" IS NOT NULL AND p."yearBuilt" > 1600
         THEN EXTRACT(YEAR FROM NOW())::int - p."yearBuilt" END,
    p."propertyType",
    p."ownerOccupied",
    CASE WHEN p."ownerOccupied" IS NULL THEN NULL
         ELSE (p."ownerOccupied" IS FALSE AND p."ownerMailingAddress" IS NOT NULL) END,
    CASE WHEN ${MAIL_STATE_SQL} IS NULL THEN NULL
         ELSE (${MAIL_STATE_SQL} <> 'FL') END,
    CASE WHEN p."ownerName" IS NULL THEN NULL
         ELSE UPPER(p."ownerName") ~ '${CORPORATE_REGEX}' END,
    COALESCE(ls.last_price, p."lastSalePrice")::float,
    CASE
      WHEN ls.last_date IS NOT NULL
        THEN ((NOW()::date - ls.last_date::date) / 365.25)::float
      WHEN p."lastSaleYear" IS NOT NULL AND p."lastSaleYear" > 1600
        THEN (EXTRACT(YEAR FROM NOW())::int - p."lastSaleYear")::float
    END,
    (t."apn" IS NOT NULL),
    CASE WHEN t."apn" IS NOT NULL
         THEN (NOW()::date - make_date(t."earliestYear" + 1, 4, 1)) END,
    t."yearsCount",
    t."totalAmount"::float,
    (a."apn" IS NOT NULL),
    CASE WHEN a."apn" IS NOT NULL
         THEN (NOW()::date - COALESCE(f.first_filing, a."firstCapturedAt")::date) END,
    (a."nextAuctionDate" IS NOT NULL),
    CASE WHEN a."nextAuctionDate" IS NOT NULL
         THEN (a."nextAuctionDate"::date - NOW()::date) END,
    z."medianSalePrice",
    z."pricePerSqft",
    z."saleVelocity12mo",
    z."trend12moPct",
    ${FEATURE_VERSION},
    NOW()
  FROM flipops."Parcel" p
  LEFT JOIN (
    SELECT "countyFips", "apn",
           (array_agg("salePrice" ORDER BY "saleDate" DESC))[1] AS last_price,
           MAX("saleDate")                                      AS last_date
    FROM flipops."ParcelSale"
    WHERE "countyFips" = $1 AND "apn" > $2 AND "apn" <= $3 AND "saleDate" IS NOT NULL
    GROUP BY 1, 2
  ) ls ON ls."countyFips" = p."countyFips" AND ls."apn" = p."apn"
  LEFT JOIN flipops."TaxDelinquencySummary" t
    ON t."countyFips" = p."countyFips" AND t."apn" = p."apn"
  LEFT JOIN flipops."AuctionSummary" a
    ON a."countyFips" = p."countyFips" AND a."apn" = p."apn"
  LEFT JOIN (
    SELECT "countyFips", "apn", MIN("filingDate") AS first_filing
    FROM flipops."Foreclosure"
    WHERE "countyFips" = $1 AND "apn" IS NOT NULL AND "apn" > $2 AND "apn" <= $3
    GROUP BY 1, 2
  ) f ON f."countyFips" = p."countyFips" AND f."apn" = p."apn"
  LEFT JOIN flipops."ZipMarketStats" z ON z."zip" = p."situsZip"
  WHERE p."countyFips" = $1 AND p."apn" > $2 AND p."apn" <= $3
  ON CONFLICT ("countyFips", "apn") DO UPDATE SET
    "situsZip"              = EXCLUDED."situsZip",
    "latitude"              = EXCLUDED."latitude",
    "longitude"             = EXCLUDED."longitude",
    "marketValue"           = EXCLUDED."marketValue",
    "assessedValue"         = EXCLUDED."assessedValue",
    "assessedToMarketRatio" = EXCLUDED."assessedToMarketRatio",
    "landToMarketRatio"     = EXCLUDED."landToMarketRatio",
    "valuePerSqft"          = EXCLUDED."valuePerSqft",
    "squareFeet"            = EXCLUDED."squareFeet",
    "lotSize"               = EXCLUDED."lotSize",
    "ageYears"              = EXCLUDED."ageYears",
    "propertyType"          = EXCLUDED."propertyType",
    "ownerOccupied"         = EXCLUDED."ownerOccupied",
    "absenteeOwner"         = EXCLUDED."absenteeOwner",
    "outOfStateOwner"       = EXCLUDED."outOfStateOwner",
    "corporateOwner"        = EXCLUDED."corporateOwner",
    "lastSalePrice"         = EXCLUDED."lastSalePrice",
    "yearsSinceLastSale"    = EXCLUDED."yearsSinceLastSale",
    "taxDelinquent"         = EXCLUDED."taxDelinquent",
    "taxDelinquencyAgeDays" = EXCLUDED."taxDelinquencyAgeDays",
    "taxYearsCount"         = EXCLUDED."taxYearsCount",
    "taxTotalAmount"        = EXCLUDED."taxTotalAmount",
    "foreclosureActive"     = EXCLUDED."foreclosureActive",
    "foreclosureAgeDays"    = EXCLUDED."foreclosureAgeDays",
    "auctionScheduled"      = EXCLUDED."auctionScheduled",
    "auctionInDays"         = EXCLUDED."auctionInDays",
    "zipMedianSalePrice"    = EXCLUDED."zipMedianSalePrice",
    "zipPricePerSqft"       = EXCLUDED."zipPricePerSqft",
    "zipSaleVelocity12mo"   = EXCLUDED."zipSaleVelocity12mo",
    "zipTrend12moPct"       = EXCLUDED."zipTrend12moPct",
    "featureVersion"        = EXCLUDED."featureVersion",
    "computedAt"            = NOW()
`;

interface CountyResult {
  fips: string;
  upserted: number;
  chunks: number;
  durationMs: number;
}

async function buildCounty(
  fips: string,
  opts: { chunkSize: number; timeoutMs: number; dryRun: boolean },
): Promise<CountyResult> {
  const start = Date.now();
  let cursor = "";
  let upserted = 0;
  let chunks = 0;

  for (;;) {
    const [bounds] = await prisma.$queryRawUnsafe<
      Array<{ pageEnd: string | null; pageCount: number }>
    >(PAGE_BOUNDS_SQL, fips, cursor, opts.chunkSize);
    if (!bounds || bounds.pageCount === 0 || bounds.pageEnd === null) break;

    if (opts.dryRun) {
      upserted += bounds.pageCount;
    } else {
      const n = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${opts.timeoutMs}`);
          await tx.$executeRawUnsafe(`SET LOCAL synchronous_commit = OFF`);
          return tx.$executeRawUnsafe(UPSERT_SQL, fips, cursor, bounds.pageEnd);
        },
        // Prisma interactive-transaction default is 5s — set explicitly
        // (OPERATIONS.md / F1 BulkIngester lesson).
        { timeout: opts.timeoutMs + 60_000 },
      );
      upserted += n;
    }
    chunks += 1;
    cursor = bounds.pageEnd;
    console.log(
      `  [${fips}] chunk ${chunks}: ${opts.dryRun ? "would upsert" : "+"}${bounds.pageCount.toLocaleString()} ` +
        `(total ${upserted.toLocaleString()}) cursor=${cursor}`,
    );
  }
  return { fips, upserted, chunks, durationMs: Date.now() - start };
}

function parseArgs(argv: string[]) {
  const opts = {
    counties: [...DEFAULT_COUNTIES],
    chunkSize: DEFAULT_CHUNK,
    timeoutMs: 300_000,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--county" || a === "--counties") {
      opts.counties = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/[^0-9]/g, ""))
        .filter((s) => /^\d{5}$/.test(s));
      if (opts.counties.length === 0) {
        console.error("--county requires a comma-list of 5-digit FIPS codes");
        process.exit(1);
      }
    } else if (a === "--chunk-size") opts.chunkSize = Number(argv[++i]) || DEFAULT_CHUNK;
    else if (a === "--timeout-ms") opts.timeoutMs = Number(argv[++i]) || 300_000;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `[parcel-features] counties=${opts.counties.join(",")} chunk=${opts.chunkSize} ` +
      `featureVersion=${FEATURE_VERSION}${opts.dryRun ? " [DRY RUN]" : ""}`,
  );

  // ZIP snapshot dependency check — warn loudly instead of silently writing
  // an all-NULL zip block (schema decision #1: copied by value at compute time).
  const [zms] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM flipops."ZipMarketStats"`,
  );
  if (zms.n === 0) {
    console.warn(
      "[parcel-features] WARNING: ZipMarketStats is EMPTY — zip aggregate columns will be NULL. " +
        "Run scripts/ml/build-zip-market-stats.ts first.",
    );
  }

  let total = 0;
  for (const fips of opts.counties) {
    const r = await buildCounty(fips, opts);
    total += r.upserted;
    console.log(
      `[parcel-features] ${fips}: ${r.upserted.toLocaleString()} rows in ${r.chunks} chunks ` +
        `(${(r.durationMs / 1000).toFixed(1)}s)`,
    );
  }
  console.log(`[parcel-features] done: ${total.toLocaleString()} rows ${opts.dryRun ? "(dry run)" : "upserted"}`);

  if (!opts.dryRun) {
    const [agg] = await prisma.$queryRawUnsafe<
      Array<{
        n: number;
        tax: number;
        fc: number;
        zip_cov: number;
        corp: number;
        oos: number;
      }>
    >(`
      SELECT COUNT(*)::int AS n,
             COUNT(*) FILTER (WHERE "taxDelinquent")::int          AS tax,
             COUNT(*) FILTER (WHERE "foreclosureActive")::int      AS fc,
             COUNT(*) FILTER (WHERE "zipMedianSalePrice" IS NOT NULL)::int AS zip_cov,
             COUNT(*) FILTER (WHERE "corporateOwner")::int         AS corp,
             COUNT(*) FILTER (WHERE "outOfStateOwner")::int        AS oos
      FROM flipops."ParcelFeature"
      WHERE "countyFips" IN (${opts.counties.map((c) => `'${c}'`).join(",")})
    `);
    console.log(
      `[parcel-features] verify: ${agg.n.toLocaleString()} rows · taxDelinquent=${agg.tax.toLocaleString()} ` +
        `· foreclosureActive=${agg.fc} · zipCoverage=${agg.zip_cov.toLocaleString()} ` +
        `· corporate=${agg.corp.toLocaleString()} · outOfState=${agg.oos.toLocaleString()}`,
    );
  }
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
