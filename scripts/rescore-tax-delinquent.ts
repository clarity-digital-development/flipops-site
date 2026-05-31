/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Refresh the TaxDelinquencySummary materialized aggregate.
//
// One row per (countyFips, apn) summarizing all Lien rows with
// lienCategory='tax' for that parcel. Pre-materializes score/grade/motivation
// so the /api/properties UNION can ORDER BY score in SQL and support scoreMin
// filtering without an over-fetch-and-rescore loop.
//
// Idempotent: safe to run repeatedly (ON CONFLICT … DO UPDATE).
//
// Triggers:
//   1. End of every tax-delinquent scraper run (call from adapter or registry hook)
//   2. Daily safety-net cron in lib/cron/discovery/tax-delinquent-summary.ts
//   3. Manual invocation:  DATABASE_URL=... npx tsx scripts/rescore-tax-delinquent.ts
//      Optional --county <FIPS> flag to scope to a single county.
//
// Score formula (mirrors quickDistressScore in lib/reapi/utils/distress-scorer.ts
// for the tax-delinquent path; the synthesizer's plan A3 will land the full
// algorithm — this is the inline SQL version optimized for batch aggregation):
//   base = 20            (HIGH-tier signal weight, matches existing Liens=20)
//   +10 if yearsCount >= 3 (multi-year compounding)
//   +5  if totalAmount > 50_000   (high-dollar exposure)
//   +5  if totalAmount > 250_000  (very-high exposure)
//   +5  if latestYear >= (currentYear - 1) (active/current vs stale)
//   cap at 100
//
// Grade thresholds (mirror distress-scorer.ts):
//   A >= 65 | B 50-64 | C 35-49 | D 20-34 | F <20
// ---------------------------------------------------------------------------

interface RescoreResult {
  rowsAffected: number;
  durationMs: number;
  scopedTo?: string;
}

export async function refreshTaxDelinquencySummary(opts: { countyFips?: string } = {}): Promise<RescoreResult> {
  const start = Date.now();

  // The aggregate runs entirely in Postgres. We construct the SQL with an
  // optional WHERE clause when scoping to a single county so the per-scraper
  // post-write hook can update just-touched data quickly.
  const countyFilter = opts.countyFips
    ? `AND l."countyFips" = '${opts.countyFips.replace(/[^0-9]/g, "")}'` // sanitize: digits only
    : "";

  const sql = `
    INSERT INTO flipops."TaxDelinquencySummary" (
      "countyFips", "apn", "totalAmount", "yearsCount",
      "earliestYear", "latestYear", "certificateCount",
      "score", "grade", "motivation", "computedAt"
    )
    SELECT
      sub."countyFips",
      sub."apn",
      sub."totalAmount",
      sub."yearsCount",
      sub."earliestYear",
      sub."latestYear",
      sub."certificateCount",
      LEAST(100,
        20
        + CASE WHEN sub."yearsCount" >= 3        THEN 10 ELSE 0 END
        + CASE WHEN sub."totalAmount" > 50000    THEN 5  ELSE 0 END
        + CASE WHEN sub."totalAmount" > 250000   THEN 5  ELSE 0 END
        + CASE WHEN sub."latestYear" >= (EXTRACT(YEAR FROM NOW())::int - 1) THEN 5 ELSE 0 END
      ) AS "score",
      CASE
        WHEN LEAST(100,
          20
          + CASE WHEN sub."yearsCount" >= 3        THEN 10 ELSE 0 END
          + CASE WHEN sub."totalAmount" > 50000    THEN 5  ELSE 0 END
          + CASE WHEN sub."totalAmount" > 250000   THEN 5  ELSE 0 END
          + CASE WHEN sub."latestYear" >= (EXTRACT(YEAR FROM NOW())::int - 1) THEN 5 ELSE 0 END
        ) >= 65 THEN 'A'
        WHEN LEAST(100,
          20
          + CASE WHEN sub."yearsCount" >= 3        THEN 10 ELSE 0 END
          + CASE WHEN sub."totalAmount" > 50000    THEN 5  ELSE 0 END
          + CASE WHEN sub."totalAmount" > 250000   THEN 5  ELSE 0 END
          + CASE WHEN sub."latestYear" >= (EXTRACT(YEAR FROM NOW())::int - 1) THEN 5 ELSE 0 END
        ) >= 50 THEN 'B'
        WHEN LEAST(100,
          20
          + CASE WHEN sub."yearsCount" >= 3        THEN 10 ELSE 0 END
          + CASE WHEN sub."totalAmount" > 50000    THEN 5  ELSE 0 END
          + CASE WHEN sub."totalAmount" > 250000   THEN 5  ELSE 0 END
          + CASE WHEN sub."latestYear" >= (EXTRACT(YEAR FROM NOW())::int - 1) THEN 5 ELSE 0 END
        ) >= 35 THEN 'C'
        WHEN LEAST(100,
          20
          + CASE WHEN sub."yearsCount" >= 3        THEN 10 ELSE 0 END
          + CASE WHEN sub."totalAmount" > 50000    THEN 5  ELSE 0 END
          + CASE WHEN sub."totalAmount" > 250000   THEN 5  ELSE 0 END
          + CASE WHEN sub."latestYear" >= (EXTRACT(YEAR FROM NOW())::int - 1) THEN 5 ELSE 0 END
        ) >= 20 THEN 'D'
        ELSE 'F'
      END AS "grade",
      (
        CASE WHEN sub."yearsCount" >= 3 THEN 'Multi-year tax delinquency' ELSE 'Tax delinquent' END
        || ' (' || sub."yearsCount" || ' year' || (CASE WHEN sub."yearsCount" = 1 THEN '' ELSE 's' END) || ', $'
        || TRIM(TO_CHAR(sub."totalAmount", 'FM999G999G999G990D00')) || ' owed)'
      ) AS "motivation",
      NOW() AS "computedAt"
    FROM (
      SELECT
        l."countyFips",
        l."apn",
        COALESCE(SUM(l."amount"), 0)::float                                          AS "totalAmount",
        COUNT(DISTINCT SUBSTRING(l."lienTypeCode" FROM 'DELINQUENT_TAX_(\\d+)'))::int AS "yearsCount",
        MIN(SUBSTRING(l."lienTypeCode" FROM 'DELINQUENT_TAX_(\\d+)')::int)            AS "earliestYear",
        MAX(SUBSTRING(l."lienTypeCode" FROM 'DELINQUENT_TAX_(\\d+)')::int)            AS "latestYear",
        COUNT(*)::int                                                                 AS "certificateCount"
      FROM flipops."Lien" l
      WHERE l."lienCategory" = 'tax'
        AND l."apn" IS NOT NULL
        ${countyFilter}
      GROUP BY l."countyFips", l."apn"
      HAVING COUNT(DISTINCT SUBSTRING(l."lienTypeCode" FROM 'DELINQUENT_TAX_(\\d+)')) > 0
    ) sub
    ON CONFLICT ("countyFips", "apn") DO UPDATE SET
      "totalAmount"      = EXCLUDED."totalAmount",
      "yearsCount"       = EXCLUDED."yearsCount",
      "earliestYear"     = EXCLUDED."earliestYear",
      "latestYear"       = EXCLUDED."latestYear",
      "certificateCount" = EXCLUDED."certificateCount",
      "score"            = EXCLUDED."score",
      "grade"            = EXCLUDED."grade",
      "motivation"       = EXCLUDED."motivation",
      "computedAt"       = NOW()
  `;

  const rowsAffected = await prisma.$executeRawUnsafe(sql);
  return {
    rowsAffected,
    durationMs: Date.now() - start,
    scopedTo: opts.countyFips,
  };
}

async function main() {
  const countyArg = process.argv.indexOf("--county");
  const countyFips = countyArg >= 0 ? process.argv[countyArg + 1] : undefined;

  console.log(`[rescore-tax-delinquent] refreshing TaxDelinquencySummary${countyFips ? ` (countyFips=${countyFips})` : " (all counties)"}`);
  const result = await refreshTaxDelinquencySummary({ countyFips });
  console.log(
    `[rescore-tax-delinquent] done: ${result.rowsAffected} rows affected in ${(result.durationMs / 1000).toFixed(1)}s`,
  );

  // Quick distribution check
  const dist = await prisma.$queryRaw<Array<{ grade: string | null; n: bigint }>>`
    SELECT "grade", COUNT(*)::bigint AS "n"
    FROM flipops."TaxDelinquencySummary"
    GROUP BY "grade"
    ORDER BY "grade" NULLS LAST`;
  console.log("\nGrade distribution:");
  for (const row of dist) {
    console.log(`  ${(row.grade ?? "(null)").padEnd(8)} ${row.n.toLocaleString()}`);
  }

  const counts = await prisma.$queryRaw<Array<{ countyFips: string; n: bigint; topAmount: number }>>`
    SELECT "countyFips", COUNT(*)::bigint AS "n", MAX("totalAmount")::float AS "topAmount"
    FROM flipops."TaxDelinquencySummary"
    GROUP BY "countyFips"
    ORDER BY "n" DESC`;
  console.log("\nCounts by county:");
  for (const row of counts) {
    console.log(`  ${row.countyFips}  ${row.n.toString().padStart(8)}  top owed=$${row.topAmount.toLocaleString()}`);
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
