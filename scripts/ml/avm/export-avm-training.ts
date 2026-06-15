/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M3.3 AVM v1 — Export the AVM (price-regression) training frame to CSV.
//
//   DATABASE_URL=... npx tsx scripts/ml/avm/export-avm-training.ts \
//     --metros 12086,12011 --out scripts/ml/avm/out/avm-frame.csv
//
// FRAME DEFINITION (SCORING-ARCHITECTURE; one regression model, NOT a hazard):
//   One row per ARMS-LENGTH ParcelSale (qualCode IN ('01','02') — same filter
//   as /api/comps ARMS_LENGTH_QUAL_CODES) in the requested metros, joined to
//   ParcelFeature (frozen parcel characteristics + ZIP aggregates — the M2.3
//   silver mart; no train/serve skew) plus two computed features:
//     * distance-weighted neighborhood comp $/sqft (other arms-length sales in
//       the same ZIP within ±90 days of THIS sale, inverse-distance weighted by
//       lat/lng when present; falls back to ZIP-level when coords absent) — the
//       single strongest AVM signal, kept LEAKAGE-SAFE by excluding the subject
//       sale itself and only using same-ZIP neighbors.
//     * sale-month seasonality (saleMonth 1..12 as a categorical).
//   Target = log(salePrice). LightGBM trains on log to tame the heavy right
//   tail; train_avm.py exponentiates for APE eval and serving.
//
//   ARMS-LENGTH: qualCode 01 (qualified) dominates (~80% of $10k+ sales in
//   Miami-Dade, median ~$560k). 02 included to match the comps endpoint. Codes
//   05/11/18/30/37 etc. are non-arms-length (estate, related-party, partial
//   interest) — excluded so the model learns true market value.
//
//   DATA REALITY (verified 2026-06-11): ParcelSale spans 2024-01 → 2025-12 for
//   12086/12011 (~58k arms-length sales each that join a ParcelFeature row).
//   This is a ~2yr window — fine for a cross-sectional AVM (no long history
//   needed, unlike the propensity hazard). It DEEPENS materially when OPS-7
//   SDF history backfills pre-2024 sales (see README "expected improvement").
//
// Features are read almost entirely from ParcelFeature (already populated for
// 12086 + 12011 — 754k Broward + 933k Miami-Dade rows). The neighborhood-comp
// CTE is the only per-sale compute. Typed against raw SQL ($queryRawUnsafe) by
// design — compiles BEFORE the schema.patch.avm.prisma model lands (no
// generated-model imports for ParcelValuation). Keyset-paginated per county on
// the sale id (Railway proxy kills silent long statements — OPERATIONS.md
// landmine — so no statewide mega-query).
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../../lib/prisma";

// Keep in sync with /api/comps ARMS_LENGTH_QUAL_CODES and the comp CTE below.
const ARMS_LENGTH_QUAL_CODES = ["01", "02"];
// Min plausible market sale; filters out $0/nominal transfers that slip the
// qualCode net. Matches the $10k floor used elsewhere but bumped to $20k for a
// value model (a $10k "sale" is almost never a real market price).
const SALE_FLOOR = 20_000;

/** One exported frame row. Mirrors the SELECT list — update both together. */
interface AvmFrameRow {
  countyFips: string;
  apn: string;
  saleId: string;
  saleDate: Date | null;
  // -- Target --
  salePrice: number; // raw dollars; train_avm.py takes log()
  // -- Parcel characteristics (from ParcelFeature) --
  squareFeet: number | null;
  lotSize: number | null;
  ageYears: number | null;
  // -- Phase 0: additional NAL building fields (LEFT JOIN Parcel) --
  effectiveAgeYears: number | null;   // saleYear - EFF_YR_BLT (renovation-aware age)
  improvementQuality: number | null;  // IMP_QUAL 1-6 (condition proxy)
  specialFeatureValue: number | null; // SPEC_FEAT_VAL $ lump (pool/dock/extras)
  numResUnits: number | null;         // NO_RES_UNTS
  propertyType: string | null; // categorical
  ownerOccupied: boolean | null;
  outOfStateOwner: boolean | null;
  // -- Location --
  situsZip: string | null; // categorical
  latitude: number | null;
  longitude: number | null;
  // -- ZIP aggregates (frozen on ParcelFeature) --
  zipMedianSalePrice: number | null;
  zipPricePerSqft: number | null;
  zipSaleVelocity12mo: number | null;
  zipTrend12moPct: number | null;
  // -- Computed: distance-weighted neighborhood comp $/sqft --
  neighborhoodPricePerSqft: number | null;
  neighborhoodCompCount: number | null;
  // -- Seasonality --
  saleMonth: number | null; // 1..12 categorical
  // -- Baseline reference (assessed-ratio floor; NOT a model feature) --
  assessedValue: number | null;
  marketValue: number | null;
}

interface ExportOpts {
  metros: string[];
  out: string;
  batchSize: number; // sale rows per keyset page
  limit?: number;
  // AVM v2 (temporal retrain): lower bound on saleDate (YYYY-MM-DD). Restricts
  // the frame to a recent window so (a) export volume stays tractable and (b)
  // the HPI time-adjustment factors stay reliable (deep post-crash sales need
  // 2-3x adjustment and shift composition). Undefined → full history (v1 behavior).
  since?: string;
  // AVM v2: trailing comp window in MONTHS (comps strictly before each subject
  // sale). Opt-in leakage-safe + serving-direction-matched replacement for the
  // legacy ±90d symmetric window. Undefined → legacy ±90d (v1 behavior).
  compMonths?: number;
}

const CSV_COLUMNS: (keyof AvmFrameRow)[] = [
  "countyFips",
  "apn",
  "saleId",
  "saleDate",
  "salePrice",
  "squareFeet",
  "lotSize",
  "ageYears",
  "effectiveAgeYears",
  "improvementQuality",
  "specialFeatureValue",
  "numResUnits",
  "propertyType",
  "ownerOccupied",
  "outOfStateOwner",
  "situsZip",
  "latitude",
  "longitude",
  "zipMedianSalePrice",
  "zipPricePerSqft",
  "zipSaleVelocity12mo",
  "zipTrend12moPct",
  "neighborhoodPricePerSqft",
  "neighborhoodCompCount",
  "saleMonth",
  "assessedValue",
  "marketValue",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// SQL list literal for the qualCode IN (...) clause. Codes are a fixed
// allowlist (never user input) so inlining is safe and keeps the bound-var
// count down (PG 32767 cap — OPERATIONS.md).
const QUAL_IN = ARMS_LENGTH_QUAL_CODES.map((c) => `'${c}'`).join(", ");

// Validated, inlined saleDate floor for the subject-sale window (--since).
// `since` is regex-checked to YYYY-MM-DD in parseArgs before it ever reaches
// here, so inlining (like QUAL_IN / SALE_FLOOR) is safe and keeps the bound-var
// count down (PG 32767 cap — OPERATIONS.md).
function subjectSinceClause(since?: string): string {
  return since ? `AND s."saleDate" >= '${since}'::date` : "";
}
// The comp pool floor sits BELOW --since by the comp lookback so the earliest
// subject sales in the window still find their full comp set. Legacy (±90d
// symmetric) needs 90d below; trailing --comp-months N needs N months below.
function compSinceClause(since?: string, compMonths?: number): string {
  if (!since) return "";
  const below =
    compMonths && compMonths > 0
      ? `interval '${compMonths} months'`
      : `interval '90 days'`;
  return `AND s."saleDate" >= ('${since}'::date - ${below})`;
}

// Per-subject neighborhood-comp date window for the lateral.
//  * Legacy (compMonths undefined): SYMMETRIC ±90d around the subject sale —
//    matches v1 exactly, but its look-AHEAD half leaks out-of-time holdout
//    sales into near-cutoff training rows' comp feature.
//  * Trailing (--comp-months N): comps STRICTLY BEFORE the subject sale, within
//    the prior N months. Leakage-safe (no future comp can enter a training
//    row) AND direction-matched to the serving exporter (export-predict-
//    features.ts trailing window), removing the train/serve direction skew.
function compWindowClause(compMonths?: number): string {
  if (compMonths && compMonths > 0) {
    return `AND c.sale_date >= pg."saleDate" - interval '${compMonths} months'
            AND c.sale_date <  pg."saleDate"`;
  }
  return `AND c.sale_date BETWEEN pg."saleDate" - interval '90 days'
                          AND pg."saleDate" + interval '90 days'`;
}

/**
 * Keyset page bounds on ParcelSale.id within a county's arms-length sales.
 * $1=countyFips, $2=idCursor ('' for first page), $3=batchSize.
 * Returns the page's max id so the cursor always advances even if some rows in
 * the page fail the downstream ParcelFeature join (advance-on-empty, like the
 * propensity exporter).
 */
function pageBoundsSql(since?: string): string {
  return `
  SELECT MAX(id) AS "pageEnd", COUNT(*)::int AS "pageCount"
  FROM (
    SELECT s.id
    FROM flipops."ParcelSale" s
    WHERE s."countyFips" = $1
      AND s."qualCode" IN (${QUAL_IN})
      AND COALESCE(s."salePrice", 0) >= ${SALE_FLOOR}
      ${subjectSinceClause(since)}
      AND s.id > $2
    ORDER BY s.id
    LIMIT $3
  ) page
`;
}

/**
 * Per-page frame query. $1=countyFips, $2=idCursor (exclusive), $3=pageEnd
 * (inclusive). The neighborhood-comp lateral subquery is the only per-sale
 * compute: for each subject sale it pulls OTHER same-ZIP arms-length sales
 * within ±90 days and ±2yr (price-comparable window), computes each neighbor's
 * $/sqft, and inverse-distance weights them when both have coords (else a flat
 * mean). Excludes the subject's own apn to prevent leakage.
 */
// PERFORMANCE: the neighborhood-comp signal needs, for each subject sale, the
// OTHER arms-length sales in the same ZIP within ±90 days. Computing that with a
// LATERAL that re-joins ParcelSale × ParcelFeature per subject is O(N × big-join)
// and measured ~1.5k rows / 3 min on Miami-Dade (≈4 hr full). Instead we
// MATERIALIZE the county's arms-length comp pool ONCE (county_comps CTE — a few
// ×10⁴ rows that fit in memory), then the LATERAL scans that small in-memory set.
// MATERIALIZED forces the CTE to be computed once, not inlined per reference.
// Throwaway, indexed staging table for the county's arms-length comp pool.
// Built ONCE per county (buildPoolDdl) instead of re-MATERIALIZED per keyset
// page — the index on (zip, sale_date) turns each subject's ±90d same-ZIP comp
// lookup from a 250k-row seq-scan into a fast index-range scan (the per-page
// re-materialize was ~159s/4k-row page → ~3h/county on the full history).
// Dropped in a finally; a transient scratch table, never a Prisma-managed model.
const POOL_TABLE = `flipops."_AvmCompPool"`;

/** DDL to (re)build + index the county comp pool. $1 = countyFips. */
function buildPoolDdl(since?: string, compMonths?: number): string[] {
  return [
    `DROP TABLE IF EXISTS ${POOL_TABLE}`,
    `CREATE TABLE ${POOL_TABLE} AS
       SELECT s."apn"        AS apn,
              s."saleDate"   AS sale_date,
              s."salePrice"  AS sale_price,
              cf."situsZip"  AS zip,
              cf."latitude"  AS lat,
              cf."longitude" AS lng,
              (s."salePrice" / NULLIF(cf."squareFeet", 0)) AS ppsf
       FROM flipops."ParcelSale" s
       JOIN flipops."ParcelFeature" cf
         ON cf."countyFips" = s."countyFips" AND cf."apn" = s."apn"
       WHERE s."countyFips" = $1
         AND s."qualCode" IN (${QUAL_IN})
         AND COALESCE(s."salePrice", 0) >= ${SALE_FLOOR}
         AND COALESCE(cf."squareFeet", 0) > 0
         AND s."saleDate" IS NOT NULL
         ${compSinceClause(since, compMonths)}
         AND cf."situsZip" IS NOT NULL`,
    `CREATE INDEX ON ${POOL_TABLE} (zip, sale_date)`,
    `ANALYZE ${POOL_TABLE}`,
  ];
}

function frameSql(since?: string, compMonths?: number): string {
  return `
WITH page AS (
  SELECT s.id AS sale_id, s."countyFips", s."apn", s."saleDate", s."salePrice",
         s."saleMonth"
  FROM flipops."ParcelSale" s
  WHERE s."countyFips" = $1
    AND s."qualCode" IN (${QUAL_IN})
    AND COALESCE(s."salePrice", 0) >= ${SALE_FLOOR}
    ${subjectSinceClause(since)}
    AND s.id > $2
    AND s.id <= $3
)
SELECT
  pg."countyFips"                          AS "countyFips",
  pg."apn"                                  AS "apn",
  pg.sale_id                               AS "saleId",
  pg."saleDate"::date                      AS "saleDate",
  pg."salePrice"::float                    AS "salePrice",
  f."squareFeet"::int                      AS "squareFeet",
  f."lotSize"::float                       AS "lotSize",
  f."ageYears"::int                        AS "ageYears",
  (CASE WHEN pcl."effectiveYearBuilt" BETWEEN 1800 AND 2100
        THEN EXTRACT(YEAR FROM pg."saleDate")::int - pcl."effectiveYearBuilt"
        ELSE NULL END)::int                  AS "effectiveAgeYears",
  pcl."improvementQuality"::int            AS "improvementQuality",
  pcl."specialFeatureValue"::float         AS "specialFeatureValue",
  pcl."numResUnits"::int                   AS "numResUnits",
  f."propertyType"                         AS "propertyType",
  f."ownerOccupied"                        AS "ownerOccupied",
  f."outOfStateOwner"                      AS "outOfStateOwner",
  f."situsZip"                             AS "situsZip",
  f."latitude"::float                      AS "latitude",
  f."longitude"::float                     AS "longitude",
  f."zipMedianSalePrice"::float            AS "zipMedianSalePrice",
  f."zipPricePerSqft"::float               AS "zipPricePerSqft",
  f."zipSaleVelocity12mo"::float           AS "zipSaleVelocity12mo",
  f."zipTrend12moPct"::float               AS "zipTrend12moPct",
  nb.nb_ppsf                               AS "neighborhoodPricePerSqft",
  COALESCE(nb.nb_count, 0)                 AS "neighborhoodCompCount",
  pg."saleMonth"::int                      AS "saleMonth",
  f."assessedValue"::float                 AS "assessedValue",
  f."marketValue"::float                   AS "marketValue"
FROM page pg
JOIN flipops."ParcelFeature" f
  ON f."countyFips" = pg."countyFips" AND f."apn" = pg."apn"
LEFT JOIN flipops."Parcel" pcl
  ON pcl."countyFips" = pg."countyFips" AND pcl."apn" = pg."apn"
LEFT JOIN LATERAL (
  SELECT
    -- Inverse-distance-weighted mean $/sqft when coords exist on both subject
    -- and neighbor; else a flat mean (weight 1). 1e-6 guards div-by-zero for
    -- coincident points.
    (SUM(comp.ppsf * comp.w) / NULLIF(SUM(comp.w), 0))::float AS nb_ppsf,
    COUNT(*)::int AS nb_count
  FROM (
    SELECT
      c.ppsf,
      CASE
        WHEN f."latitude" IS NOT NULL AND f."longitude" IS NOT NULL
         AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        THEN 1.0 / (1e-6 + sqrt(
               power(f."latitude" - c.lat, 2) +
               power(f."longitude" - c.lng, 2)))
        ELSE 1.0
      END AS w
    FROM ${POOL_TABLE} c
    WHERE c.zip = f."situsZip"
      AND f."situsZip" IS NOT NULL
      AND c.apn <> pg."apn"                          -- leakage guard
      AND pg."saleDate" IS NOT NULL
      ${compWindowClause(compMonths)}
    LIMIT 200                                        -- cap per-sale comp fan-out
  ) comp
) nb ON true
ORDER BY pg.sale_id
`;
}

async function exportCounty(
  countyFips: string,
  opts: ExportOpts,
  stream: fs.WriteStream,
  written: { rows: number; withComps: number },
): Promise<void> {
  // Build the indexed comp pool ONCE for this county (then page against it).
  const poolStart = Date.now();
  for (const ddl of buildPoolDdl(opts.since, opts.compMonths)) {
    await prisma.$executeRawUnsafe(ddl, countyFips);
  }
  const [poolN] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM ${POOL_TABLE}`,
  );
  console.log(
    `[avm-export] ${countyFips} comp pool built: ${poolN.n} rows in ${((Date.now() - poolStart) / 1000).toFixed(1)}s`,
  );

  try {
    let cursor = "";
    for (;;) {
      const [bounds] = await prisma.$queryRawUnsafe<
        Array<{ pageEnd: string | null; pageCount: number }>
      >(pageBoundsSql(opts.since), countyFips, cursor, opts.batchSize);
      if (!bounds || bounds.pageCount === 0 || bounds.pageEnd === null) break;

      const rows = await prisma.$queryRawUnsafe<AvmFrameRow[]>(
        frameSql(opts.since, opts.compMonths),
        countyFips,
        cursor,
        bounds.pageEnd,
      );
      for (const r of rows) {
        stream.write(CSV_COLUMNS.map((c) => csvEscape(r[c])).join(",") + "\n");
        written.rows += 1;
        if ((r.neighborhoodCompCount ?? 0) > 0) written.withComps += 1;
        if (opts.limit && written.rows >= opts.limit) return;
      }
      cursor = bounds.pageEnd;
      console.log(
        `[avm-export] ${countyFips} … cursor=${cursor} (+${bounds.pageCount} sales, ` +
          `+${rows.length} joined) total=${written.rows} withComps=${written.withComps}`,
      );
    }
  } finally {
    // Drop the scratch pool even on early-return (--limit) or error.
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${POOL_TABLE}`);
  }
}

function parseArgs(argv: string[]): ExportOpts {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    metros: (get("--metros") ?? "12086,12011")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    out: get("--out") ?? path.join("scripts", "ml", "avm", "out", "avm-frame.csv"),
    batchSize: Number(get("--batch") ?? 1500),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    since: get("--since"),
    compMonths: get("--comp-months") ? Number(get("--comp-months")) : undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.metros.some((m) => !/^\d{5}$/.test(m))) {
    throw new Error(`--metros must be 5-digit FIPS codes, got: ${opts.metros.join(",")}`);
  }
  if (opts.since && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
    throw new Error(`--since must be YYYY-MM-DD, got: ${opts.since}`);
  }
  if (opts.compMonths !== undefined && !(opts.compMonths > 0 && opts.compMonths <= 60)) {
    throw new Error(`--comp-months must be 1..60, got: ${opts.compMonths}`);
  }
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  const stream = fs.createWriteStream(opts.out);
  stream.write(CSV_COLUMNS.join(",") + "\n");

  console.log(
    `[avm-export] metros=${opts.metros.join(",")} qualCodes=${ARMS_LENGTH_QUAL_CODES.join("/")} ` +
      `saleFloor=${SALE_FLOOR} since=${opts.since ?? "(all history)"} ` +
      `comps=${opts.compMonths ? `trailing-${opts.compMonths}mo` : "±90d (legacy)"} ` +
      `batch=${opts.batchSize} → ${opts.out}`,
  );

  const written = { rows: 0, withComps: 0 };
  for (const county of opts.metros) {
    await exportCounty(county, opts, stream, written);
    if (opts.limit && written.rows >= opts.limit) break;
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
  console.log(
    `[avm-export] done: ${written.rows} rows ` +
      `(${written.withComps} with neighborhood comps, ` +
      `${written.rows ? ((100 * written.withComps) / written.rows).toFixed(1) : "0"}%) → ${opts.out}`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
