/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Refresh the AuctionSummary materialized aggregate.
//
// One row per (countyFips, apn) collapsing all Foreclosure rows for that
// parcel into a single materialized lead row. Foreclosure's unique key is
// (countyFips, caseNumber, stageCode, source) so a parcel can have many
// Foreclosure rows when auctions get rescheduled or captured across sources.
//
// Per the verifier of OPTION-A-LEADS-INTEGRATION-DESIGN.json (HG2):
//   nextAuctionDate := MIN(auctionDate WHERE stageCode='SCHEDULED' AND auctionDate > NOW())
//
// Score / grade / motivation are MATERIALIZED so the /api/properties UNION
// can ORDER BY score in SQL without an over-fetch-and-rescore loop. This is
// the linchpin (HG2) that makes API pagination tractable across virtual
// lead types.
//
// Idempotent: safe to run repeatedly (ON CONFLICT … DO UPDATE).
//
// Triggers:
//   1. End of every foreclosure scraper run (call from adapter or registry hook)
//   2. Daily safety-net cron (TBD lib/cron/discovery/auction-summary.ts)
//   3. Manual:  DATABASE_URL=... npx tsx scripts/rescore-auction.ts
//      Optional --county <FIPS> to scope to one county.
//
// Score formula (simple, per spec):
//   85 if nextAuctionDate IS NOT NULL    (live scheduled auction)
//   60 otherwise                          (history only — SOLD/DISMISSED)
//
// Grade thresholds (mirror distress-scorer.ts):
//   A >= 65 | B 50-64 | C 35-49 | D 20-34 | F <20
// ---------------------------------------------------------------------------

interface RescoreResult {
  rowsAffected: number;
  durationMs: number;
  scopedTo?: string;
}

export async function refreshAuctionSummary(opts: { countyFips?: string } = {}): Promise<RescoreResult> {
  const start = Date.now();

  const countyFilter = opts.countyFips
    ? `AND f."countyFips" = '${opts.countyFips.replace(/[^0-9]/g, "")}'` // sanitize: digits only
    : "";

  const sql = `
    INSERT INTO flipops."AuctionSummary" (
      "id", "countyFips", "apn",
      "nextAuctionDate", "pastAuctionCount", "scheduledCount",
      "judgmentAmountMax", "openingBidMin", "lastCaseNumber",
      "firstCapturedAt", "lastCapturedAt",
      "score", "grade", "motivation", "updatedAt"
    )
    SELECT
      'auc_' || md5(sub."countyFips" || '|' || sub."apn")        AS "id",
      sub."countyFips",
      sub."apn",
      sub."nextAuctionDate",
      sub."pastAuctionCount",
      sub."scheduledCount",
      sub."judgmentAmountMax",
      sub."openingBidMin",
      sub."lastCaseNumber",
      sub."firstCapturedAt",
      sub."lastCapturedAt",
      CASE WHEN sub."nextAuctionDate" IS NOT NULL THEN 85 ELSE 60 END AS "score",
      CASE
        WHEN (CASE WHEN sub."nextAuctionDate" IS NOT NULL THEN 85 ELSE 60 END) >= 65 THEN 'A'
        WHEN (CASE WHEN sub."nextAuctionDate" IS NOT NULL THEN 85 ELSE 60 END) >= 50 THEN 'B'
        WHEN (CASE WHEN sub."nextAuctionDate" IS NOT NULL THEN 85 ELSE 60 END) >= 35 THEN 'C'
        WHEN (CASE WHEN sub."nextAuctionDate" IS NOT NULL THEN 85 ELSE 60 END) >= 20 THEN 'D'
        ELSE 'F'
      END AS "grade",
      CASE
        WHEN sub."nextAuctionDate" IS NOT NULL THEN
          'Auction scheduled ' || TO_CHAR(sub."nextAuctionDate", 'YYYY-MM-DD')
        WHEN sub."pastAuctionCount" > 0 THEN
          'Foreclosure history (' || sub."pastAuctionCount" || ' past event' || (CASE WHEN sub."pastAuctionCount" = 1 THEN '' ELSE 's' END) || ')'
        ELSE 'Foreclosure filing'
      END AS "motivation",
      NOW() AS "updatedAt"
    FROM (
      SELECT
        f."countyFips",
        f."apn",
        (
          SELECT MIN(f2."auctionDate")
          FROM flipops."Foreclosure" f2
          WHERE f2."countyFips" = f."countyFips"
            AND f2."apn"        = f."apn"
            AND f2."stageCode"  = 'SCHEDULED'
            AND f2."auctionDate" > NOW()
        )                                                                    AS "nextAuctionDate",
        COUNT(*) FILTER (WHERE f."stageCode" IN ('SOLD','DISMISSED'))::int    AS "pastAuctionCount",
        COUNT(*) FILTER (WHERE f."stageCode" = 'SCHEDULED')::int              AS "scheduledCount",
        MAX(f."judgmentAmount")::float                                        AS "judgmentAmountMax",
        MIN(f."openingBid")::float                                            AS "openingBidMin",
        (ARRAY_AGG(f."caseNumber" ORDER BY f."capturedAt" DESC NULLS LAST))[1] AS "lastCaseNumber",
        MIN(f."capturedAt")                                                    AS "firstCapturedAt",
        MAX(f."capturedAt")                                                    AS "lastCapturedAt"
      FROM flipops."Foreclosure" f
      WHERE f."apn" IS NOT NULL
        AND f."apn" != ''
        AND f."apn" != 'Property Appraiser'
        ${countyFilter}
      GROUP BY f."countyFips", f."apn"
    ) sub
    ON CONFLICT ("countyFips", "apn") DO UPDATE SET
      "nextAuctionDate"   = EXCLUDED."nextAuctionDate",
      "pastAuctionCount"  = EXCLUDED."pastAuctionCount",
      "scheduledCount"    = EXCLUDED."scheduledCount",
      "judgmentAmountMax" = EXCLUDED."judgmentAmountMax",
      "openingBidMin"     = EXCLUDED."openingBidMin",
      "lastCaseNumber"    = EXCLUDED."lastCaseNumber",
      "firstCapturedAt"   = LEAST(flipops."AuctionSummary"."firstCapturedAt", EXCLUDED."firstCapturedAt"),
      "lastCapturedAt"    = GREATEST(flipops."AuctionSummary"."lastCapturedAt", EXCLUDED."lastCapturedAt"),
      "score"             = EXCLUDED."score",
      "grade"             = EXCLUDED."grade",
      "motivation"        = EXCLUDED."motivation",
      "updatedAt"         = NOW()
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

  console.log(
    `[rescore-auction] refreshing AuctionSummary${countyFips ? ` (countyFips=${countyFips})` : " (all counties)"}`,
  );
  const result = await refreshAuctionSummary({ countyFips });
  console.log(
    `[rescore-auction] done: ${result.rowsAffected} rows affected in ${(result.durationMs / 1000).toFixed(1)}s`,
  );

  // Distribution check
  const total = await prisma.$queryRaw<Array<{ n: bigint; withNext: bigint }>>`
    SELECT COUNT(*)::bigint AS "n",
           COUNT(*) FILTER (WHERE "nextAuctionDate" IS NOT NULL)::bigint AS "withNext"
    FROM flipops."AuctionSummary"`;
  console.log(
    `\nTotal rows: ${total[0].n.toString()} | with nextAuctionDate: ${total[0].withNext.toString()}`,
  );

  const dist = await prisma.$queryRaw<Array<{ grade: string | null; n: bigint }>>`
    SELECT "grade", COUNT(*)::bigint AS "n"
    FROM flipops."AuctionSummary"
    GROUP BY "grade"
    ORDER BY "grade" NULLS LAST`;
  console.log("\nGrade distribution:");
  for (const row of dist) {
    console.log(`  ${(row.grade ?? "(null)").padEnd(8)} ${row.n.toLocaleString()}`);
  }

  const sample = await prisma.$queryRaw<
    Array<{
      countyFips: string;
      apn: string;
      score: number | null;
      grade: string | null;
      nextAuctionDate: Date | null;
      motivation: string | null;
    }>
  >`
    SELECT "countyFips", "apn", "score", "grade", "nextAuctionDate", "motivation"
    FROM flipops."AuctionSummary"
    ORDER BY "score" DESC NULLS LAST, "nextAuctionDate" ASC NULLS LAST
    LIMIT 3`;
  console.log("\nSample (top 3 by score):");
  for (const row of sample) {
    console.log(
      `  ${row.countyFips} apn=${row.apn} score=${row.score} grade=${row.grade} next=${row.nextAuctionDate?.toISOString() ?? "(null)"} :: ${row.motivation}`,
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
