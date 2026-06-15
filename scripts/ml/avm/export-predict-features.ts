/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M3.3 AVM v1 — Export the PER-PARCEL prediction feature frame to CSV.
//
//   DATABASE_URL=... npx tsx scripts/ml/avm/export-predict-features.ts \
//     --metros 12086,12011 --out scripts/ml/avm/out/predict-frame.csv
//
// SIBLING of export-avm-training.ts. The training exporter emits ONE ROW PER
// ARMS-LENGTH SALE (the model's fit/eval frame). THIS exporter emits ONE ROW
// PER PARCEL (every ParcelFeature row in the metro) so train_avm.py --predict
// can score the whole inventory → predictions.csv → apply-avm.ts → ParcelValuation.
//
// FEATURE PARITY (train/serve skew is the #1 AVM failure mode): the SELECT list
// must produce EXACTLY the model's featureList (metrics.json.featureList), in
// the same units/types the training frame used. The two computed features need
// an as-of definition because a parcel has no "sale date":
//   * neighborhoodPricePerSqft / neighborhoodCompCount — distance-weighted $/sqft
//     of OTHER same-ZIP arms-length sales in a TRAILING window ending NOW
//     (training used ±90d around the subject sale; serving uses "recent comps as
//     of the valuation date" = trailing COMP_WINDOW_MONTHS). Excludes the
//     subject's own apn (matches the training leakage guard).
//   * saleMonth — the valuation-as-of month (current calendar month, 1..12).
//     Training used the sale's month for seasonality; the honest serving analog
//     is "value it as of this month". Constant per run; a categorical the
//     booster already saw.
//
// Everything else is read straight off ParcelFeature (the frozen silver mart),
// plus the 4 Phase-0 NAL building fields LEFT JOINed from Parcel — effectiveAgeYears
// (computed AS-OF-NOW: currentYear - EFF_YR_BLT, the serving analog of training's
// saleYear - EFF_YR_BLT), improvementQuality, specialFeatureValue, numResUnits — in
// the SAME names/units the training exporter pulls, so there is zero train/serve skew.
//
// SCOPE: parcels that can be valued — squareFeet > 0 (the model leans on $/sqft;
// a 0-sqft land parcel has no living-area signal and the comp $/sqft is
// undefined). Land/0-sqft parcels are intentionally NOT valued (honest absence;
// apply-avm.ts writes no row → underwriting shows "no model estimate").
//
// PERFORMANCE: same MATERIALIZED county-comp-pool trick as the training
// exporter — build the (few ×10⁴-row) arms-length comp pool ONCE per page, then
// the per-parcel LATERAL scans that small in-memory set. Keyset-paginated on
// ParcelFeature.apn within county (Railway proxy kills silent long statements —
// OPERATIONS.md). Typed against raw SQL ($queryRawUnsafe) for parity with the
// training exporter.
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import { prisma } from "../../../lib/prisma";

// Keep in sync with export-avm-training.ts (the training comp pool definition).
const ARMS_LENGTH_QUAL_CODES = ["01", "02"];
const SALE_FLOOR = 20_000;
const QUAL_IN = ARMS_LENGTH_QUAL_CODES.map((c) => `'${c}'`).join(", ");
// Trailing comp window for the serving neighborhood-comp signal. Training used
// a ±90d window around each sale (180d span). 18mo here is the serving analog:
// "recent enough to be a comp, wide enough that every ZIP has some." Matches the
// /api/comps SALE_WINDOW_MONTHS spirit.
const COMP_WINDOW_MONTHS = 18;

/** Column order — MUST match the model featureList plus the (countyFips,apn) key. */
const CSV_COLUMNS = [
  "countyFips",
  "apn",
  // -- model features (exact featureList order from metrics.json) --
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
] as const;

type PredictFrameRow = Record<(typeof CSV_COLUMNS)[number], unknown>;

interface ExportOpts {
  metros: string[];
  out: string;
  batchSize: number;
  limit?: number;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Keyset page bounds on ParcelFeature.apn within a county (valuable parcels only).
// $1=countyFips, $2=apnCursor ('' for first page), $3=batchSize.
const PAGE_BOUNDS_SQL = `
  SELECT MAX(apn) AS "pageEnd", COUNT(*)::int AS "pageCount"
  FROM (
    SELECT f."apn"
    FROM flipops."ParcelFeature" f
    WHERE f."countyFips" = $1
      AND COALESCE(f."squareFeet", 0) > 0
      AND f."apn" > $2
    ORDER BY f."apn"
    LIMIT $3
  ) page
`;

// Per-page frame query. $1=countyFips, $2=apnCursor (exclusive), $3=pageEnd
// (inclusive), $4=saleMonth (valuation-as-of month, bound from JS).
// county_comps mirrors the training exporter's MATERIALIZED comp pool, but
// scoped to the trailing COMP_WINDOW_MONTHS window (the serving "recent comps"
// definition). The per-parcel LATERAL inverse-distance-weights same-ZIP comps,
// excluding the subject's own apn (training leakage guard parity).
const FRAME_SQL = `
WITH county_comps AS MATERIALIZED (
  SELECT s."apn"        AS apn,
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
    AND s."saleDate" >= NOW() - interval '${COMP_WINDOW_MONTHS} months'
    AND cf."situsZip" IS NOT NULL
)
SELECT
  f."countyFips"                           AS "countyFips",
  f."apn"                                   AS "apn",
  f."squareFeet"::int                      AS "squareFeet",
  f."lotSize"::float                       AS "lotSize",
  f."ageYears"::int                        AS "ageYears",
  (CASE WHEN pcl."effectiveYearBuilt" BETWEEN 1800 AND 2100
        THEN EXTRACT(YEAR FROM NOW())::int - pcl."effectiveYearBuilt"
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
  $4::int                                  AS "saleMonth"
FROM flipops."ParcelFeature" f
LEFT JOIN flipops."Parcel" pcl
  ON pcl."countyFips" = f."countyFips" AND pcl."apn" = f."apn"
LEFT JOIN LATERAL (
  SELECT
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
    FROM county_comps c
    WHERE c.zip = f."situsZip"
      AND f."situsZip" IS NOT NULL
      AND c.apn <> f."apn"                           -- leakage guard parity
    LIMIT 200
  ) comp
) nb ON true
WHERE f."countyFips" = $1
  AND COALESCE(f."squareFeet", 0) > 0
  AND f."apn" > $2
  AND f."apn" <= $3
ORDER BY f."apn"
`;

async function exportCounty(
  countyFips: string,
  saleMonth: number,
  opts: ExportOpts,
  stream: fs.WriteStream,
  written: { rows: number; withComps: number },
): Promise<void> {
  let cursor = "";
  for (;;) {
    const [bounds] = await prisma.$queryRawUnsafe<
      Array<{ pageEnd: string | null; pageCount: number }>
    >(PAGE_BOUNDS_SQL, countyFips, cursor, opts.batchSize);
    if (!bounds || bounds.pageCount === 0 || bounds.pageEnd === null) break;

    const rows = await prisma.$queryRawUnsafe<PredictFrameRow[]>(
      FRAME_SQL,
      countyFips,
      cursor,
      bounds.pageEnd,
      saleMonth,
    );
    for (const r of rows) {
      stream.write(CSV_COLUMNS.map((c) => csvEscape(r[c])).join(",") + "\n");
      written.rows += 1;
      if (Number(r.neighborhoodCompCount ?? 0) > 0) written.withComps += 1;
      if (opts.limit && written.rows >= opts.limit) return;
    }
    cursor = bounds.pageEnd;
    console.log(
      `[avm-predict-export] ${countyFips} … cursor=${cursor} (+${bounds.pageCount} parcels) ` +
        `total=${written.rows} withComps=${written.withComps}`,
    );
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
    out:
      get("--out") ??
      path.join("scripts", "ml", "avm", "out", "predict-frame.csv"),
    batchSize: Number(get("--batch") ?? 5000),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.metros.some((m) => !/^\d{5}$/.test(m))) {
    throw new Error(`--metros must be 5-digit FIPS codes, got: ${opts.metros.join(",")}`);
  }
  // Valuation-as-of month (1..12), constant per run — the serving analog of the
  // training frame's per-sale saleMonth seasonality feature.
  const saleMonth = new Date().getUTCMonth() + 1;

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  const stream = fs.createWriteStream(opts.out);
  stream.write(CSV_COLUMNS.join(",") + "\n");

  console.log(
    `[avm-predict-export] metros=${opts.metros.join(",")} saleMonth=${saleMonth} ` +
      `compWindow=${COMP_WINDOW_MONTHS}mo batch=${opts.batchSize} → ${opts.out}`,
  );

  const written = { rows: 0, withComps: 0 };
  for (const county of opts.metros) {
    await exportCounty(county, saleMonth, opts, stream, written);
    if (opts.limit && written.rows >= opts.limit) break;
  }

  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
  console.log(
    `[avm-predict-export] done: ${written.rows} parcel rows ` +
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
