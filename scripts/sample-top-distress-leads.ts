/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// Quick demo-ready sample of the top distress leads from the new
// TaxDelinquencySummary aggregate, joined to Parcel for full context.
// This is the data the /api/properties UNION (Phase A4) will surface.

async function main() {
  const top = await prisma.$queryRaw<Array<{
    countyFips: string;
    apn: string;
    totalAmount: number;
    yearsCount: number;
    earliestYear: number;
    latestYear: number;
    score: number;
    grade: string;
    motivation: string;
    ownerName: string | null;
    situsAddress: string | null;
    situsCity: string | null;
    marketValue: number | null;
  }>>`
    SELECT
      s."countyFips", s."apn", s."totalAmount", s."yearsCount",
      s."earliestYear", s."latestYear", s."score", s."grade", s."motivation",
      p."ownerName", p."situsAddress", p."situsCity",
      p."marketValue"::float AS "marketValue"
    FROM flipops."TaxDelinquencySummary" s
    LEFT JOIN flipops."Parcel" p ON p."countyFips" = s."countyFips" AND p."apn" = s."apn"
    ORDER BY s."totalAmount" DESC
    LIMIT 10`;

  console.log("=== TOP 10 distress leads by amount owed ===\n");
  for (const r of top) {
    console.log(`Grade ${r.grade} | Score ${r.score} | ${r.countyFips} APN ${r.apn}`);
    console.log(`  ${r.ownerName ?? "(no parcel match)"}`);
    console.log(`  ${r.situsAddress ?? "(no address)"}, ${r.situsCity ?? ""}`);
    console.log(`  OWED $${r.totalAmount.toLocaleString()} across ${r.yearsCount} year(s) (${r.earliestYear}-${r.latestYear})`);
    if (r.marketValue) console.log(`  Market value $${r.marketValue.toLocaleString()}`);
    console.log(`  Motivation: ${r.motivation}`);
    console.log();
  }

  // Also: orphan-Lien check (verifier raised this as a gap)
  const orphans = await prisma.$queryRaw<Array<{ countyFips: string; n: bigint }>>`
    SELECT s."countyFips", COUNT(*)::bigint AS "n"
    FROM flipops."TaxDelinquencySummary" s
    LEFT JOIN flipops."Parcel" p ON p."countyFips" = s."countyFips" AND p."apn" = s."apn"
    WHERE p."id" IS NULL
    GROUP BY s."countyFips"
    ORDER BY "n" DESC`;
  const totalSummary = await prisma.taxDelinquencySummary.count();
  const totalOrphan = orphans.reduce((a, r) => a + Number(r.n), 0);
  console.log(`=== Orphan-Lien check (TaxDelinquencySummary rows with no matching Parcel) ===`);
  console.log(`Total summary rows: ${totalSummary.toLocaleString()}`);
  console.log(`Orphan rows:        ${totalOrphan.toLocaleString()}  (${((totalOrphan / totalSummary) * 100).toFixed(1)}%)`);
  for (const r of orphans) console.log(`  ${r.countyFips} ${r.n.toString().padStart(6)}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
