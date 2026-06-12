/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Refresh the CodeViolationSummary materialized aggregate (M3.2).
//
// One row per (countyFips, apn) summarizing all CodeViolation rows with a
// resolved parcelApn for that parcel:
//   openCount        → COUNT WHERE status='open'
//   totalCount       → COUNT all (open + closed)
//   hasLien          → BOOL_OR(isLien)
//   earliestOpenedAt → MIN(openedAt) over open rows
//   latestOpenedAt   → MAX(openedAt) over open rows
//   categories       → distinct normalized categories present
// plus a materialized score/grade/motivation for the UNION list-ranking path,
// mirroring scripts/rescore-tax-delinquent.ts.
//
// Score formula (mirrors the scorer's CONDITION_FAMILY in
// lib/scoring/distress-scorer.ts — family-MAX, so these stack as one family):
//   base = 12            CODE_VIOLATION_OPEN  (>=1 open violation)
//   +6   if openCount >= 3   CODE_VIOLATION_MULTI (chronic non-compliance)
//   +8   if hasLien          CODE_LIEN (recorded code-enforcement lien)
//   cap at 100. Parcels with ZERO open violations are NOT summarized (the
//   signal is live-distress; a fully-closed history carries no score).
//
// Grade thresholds (mirror distress-scorer.ts):
//   A >= 65 | B 50-64 | C 35-49 | D 20-34 | F <20
//   (code-violation-only parcels land in D/F; the value is in COMBINING with
//    tax/foreclosure families at promote — this mart just ranks the slice.)
//
// Idempotent: ON CONFLICT … DO UPDATE. Chunked per county (OPERATIONS.md:
// never one statewide mega-statement on the Railway proxy).
//
// Triggers:
//   1. End of every code-enforcement ingest (lib/scrapers/dispatch/code-enforcement.ts)
//   2. Manual: DATABASE_URL=... npx tsx scripts/rescore-code-violations.ts [--county <FIPS>]
// ---------------------------------------------------------------------------

interface RescoreResult {
  rowsAffected: number;
  durationMs: number;
  scopedTo?: string;
}

/** The score CASE expression, reused for score + grade derivation. */
const SCORE_EXPR = `LEAST(100,
  12
  + CASE WHEN sub."openCount" >= 3 THEN 6 ELSE 0 END
  + CASE WHEN sub."hasLien"        THEN 8 ELSE 0 END
)`;

export async function refreshCodeViolationSummary(
  opts: { countyFips?: string } = {},
): Promise<RescoreResult> {
  const start = Date.now();

  const countyFilter = opts.countyFips
    ? `AND cv."countyFips" = '${opts.countyFips.replace(/[^0-9]/g, "")}'` // sanitize: digits only
    : "";

  const sql = `
    INSERT INTO flipops."CodeViolationSummary" (
      "countyFips", "apn", "openCount", "totalCount", "hasLien",
      "earliestOpenedAt", "latestOpenedAt", "categories",
      "score", "grade", "motivation", "computedAt"
    )
    SELECT
      sub."countyFips",
      sub."apn",
      sub."openCount",
      sub."totalCount",
      sub."hasLien",
      sub."earliestOpenedAt",
      sub."latestOpenedAt",
      sub."categories",
      ${SCORE_EXPR} AS "score",
      CASE
        WHEN ${SCORE_EXPR} >= 65 THEN 'A'
        WHEN ${SCORE_EXPR} >= 50 THEN 'B'
        WHEN ${SCORE_EXPR} >= 35 THEN 'C'
        WHEN ${SCORE_EXPR} >= 20 THEN 'D'
        ELSE 'F'
      END AS "grade",
      (
        sub."openCount" || ' open code violation' || (CASE WHEN sub."openCount" = 1 THEN '' ELSE 's' END)
        || CASE WHEN sub."hasLien" THEN ' · code lien recorded' ELSE '' END
        || CASE
             WHEN array_length(sub."categories", 1) > 0
             THEN ' · ' || array_to_string(sub."categories", '/')
             ELSE ''
           END
      ) AS "motivation",
      NOW() AS "computedAt"
    FROM (
      SELECT
        cv."countyFips",
        cv."parcelApn"                                                    AS "apn",
        COUNT(*) FILTER (WHERE cv."status" = 'open')::int                 AS "openCount",
        COUNT(*)::int                                                     AS "totalCount",
        BOOL_OR(cv."isLien")                                             AS "hasLien",
        MIN(cv."openedAt") FILTER (WHERE cv."status" = 'open')           AS "earliestOpenedAt",
        MAX(cv."openedAt") FILTER (WHERE cv."status" = 'open')           AS "latestOpenedAt",
        COALESCE(
          ARRAY(
            SELECT DISTINCT x FROM UNNEST(ARRAY_AGG(cv."category")) AS x
            WHERE x IS NOT NULL
            ORDER BY x
          ),
          ARRAY[]::text[]
        )                                                                AS "categories"
      FROM flipops."CodeViolation" cv
      WHERE cv."parcelApn" IS NOT NULL
        ${countyFilter}
      GROUP BY cv."countyFips", cv."parcelApn"
      -- Only summarize parcels with at least one OPEN violation (live distress).
      HAVING COUNT(*) FILTER (WHERE cv."status" = 'open') > 0
    ) sub
    ON CONFLICT ("countyFips", "apn") DO UPDATE SET
      "openCount"        = EXCLUDED."openCount",
      "totalCount"       = EXCLUDED."totalCount",
      "hasLien"          = EXCLUDED."hasLien",
      "earliestOpenedAt" = EXCLUDED."earliestOpenedAt",
      "latestOpenedAt"   = EXCLUDED."latestOpenedAt",
      "categories"       = EXCLUDED."categories",
      "score"            = EXCLUDED."score",
      "grade"            = EXCLUDED."grade",
      "motivation"       = EXCLUDED."motivation",
      "computedAt"       = NOW()
  `;

  const rowsAffected = await prisma.$executeRawUnsafe(sql);
  return { rowsAffected, durationMs: Date.now() - start, scopedTo: opts.countyFips };
}

async function main() {
  const countyArg = process.argv.indexOf("--county");
  const countyFips = countyArg >= 0 ? process.argv[countyArg + 1] : undefined;

  console.log(
    `[rescore-code-violations] refreshing CodeViolationSummary${countyFips ? ` (countyFips=${countyFips})` : " (all counties)"}`,
  );
  const result = await refreshCodeViolationSummary({ countyFips });
  console.log(
    `[rescore-code-violations] done: ${result.rowsAffected} rows affected in ${(result.durationMs / 1000).toFixed(1)}s`,
  );

  const dist = await prisma.$queryRaw<Array<{ grade: string | null; n: bigint }>>`
    SELECT "grade", COUNT(*)::bigint AS "n"
    FROM flipops."CodeViolationSummary"
    GROUP BY "grade"
    ORDER BY "grade" NULLS LAST`;
  console.log("\nGrade distribution:");
  for (const row of dist) {
    console.log(`  ${(row.grade ?? "(null)").padEnd(8)} ${row.n.toLocaleString()}`);
  }

  const counts = await prisma.$queryRaw<
    Array<{ countyFips: string; n: bigint; liens: bigint; topOpen: number }>
  >`
    SELECT "countyFips", COUNT(*)::bigint AS "n",
           COUNT(*) FILTER (WHERE "hasLien")::bigint AS "liens",
           MAX("openCount")::int AS "topOpen"
    FROM flipops."CodeViolationSummary"
    GROUP BY "countyFips"
    ORDER BY "n" DESC`;
  console.log("\nCounts by county:");
  for (const row of counts) {
    console.log(
      `  ${row.countyFips}  ${row.n.toString().padStart(8)}  liens=${row.liens}  maxOpen/parcel=${row.topOpen}`,
    );
  }

  // Spot-check the highest-openCount parcels.
  const top = await prisma.$queryRaw<
    Array<{ countyFips: string; apn: string; openCount: number; hasLien: boolean; score: number | null }>
  >`
    SELECT "countyFips", "apn", "openCount", "hasLien", "score"
    FROM flipops."CodeViolationSummary"
    ORDER BY "openCount" DESC, "score" DESC NULLS LAST
    LIMIT 10`;
  console.log("\nTop parcels by open-violation count:");
  for (const row of top) {
    console.log(
      `  ${row.countyFips}/${row.apn}  open=${row.openCount}  lien=${row.hasLien}  score=${row.score}`,
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
