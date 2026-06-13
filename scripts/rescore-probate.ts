/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Probate matcher + ProbateSummary materialized aggregate (M3.1 / Lane D2c).
//
// TWO set-based passes, both chunked per the OPERATIONS landmine (big UPDATEs
// ~150K rows; the Railway proxy silently kills long statements, so we scope by
// county + cap per-statement work):
//
//   1. matchProbateCasesToParcels()  — decedent → owner fuzzy join.
//      For each unmatched/refreshable ProbateCase, normalize the decedent name
//      the SAME way the parcel owner name is normalized (PROBATE-BUILD-SPEC §3)
//      and look for Parcel.ownerName hits within the SAME countyFips. Writes the
//      best-match tier (EXACT/STRONG/WEAK/NONE), confidence (1.0/0.8/0.5/null),
//      and the matched Parcel.apn array back onto ProbateCase. Returns the tier
//      histogram the local runner prints.
//
//   2. refreshProbateSummary()  — collapse EXACT/STRONG matched ProbateCases to
//      one ProbateSummary row per (countyFips, apn), materializing
//      score/grade/motivation so the /api/properties UNION can ORDER BY score
//      in SQL (the verifier linchpin — same contract as AuctionSummary /
//      TaxDelinquencySummary). WEAK stays on ProbateCase for later
//      disambiguation and never feeds the lead UNION.
//
// SCORING (materialized; mirrors rescore-auction.ts proximity-bucket SQL CASE):
//   The materialized score is for UNION ranking ONLY. distress-scorer.ts stays
//   authoritative for in-app + at-promote scoring (PROBATE-BUILD-SPEC §4). The
//   probate signals live in LIFE_EVENT_FAMILY (PROBATE_OPEN base ~22,
//   PROBATE_PR_APPOINTED peak ~28). We mirror those weights here with a
//   PR-appointment proximity boost (the peak-motivation window):
//     PR appointed within 90 days  → 28 + 4 = 32   (peak, A)
//     PR appointed (any/older)     → 28            (A bottom-ish)
//     open estate-admin case       → 22            (HIGH — gold-standard seller)
//     open non-estate-admin case   → 15            (guardianship/trust/other)
//   A STRONG (0.8) name match shaves a few points off vs EXACT (1.0) so an
//   unambiguous decedent→owner hit ranks above an ambiguous one. Capped 0..100.
//
// Grade thresholds (mirror distress-scorer.ts): A>=65 | B 50-64 | C 35-49 |
//   D 20-34 | F <20. Probate alone tops out ~32, so most probate-only rows are
//   grade D/C; the lead UNION SUMS probate with tax/foreclosure/code distress
//   on the same parcel — see distress-scorer.ts cross-family composition.
//
// Idempotent: both passes safe to re-run (UPDATE / ON CONFLICT … DO UPDATE).
//
// Triggers:
//   1. End of every probate scraper run (post-scrape hook).
//   2. Manual: DATABASE_URL=... npx tsx scripts/rescore-probate.ts
//      [--county <FIPS>] [--match-only] [--summary-only]
// ---------------------------------------------------------------------------

// Estate-admin case codes imply the decedent owned real property (the gold
// signal). Mirrors isEstateAdminCode() in lib/scrapers/vendors/probate-mvc.ts —
// kept in sync but inlined here so the rescore has no scraper dependency.
const ESTATE_ADMIN_CODES = ["FORMAL_ADMIN", "SUMMARY_ADMIN", "DISPOSITION_NO_ADMIN"];

export interface MatchResult {
  scanned: number;
  exact: number;
  strong: number;
  weak: number;
  none: number;
  durationMs: number;
}

export interface RescoreResult {
  rowsAffected: number;
  durationMs: number;
  scopedTo?: string;
}

const MATCH_CHUNK = 2_000; // ProbateCase rows per matcher statement (well under the proxy-kill window)

function digits(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Pure scoring helper — SINGLE source of truth for the materialized SQL score,
// exported for tests/scoring/probate-signal.test.ts. The SQL CASE below mirrors
// this exactly; keeping it as a TS function lets the test pin the contract
// without a DB round-trip.
// ---------------------------------------------------------------------------
export function scoreProbateRow(input: {
  caseTypeCode?: string | null;
  prAppointedAt?: Date | null;
  matchConfidence?: number | null;
  now?: Date;
}): { score: number; grade: "A" | "B" | "C" | "D" | "F" } {
  const now = input.now ?? new Date();
  const isEstate = !!input.caseTypeCode && ESTATE_ADMIN_CODES.includes(input.caseTypeCode);

  let base: number;
  if (input.prAppointedAt) {
    const daysOut = Math.round((input.prAppointedAt.getTime() - now.getTime()) / 86_400_000);
    // PR appointed: peak-motivation window. Recent appointment (within ~90d of
    // now, in either direction) gets the proximity boost.
    base = 28 + (Math.abs(daysOut) <= 90 ? 4 : 0); // PROBATE_PR_APPOINTED peak
  } else if (isEstate) {
    base = 22; // PROBATE_OPEN — open estate administration, decedent owned property
  } else {
    base = 15; // open non-estate-admin (guardianship/trust/other) — LIFE_EVENT placeholder weight
  }

  // STRONG name match (0.8) is less certain than EXACT (1.0): shave 2 pts so an
  // unambiguous decedent→owner hit ranks above an ambiguous one.
  const conf = input.matchConfidence ?? 1.0;
  const penalty = conf >= 1.0 ? 0 : conf >= 0.8 ? 2 : 4;

  const score = Math.max(0, Math.min(100, base - penalty));
  const grade: "A" | "B" | "C" | "D" | "F" =
    score >= 65 ? "A" : score >= 50 ? "B" : score >= 35 ? "C" : score >= 20 ? "D" : "F";
  return { score, grade };
}

// ---------------------------------------------------------------------------
// Pass 1 — decedent → owner fuzzy join.
//
// Both sides normalize identically (PROBATE-BUILD-SPEC §3): uppercase, strip
// punctuation + decedent tails (ESTATE OF / DECEASED / AKA …) + name suffixes
// (JR/SR/II…). ProbateCase.decedentNameNormalized is pre-computed by the
// scraper; we normalize Parcel.ownerName on the fly with the SAME rules in SQL.
// FL rolls store ownerName "LAST FIRST MIDDLE" and the scraper normalizes the
// decedent the same way, so a direct token-string compare works.
//
// Tiers (PROBATE-BUILD-SPEC §3): EXACT 1.0 = normalized equal, single parcel
// hit. STRONG 0.8 = normalized equal, 2-3 parcel hits (same owner, multiple
// parcels — common for estates). WEAK 0.5 = normalized equal but 4+ candidates
// (ambiguous common name) → stored but never auto-promoted. NONE = no hit.
//
// SQL strategy: one correlated subquery per chunk counts matching parcels +
// grabs the apn array. We keep the owner-name normalization in a shared CTE so
// it isn't recomputed per case. Chunked by ProbateCase.id keyset.
// ---------------------------------------------------------------------------
export async function matchProbateCasesToParcels(
  opts: { countyFips?: string } = {},
): Promise<MatchResult> {
  const start = Date.now();
  const countyFips = opts.countyFips ? digits(opts.countyFips) : undefined;
  const countyFilter = countyFips ? `AND pc."countyFips" = '${countyFips}'` : "";

  // Pull the candidate case ids (need a name to match on). Keyset-chunk to keep
  // each UPDATE statement bounded (proxy-kill window).
  const ids = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT pc."id"
       FROM flipops."ProbateCase" pc
      WHERE pc."decedentNameNormalized" IS NOT NULL
        AND pc."decedentNameNormalized" <> ''
        ${countyFilter}
      ORDER BY pc."id"`,
  );

  let exact = 0;
  let strong = 0;
  let weak = 0;
  let none = 0;

  for (let i = 0; i < ids.length; i += MATCH_CHUNK) {
    const chunk = ids.slice(i, i + MATCH_CHUNK).map((r) => `'${r.id.replace(/'/g, "''")}'`);
    if (chunk.length === 0) continue;

    // Per-chunk: compute the parcel-match aggregate for each case, then UPDATE
    // tier/confidence/matchedParcelApns and RETURNING the tier so we can tally.
    const rows = await prisma.$queryRawUnsafe<Array<{ matchTier: string }>>(
      `
      WITH owner_norm AS (
        SELECT
          p."countyFips",
          p."apn",
          -- Mirror normalizeDecedentName(): uppercase, strip decedent tails,
          -- strip punctuation, collapse whitespace, drop trailing suffix tokens.
          TRIM(REGEXP_REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(
                UPPER(COALESCE(p."ownerName", '')),
                '\\m(ESTATE OF|THE ESTATE OF|DECEASED|DCSD|ET AL|A/K/A|AKA|N/K/A|F/K/A)\\M', ' ', 'g'
              ),
              '[.,''"]', ' ', 'g'
            ),
            '\\s+', ' ', 'g'
          )) AS owner_core
        FROM flipops."Parcel" p
        WHERE p."ownerName" IS NOT NULL
          ${countyFips ? `AND p."countyFips" = '${countyFips}'` : ""}
      ),
      matched AS (
        SELECT
          pc."id",
          (SELECT COUNT(*)::int FROM owner_norm o
             WHERE o."countyFips" = pc."countyFips"
               AND o.owner_core = pc."decedentNameNormalized") AS hit_count,
          (SELECT ARRAY_AGG(o."apn") FROM (
              SELECT o2."apn" FROM owner_norm o2
               WHERE o2."countyFips" = pc."countyFips"
                 AND o2.owner_core = pc."decedentNameNormalized"
               LIMIT 25
           ) o)                                                AS apns
        FROM flipops."ProbateCase" pc
        WHERE pc."id" IN (${chunk.join(",")})
      )
      UPDATE flipops."ProbateCase" pc SET
        "matchedParcelApns" = COALESCE(m.apns, ARRAY[]::text[]),
        "matchTier" = CASE
          WHEN m.hit_count = 1            THEN 'EXACT'
          WHEN m.hit_count BETWEEN 2 AND 3 THEN 'STRONG'
          WHEN m.hit_count >= 4          THEN 'WEAK'
          ELSE 'NONE'
        END,
        "matchConfidence" = CASE
          WHEN m.hit_count = 1            THEN 1.0
          WHEN m.hit_count BETWEEN 2 AND 3 THEN 0.8
          WHEN m.hit_count >= 4          THEN 0.5
          ELSE NULL
        END,
        "updatedAt" = NOW()
      FROM matched m
      WHERE pc."id" = m."id"
      RETURNING pc."matchTier" AS "matchTier"
      `,
    );

    for (const r of rows) {
      if (r.matchTier === "EXACT") exact++;
      else if (r.matchTier === "STRONG") strong++;
      else if (r.matchTier === "WEAK") weak++;
      else none++;
    }
  }

  return {
    scanned: ids.length,
    exact,
    strong,
    weak,
    none,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Pass 2 — materialize ProbateSummary from EXACT/STRONG matched ProbateCases.
//
// One row per (countyFips, apn). UNNEST the matchedParcelApns array so a
// multi-parcel estate fans out to one summary row per parcel. Only EXACT/STRONG
// (matchConfidence >= 0.8) feed the lead UNION (PROBATE-BUILD-SPEC §3). Score is
// materialized via the same CASE the scoreProbateRow() helper encodes.
// ---------------------------------------------------------------------------
export async function refreshProbateSummary(
  opts: { countyFips?: string } = {},
): Promise<RescoreResult> {
  const start = Date.now();
  const countyFips = opts.countyFips ? digits(opts.countyFips) : undefined;
  const countyFilter = countyFips ? `AND pc."countyFips" = '${countyFips}'` : "";

  const sql = `
    INSERT INTO flipops."ProbateSummary" (
      "id", "countyFips", "apn",
      "caseCount", "primaryCaseNumber", "decedentName", "personalRepresentative",
      "caseTypeCode", "filedAt", "prAppointedAt", "dateOfDeath", "status", "matchConfidence",
      "score", "grade", "motivation", "firstCapturedAt", "updatedAt"
    )
    SELECT
      'prb_' || md5(sub."countyFips" || '|' || sub."apn")        AS "id",
      sub."countyFips",
      sub."apn",
      sub."caseCount",
      sub."primaryCaseNumber",
      sub."decedentName",
      sub."personalRepresentative",
      sub."caseTypeCode",
      sub."filedAt",
      sub."prAppointedAt",
      sub."dateOfDeath",
      sub."status",
      sub."matchConfidence",
      LEAST(100, GREATEST(0,
        (CASE
           WHEN sub."prAppointedAt" IS NOT NULL THEN
             28 + (CASE WHEN ABS(EXTRACT(EPOCH FROM (sub."prAppointedAt" - NOW())) / 86400) <= 90 THEN 4 ELSE 0 END)
           WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 22
           ELSE 15
         END)
        - (CASE WHEN sub."matchConfidence" >= 1.0 THEN 0
                WHEN sub."matchConfidence" >= 0.8 THEN 2
                ELSE 4 END)
      ))::int AS "score",
      CASE
        WHEN LEAST(100, GREATEST(0,
          (CASE
             WHEN sub."prAppointedAt" IS NOT NULL THEN
               28 + (CASE WHEN ABS(EXTRACT(EPOCH FROM (sub."prAppointedAt" - NOW())) / 86400) <= 90 THEN 4 ELSE 0 END)
             WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 22
             ELSE 15
           END)
          - (CASE WHEN sub."matchConfidence" >= 1.0 THEN 0
                  WHEN sub."matchConfidence" >= 0.8 THEN 2
                  ELSE 4 END)
        )) >= 65 THEN 'A'
        WHEN LEAST(100, GREATEST(0,
          (CASE
             WHEN sub."prAppointedAt" IS NOT NULL THEN
               28 + (CASE WHEN ABS(EXTRACT(EPOCH FROM (sub."prAppointedAt" - NOW())) / 86400) <= 90 THEN 4 ELSE 0 END)
             WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 22
             ELSE 15
           END)
          - (CASE WHEN sub."matchConfidence" >= 1.0 THEN 0
                  WHEN sub."matchConfidence" >= 0.8 THEN 2
                  ELSE 4 END)
        )) >= 50 THEN 'B'
        WHEN LEAST(100, GREATEST(0,
          (CASE
             WHEN sub."prAppointedAt" IS NOT NULL THEN
               28 + (CASE WHEN ABS(EXTRACT(EPOCH FROM (sub."prAppointedAt" - NOW())) / 86400) <= 90 THEN 4 ELSE 0 END)
             WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 22
             ELSE 15
           END)
          - (CASE WHEN sub."matchConfidence" >= 1.0 THEN 0
                  WHEN sub."matchConfidence" >= 0.8 THEN 2
                  ELSE 4 END)
        )) >= 35 THEN 'C'
        WHEN LEAST(100, GREATEST(0,
          (CASE
             WHEN sub."prAppointedAt" IS NOT NULL THEN
               28 + (CASE WHEN ABS(EXTRACT(EPOCH FROM (sub."prAppointedAt" - NOW())) / 86400) <= 90 THEN 4 ELSE 0 END)
             WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 22
             ELSE 15
           END)
          - (CASE WHEN sub."matchConfidence" >= 1.0 THEN 0
                  WHEN sub."matchConfidence" >= 0.8 THEN 2
                  ELSE 4 END)
        )) >= 20 THEN 'D'
        ELSE 'F'
      END AS "grade",
      (
        CASE
          WHEN sub."prAppointedAt" IS NOT NULL THEN 'Probate — PR appointed ' || TO_CHAR(sub."prAppointedAt", 'YYYY-MM-DD')
          WHEN sub."caseTypeCode" IN ('FORMAL_ADMIN','SUMMARY_ADMIN','DISPOSITION_NO_ADMIN') THEN 'Open estate administration'
          ELSE 'Open probate case'
        END
        || CASE WHEN sub."caseCount" > 1
                THEN ' (' || sub."caseCount" || ' cases)'
                ELSE '' END
      ) AS "motivation",
      sub."firstCapturedAt",
      NOW() AS "updatedAt"
    FROM (
      SELECT
        pc."countyFips",
        apn.val                                                              AS "apn",
        COUNT(*)::int                                                        AS "caseCount",
        (ARRAY_AGG(pc."caseNumber" ORDER BY pc."prAppointedAt" DESC NULLS LAST, pc."filedAt" DESC NULLS LAST))[1] AS "primaryCaseNumber",
        (ARRAY_AGG(pc."decedentName" ORDER BY pc."prAppointedAt" DESC NULLS LAST, pc."filedAt" DESC NULLS LAST))[1] AS "decedentName",
        (ARRAY_AGG(pc."personalRepresentative" ORDER BY pc."prAppointedAt" DESC NULLS LAST, pc."filedAt" DESC NULLS LAST))[1] AS "personalRepresentative",
        (ARRAY_AGG(pc."caseTypeCode" ORDER BY pc."prAppointedAt" DESC NULLS LAST, pc."filedAt" DESC NULLS LAST))[1] AS "caseTypeCode",
        MIN(pc."filedAt")                                                    AS "filedAt",
        MAX(pc."prAppointedAt")                                              AS "prAppointedAt",
        MAX(pc."decedentDateOfDeath")                                        AS "dateOfDeath",
        (ARRAY_AGG(pc."status" ORDER BY pc."prAppointedAt" DESC NULLS LAST, pc."filedAt" DESC NULLS LAST))[1] AS "status",
        MAX(pc."matchConfidence")                                           AS "matchConfidence",
        MIN(pc."capturedAt")                                                 AS "firstCapturedAt"
      FROM flipops."ProbateCase" pc
      CROSS JOIN LATERAL UNNEST(pc."matchedParcelApns") AS apn(val)
      WHERE pc."matchConfidence" IS NOT NULL
        AND pc."matchConfidence" >= 0.8            -- EXACT/STRONG only (PROBATE-BUILD-SPEC §3)
        AND apn.val IS NOT NULL
        AND apn.val <> ''
        ${countyFilter}
      GROUP BY pc."countyFips", apn.val
    ) sub
    ON CONFLICT ("countyFips", "apn") DO UPDATE SET
      "caseCount"              = EXCLUDED."caseCount",
      "primaryCaseNumber"      = EXCLUDED."primaryCaseNumber",
      "decedentName"           = EXCLUDED."decedentName",
      "personalRepresentative" = EXCLUDED."personalRepresentative",
      "caseTypeCode"           = EXCLUDED."caseTypeCode",
      "filedAt"                = EXCLUDED."filedAt",
      "prAppointedAt"          = EXCLUDED."prAppointedAt",
      "dateOfDeath"            = EXCLUDED."dateOfDeath",
      "status"                 = EXCLUDED."status",
      "matchConfidence"        = EXCLUDED."matchConfidence",
      "score"                  = EXCLUDED."score",
      "grade"                  = EXCLUDED."grade",
      "motivation"             = EXCLUDED."motivation",
      "firstCapturedAt"        = LEAST(flipops."ProbateSummary"."firstCapturedAt", EXCLUDED."firstCapturedAt"),
      "updatedAt"              = NOW()
  `;

  const rowsAffected = await prisma.$executeRawUnsafe(sql);
  return { rowsAffected, durationMs: Date.now() - start, scopedTo: countyFips };
}

async function main() {
  const countyArg = process.argv.indexOf("--county");
  const countyFips = countyArg >= 0 ? process.argv[countyArg + 1] : undefined;
  const summaryOnly = process.argv.includes("--summary-only");
  const matchOnly = process.argv.includes("--match-only");

  if (!summaryOnly) {
    console.log(`[rescore-probate] matching ProbateCase → Parcel${countyFips ? ` (countyFips=${countyFips})` : " (all counties)"}`);
    const m = await matchProbateCasesToParcels({ countyFips });
    console.log(
      `[rescore-probate] match done: scanned=${m.scanned} EXACT=${m.exact} STRONG=${m.strong} WEAK=${m.weak} NONE=${m.none} in ${(m.durationMs / 1000).toFixed(1)}s`,
    );
  }

  if (!matchOnly) {
    console.log(`[rescore-probate] refreshing ProbateSummary${countyFips ? ` (countyFips=${countyFips})` : " (all counties)"}`);
    const r = await refreshProbateSummary({ countyFips });
    console.log(`[rescore-probate] summary done: ${r.rowsAffected} rows affected in ${(r.durationMs / 1000).toFixed(1)}s`);

    const dist = await prisma.$queryRaw<Array<{ grade: string | null; n: bigint }>>`
      SELECT "grade", COUNT(*)::bigint AS "n"
      FROM flipops."ProbateSummary"
      GROUP BY "grade"
      ORDER BY "grade" NULLS LAST`;
    console.log("\nGrade distribution:");
    for (const row of dist) {
      console.log(`  ${(row.grade ?? "(null)").padEnd(8)} ${row.n.toLocaleString()}`);
    }
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
