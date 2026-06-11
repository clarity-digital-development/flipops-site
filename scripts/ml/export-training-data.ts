/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M2.3/M2.4 — Export the discrete-time-hazard training frame to CSV.
//
//   DATABASE_URL=... npx tsx scripts/ml/export-training-data.ts \
//     --metros 12031,12086 --out scripts/ml/out/training-frame.csv
//
// FRAME DEFINITION (SCORING-ARCHITECTURE Layer 1; M2.4 "What/How"):
//   One row per (delinquent parcel, quarter-at-risk).
//   Cohort   = TaxDelinquencySummary rows (delinquency onset known via
//              earliestYear: FL Ch.197 — taxes for year Y become delinquent
//              April 1 of Y+1, so onset = make_date(earliestYear+1, 4, 1)).
//   At-risk  = quarters from max(onset, labelStart) up to the quarter BEFORE
//              the first qualifying sale (inclusive of the sale quarter,
//              which is the positive row), right-censored at the last
//              COMPLETE quarter. Parcels that never sell contribute only
//              label=0 rows (censoring is handled by simply not emitting
//              post-observation quarters — standard discrete-time hazard).
//   Label    = soldThisQuarter: first qualifying ParcelSale (salePrice >=
//              QUALIFIED_SALE_FLOOR, arm's-length proxy) falls in the quarter.
//   IMPORTANT: ParcelSale currently spans 2024-01 → present (M2.7 SDF
//              backfill to 2009 pending), so --label-start defaults to
//              2024-01-01. Widen it only after the backfill lands or every
//              pre-2024 quarter becomes a false negative.
//   DATA REALITY (verified 2026-06-10): counties whose delinquency capture
//              starts at tax year 2025 (onset 2026-04-01 — all of Duval)
//              have ZERO completed at-risk quarters yet and contribute ~no
//              rows. Miami-Dade (39K parcels at earliestYear=2024 → 4
//              quarters each) and Broward are the viable v1 frame.
//
// Features are computed inline from Parcel + ParcelSale (zip aggregates via
// CTE) so this script runs BEFORE the ParcelFeature/ZipMarketStats marts are
// pushed. Once the marts are populated, swap the zip_stats CTE for a join to
// flipops."ZipMarketStats" and the parcel columns for ParcelFeature — the
// output column contract below must NOT change without a featureVersion bump.
//
// Typed against raw SQL ($queryRawUnsafe) by design — must compile before the
// schema patch lands (no generated-model imports for the new tables).
// Keyset-paginated per county (Railway proxy kills silent long statements —
// OPERATIONS.md landmine — so no single statewide mega-query).
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../lib/prisma";

// Keep in sync with ZipMarketStats doc comment in schema.patch.ml.prisma.
const QUALIFIED_SALE_FLOOR = 10_000;

/** One exported frame row. Mirrors the SELECT list — update both together. */
interface FrameRow {
  countyFips: string;
  apn: string;
  quarterStart: Date; // first day of the at-risk quarter
  quartersSinceOnset: number; // time-varying hazard clock
  // -- TAX_FAMILY (from TaxDelinquencySummary) --
  taxYearsCount: number;
  taxTotalAmount: number;
  taxEarliestYear: number;
  taxLatestYear: number;
  // -- Parcel characteristics --
  marketValue: number | null;
  assessedValue: number | null;
  assessedToMarketRatio: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  ageYears: number | null;
  propertyType: string | null;
  ownerOccupied: boolean | null;
  situsZip: string | null;
  // -- ZIP aggregates (inline CTE; later: ZipMarketStats snapshot) --
  zipMedianSalePrice: number | null;
  zipSaleVelocity12mo: number | null;
  zipSampleSize: number | null;
  // -- Label --
  soldThisQuarter: number; // 0 | 1
}

interface ExportOpts {
  metros: string[];
  out: string;
  labelStart: string; // ISO date — start of label-observable window
  maxQuarters: number; // cap person-quarters per parcel
  batchSize: number; // cohort parcels per SQL statement (keyset page)
  limit?: number; // total row cap, for LIMIT-testing
}

const CSV_COLUMNS: (keyof FrameRow)[] = [
  "countyFips",
  "apn",
  "quarterStart",
  "quartersSinceOnset",
  "taxYearsCount",
  "taxTotalAmount",
  "taxEarliestYear",
  "taxLatestYear",
  "marketValue",
  "assessedValue",
  "assessedToMarketRatio",
  "squareFeet",
  "lotSize",
  "ageYears",
  "propertyType",
  "ownerOccupied",
  "situsZip",
  "zipMedianSalePrice",
  "zipSaleVelocity12mo",
  "zipSampleSize",
  "soldThisQuarter",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Keyset page bounds: the frame query is bounded by a cohort APN RANGE
 * (not LIMIT on frame rows) so pages that legitimately yield zero frame rows
 * — e.g. every parcel in the page has earliestYear=2025, onset 2026-04-01,
 * no completed at-risk quarter yet (the entire Duval cohort as of 2026-06) —
 * still advance the cursor instead of terminating the county early.
 * $1=countyFips, $2=apnCursor ('' for first page), $3=batchSize.
 */
const PAGE_BOUNDS_SQL = `
  SELECT MAX(apn) AS "pageEnd", COUNT(*)::int AS "pageCount"
  FROM (
    SELECT t."apn" AS apn
    FROM flipops."TaxDelinquencySummary" t
    WHERE t."countyFips" = $1 AND t."apn" > $2
    ORDER BY t."apn"
    LIMIT $3
  ) page
`;

/**
 * The per-page frame query. $1=countyFips, $2=labelStart, $3=maxQuarters,
 * $4=apnCursor (exclusive lower bound), $5=pageEnd (inclusive upper bound).
 *
 * zip_stats is computed once per page over the county's trailing-12mo sales —
 * acceptable at batch sizes of a few thousand; revisit (or cut over to
 * ZipMarketStats) if EXPLAIN shows it dominating on Miami-Dade.
 */
const FRAME_SQL = `
WITH cohort AS (
  SELECT t."countyFips", t."apn",
         t."yearsCount", t."totalAmount", t."earliestYear", t."latestYear",
         make_date(t."earliestYear" + 1, 4, 1) AS onset_date
  FROM flipops."TaxDelinquencySummary" t
  WHERE t."countyFips" = $1
    AND t."apn" > $4
    AND t."apn" <= $5
),
first_sale AS (
  SELECT c."countyFips", c."apn", MIN(s."saleDate") AS sale_date
  FROM cohort c
  JOIN flipops."ParcelSale" s
    ON s."countyFips" = c."countyFips" AND s."apn" = c."apn"
   AND s."saleDate" >= GREATEST(c.onset_date, $2::date)
   AND COALESCE(s."salePrice", 0) >= ${QUALIFIED_SALE_FLOOR}
  GROUP BY 1, 2
),
zip_stats AS (
  SELECT p."situsZip" AS zip,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY s."salePrice")::float AS median_price,
         (COUNT(*)::float / NULLIF(MAX(pc.parcel_count), 0))               AS velocity,
         COUNT(*)::int                                                     AS sample_size
  FROM flipops."ParcelSale" s
  JOIN flipops."Parcel" p
    ON p."countyFips" = s."countyFips" AND p."apn" = s."apn"
  JOIN (
    SELECT "situsZip", COUNT(*) AS parcel_count
    FROM flipops."Parcel"
    WHERE "countyFips" = $1 AND "situsZip" IS NOT NULL
    GROUP BY 1
  ) pc ON pc."situsZip" = p."situsZip"
  WHERE s."countyFips" = $1
    AND s."saleDate" >= (date_trunc('quarter', now()) - interval '12 months')
    AND COALESCE(s."salePrice", 0) >= ${QUALIFIED_SALE_FLOOR}
    AND p."situsZip" IS NOT NULL
  GROUP BY 1
),
frame AS (
  SELECT c.*, fs.sale_date, gs.q AS quarter_start
  FROM cohort c
  LEFT JOIN first_sale fs
    ON fs."countyFips" = c."countyFips" AND fs."apn" = c."apn"
  CROSS JOIN LATERAL generate_series(
    GREATEST(date_trunc('quarter', c.onset_date), date_trunc('quarter', $2::date)),
    LEAST(
      COALESCE(date_trunc('quarter', fs.sale_date),
               date_trunc('quarter', now()) - interval '3 months'),
      GREATEST(date_trunc('quarter', c.onset_date), date_trunc('quarter', $2::date))
        + ($3::int - 1) * interval '3 months'
    ),
    interval '3 months'
  ) AS gs(q)
)
SELECT
  f."countyFips"                                       AS "countyFips",
  f."apn"                                              AS "apn",
  f.quarter_start::date                                AS "quarterStart",
  (EXTRACT(EPOCH FROM (f.quarter_start - date_trunc('quarter', f.onset_date)))
     / (86400 * 91.25))::int                           AS "quartersSinceOnset",
  f."yearsCount"::int                                  AS "taxYearsCount",
  f."totalAmount"::float                               AS "taxTotalAmount",
  f."earliestYear"::int                                AS "taxEarliestYear",
  f."latestYear"::int                                  AS "taxLatestYear",
  p."marketValue"::float                               AS "marketValue",
  p."assessedValue"::float                             AS "assessedValue",
  CASE WHEN COALESCE(p."marketValue", 0) > 0
       THEN (p."assessedValue" / p."marketValue")::float END AS "assessedToMarketRatio",
  p."squareFeet"::int                                  AS "squareFeet",
  p."lotSize"::float                                   AS "lotSize",
  CASE WHEN p."yearBuilt" IS NOT NULL
       THEN (EXTRACT(YEAR FROM now())::int - p."yearBuilt") END AS "ageYears",
  p."propertyType"                                     AS "propertyType",
  p."ownerOccupied"                                    AS "ownerOccupied",
  p."situsZip"                                         AS "situsZip",
  z.median_price                                       AS "zipMedianSalePrice",
  z.velocity                                           AS "zipSaleVelocity12mo",
  z.sample_size                                        AS "zipSampleSize",
  CASE WHEN f.sale_date IS NOT NULL
        AND date_trunc('quarter', f.sale_date) = f.quarter_start
       THEN 1 ELSE 0 END                               AS "soldThisQuarter"
FROM frame f
LEFT JOIN flipops."Parcel" p
  ON p."countyFips" = f."countyFips" AND p."apn" = f."apn"
LEFT JOIN zip_stats z ON z.zip = p."situsZip"
ORDER BY f."apn", f.quarter_start
`;

async function exportCounty(
  countyFips: string,
  opts: ExportOpts,
  stream: fs.WriteStream,
  written: { rows: number; positives: number },
): Promise<void> {
  let cursor = "";
  // Cohort pages, keyset on apn. Two bounded statements per page: bounds
  // first (always advances), then the frame rows for that APN range.
  for (;;) {
    const [bounds] = await prisma.$queryRawUnsafe<
      Array<{ pageEnd: string | null; pageCount: number }>
    >(PAGE_BOUNDS_SQL, countyFips, cursor, opts.batchSize);
    if (!bounds || bounds.pageCount === 0 || bounds.pageEnd === null) break;

    const rows = await prisma.$queryRawUnsafe<FrameRow[]>(
      FRAME_SQL,
      countyFips,
      opts.labelStart,
      opts.maxQuarters,
      cursor,
      bounds.pageEnd,
    );
    for (const r of rows) {
      stream.write(CSV_COLUMNS.map((c) => csvEscape(r[c])).join(",") + "\n");
      written.rows += 1;
      if (r.soldThisQuarter === 1) written.positives += 1;
      if (opts.limit && written.rows >= opts.limit) return;
    }
    cursor = bounds.pageEnd;
    console.log(
      `[export] ${countyFips} … cursor=${cursor} (+${bounds.pageCount} parcels, ` +
        `+${rows.length} frame rows) total=${written.rows} positives=${written.positives}`,
    );
  }
}

function parseArgs(argv: string[]): ExportOpts {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    metros: (get("--metros") ?? "12031,12086").split(",").map((s) => s.trim()).filter(Boolean),
    out: get("--out") ?? path.join("scripts", "ml", "out", "training-frame.csv"),
    labelStart: get("--label-start") ?? "2024-01-01", // ParcelSale coverage floor (pre-M2.7)
    maxQuarters: Number(get("--max-quarters") ?? 20),
    batchSize: Number(get("--batch") ?? 2000),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.metros.some((m) => !/^\d{5}$/.test(m))) {
    throw new Error(`--metros must be 5-digit FIPS codes, got: ${opts.metros.join(",")}`);
  }
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  const stream = fs.createWriteStream(opts.out);
  stream.write(CSV_COLUMNS.join(",") + "\n");

  console.log(
    `[export] metros=${opts.metros.join(",")} labelStart=${opts.labelStart} ` +
      `maxQuarters=${opts.maxQuarters} batch=${opts.batchSize} → ${opts.out}`,
  );

  const written = { rows: 0, positives: 0 };
  for (const county of opts.metros) {
    await exportCounty(county, opts, stream, written);
    if (opts.limit && written.rows >= opts.limit) break;
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
  console.log(
    `[export] done: ${written.rows} rows (${written.positives} positives, ` +
      `${written.rows ? ((100 * written.positives) / written.rows).toFixed(2) : "0"}% base rate) → ${opts.out}`,
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
