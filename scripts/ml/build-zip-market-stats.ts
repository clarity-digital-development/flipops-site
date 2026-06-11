/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// M2.3 — Refresh the ZipMarketStats mart (per-ZIP market aggregates).
//
//   DATABASE_URL=... npx tsx scripts/ml/build-zip-market-stats.ts
//   DATABASE_URL=... npx tsx scripts/ml/build-zip-market-stats.ts --dry-run
//   ... --timeout-ms 300000
//
// One row per 5-digit FL ZIP from ParcelSale × Parcel:
//   medianSalePrice   median qualified sale price, trailing 12mo
//   pricePerSqft      median (salePrice / squareFeet), trailing 12mo
//   saleVelocity12mo  qualified sales trailing 12mo / parcel count in ZIP
//   trend12moPct      median price t12mo vs PRIOR 12mo window, percent
//                     (NULL when either window has < TREND_MIN_SAMPLE sales)
//   sampleSize        qualified-sale count in the trailing-12mo window
//
// "Qualified sale" = salePrice >= QUALIFIED_SALE_FLOOR ($10k arm's-length
// proxy) — keep in sync with scripts/ml/export-training-data.ts and the
// ZipMarketStats doc comment in prisma/schema.prisma.
//
// Single set-based UPSERT (rescore-*.ts pattern, ON CONFLICT DO UPDATE).
// FL-wide is ~1.1K ZIPs aggregated from ~2M post-2024 sales — one statement,
// run inside its own transaction with SET LOCAL statement_timeout +
// synchronous_commit=OFF (OPERATIONS.md Railway-proxy landmine: if this ever
// grows past ~2-3 min wall-clock, chunk it per county like
// build-parcel-features.ts).
//
// Refresh cadence: monthly with the retrain (SCORING-ARCHITECTURE "Cadence"),
// or after major sale-history lands (M2.7 SDF backfill). Idempotent.
// ---------------------------------------------------------------------------

// Relative import (not "@/lib/prisma") so a standalone `tsc --noEmit` on this
// file resolves without the Next.js path-alias config. Same singleton.
import { prisma } from "../../lib/prisma";

// Keep in sync with export-training-data.ts QUALIFIED_SALE_FLOOR.
const QUALIFIED_SALE_FLOOR = 10_000;
// Minimum qualified sales in BOTH 12mo windows before a trend is reported —
// a median of 3 sales is noise, not a trend (schema doc: small-sample ZIPs).
const TREND_MIN_SAMPLE = 5;

/**
 * The aggregation half (shared by --dry-run and the live UPSERT).
 * percentile_cont + FILTER: only rows passing the filter feed the aggregate.
 * salePrice / NULLIF(squareFeet, 0) — NULLs are ignored by percentile_cont.
 */
const AGG_SQL = `
  SELECT
    p."situsZip" AS zip,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY s."salePrice")
      FILTER (WHERE s."saleDate" >= NOW() - interval '12 months')::float       AS median_t12,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY s."salePrice" / NULLIF(p."squareFeet", 0)::float)
      FILTER (WHERE s."saleDate" >= NOW() - interval '12 months'
                AND COALESCE(p."squareFeet", 0) > 0)::float                    AS ppsf_t12,
    COUNT(*) FILTER (WHERE s."saleDate" >= NOW() - interval '12 months')::int  AS n_t12,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY s."salePrice")
      FILTER (WHERE s."saleDate" < NOW() - interval '12 months')::float        AS median_prior,
    COUNT(*) FILTER (WHERE s."saleDate" < NOW() - interval '12 months')::int   AS n_prior
  FROM flipops."ParcelSale" s
  JOIN flipops."Parcel" p
    ON p."countyFips" = s."countyFips" AND p."apn" = s."apn"
  WHERE s."saleDate" >= NOW() - interval '24 months'
    AND COALESCE(s."salePrice", 0) >= ${QUALIFIED_SALE_FLOOR}
    AND p."state" = 'FL'
    AND p."situsZip" ~ '^[0-9]{5}$'
  GROUP BY p."situsZip"
`;

const UPSERT_SQL = `
  INSERT INTO flipops."ZipMarketStats" (
    "zip", "state", "medianSalePrice", "pricePerSqft",
    "saleVelocity12mo", "trend12moPct", "sampleSize", "computedAt"
  )
  SELECT
    agg.zip,
    'FL',
    agg.median_t12,
    agg.ppsf_t12,
    CASE WHEN COALESCE(pc.parcel_count, 0) > 0
         THEN (agg.n_t12::float / pc.parcel_count) END,
    CASE WHEN agg.n_t12 >= ${TREND_MIN_SAMPLE}
          AND agg.n_prior >= ${TREND_MIN_SAMPLE}
          AND COALESCE(agg.median_prior, 0) > 0
         THEN (100.0 * (agg.median_t12 - agg.median_prior) / agg.median_prior)::float END,
    COALESCE(agg.n_t12, 0),
    NOW()
  FROM (${AGG_SQL}) agg
  LEFT JOIN (
    SELECT "situsZip" AS zip, COUNT(*)::int AS parcel_count
    FROM flipops."Parcel"
    WHERE "state" = 'FL' AND "situsZip" IS NOT NULL
    GROUP BY 1
  ) pc ON pc.zip = agg.zip
  ON CONFLICT ("zip") DO UPDATE SET
    "state"            = EXCLUDED."state",
    "medianSalePrice"  = EXCLUDED."medianSalePrice",
    "pricePerSqft"     = EXCLUDED."pricePerSqft",
    "saleVelocity12mo" = EXCLUDED."saleVelocity12mo",
    "trend12moPct"     = EXCLUDED."trend12moPct",
    "sampleSize"       = EXCLUDED."sampleSize",
    "computedAt"       = NOW()
`;

export async function refreshZipMarketStats(opts: { timeoutMs?: number } = {}): Promise<number> {
  const timeoutMs = opts.timeoutMs ?? 300_000;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeoutMs}`);
      await tx.$executeRawUnsafe(`SET LOCAL synchronous_commit = OFF`);
      return tx.$executeRawUnsafe(UPSERT_SQL);
    },
    // Prisma interactive-transaction default is 5s — always set explicitly
    // (OPERATIONS.md / F1 BulkIngester lesson).
    { timeout: timeoutMs + 30_000 },
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const tIdx = argv.indexOf("--timeout-ms");
  const timeoutMs = tIdx >= 0 ? Number(argv[tIdx + 1]) : 300_000;

  const start = Date.now();
  if (dryRun) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ zips: number; sales: number }>>(
      `SELECT COUNT(*)::int AS zips, COALESCE(SUM(n_t12 + n_prior), 0)::int AS sales FROM (${AGG_SQL}) agg`,
    );
    console.log(
      `[zip-market-stats] DRY RUN: would upsert ${row.zips} ZIPs ` +
        `(from ${row.sales} qualified sales, 24mo window) in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
  } else {
    const rows = await refreshZipMarketStats({ timeoutMs });
    console.log(
      `[zip-market-stats] upserted ${rows} ZIP rows in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    const [agg] = await prisma.$queryRawUnsafe<
      Array<{ n: number; med: number | null; trended: number; tiny: number }>
    >(`
      SELECT COUNT(*)::int AS n,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "medianSalePrice")::float AS med,
             COUNT(*) FILTER (WHERE "trend12moPct" IS NOT NULL)::int AS trended,
             COUNT(*) FILTER (WHERE "sampleSize" < ${TREND_MIN_SAMPLE})::int AS tiny
      FROM flipops."ZipMarketStats"
    `);
    console.log(
      `[zip-market-stats] mart: ${agg.n} ZIPs · median-of-medians $${Math.round(agg.med ?? 0).toLocaleString()} ` +
        `· ${agg.trended} with trend · ${agg.tiny} small-sample (<${TREND_MIN_SAMPLE})`,
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
