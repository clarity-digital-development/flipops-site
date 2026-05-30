/* eslint-disable no-console */
import { scrapeDuvalTaxDelinquent } from "@/lib/scrapers/vendors/duval-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Duval delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({ where: { countyFips: "12031", lienCategory: "tax" } });
  console.log("Before — Duval tax liens:", before);

  const t0 = Date.now();
  const r = await scrapeDuvalTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Total reported by source:", r.totalReported.toLocaleString());
  console.log("  Records parsed:          ", r.found.toLocaleString());
  console.log("  Persisted:               ", r.persisted.toLocaleString());
  console.log("  Skipped (hallucinated):  ", r.skippedHallucinated);

  const after = await prisma.lien.count({ where: { countyFips: "12031", lienCategory: "tax" } });
  console.log(`\nAfter — Duval tax liens: ${after} (+${after - before})`);

  // Sample with cross-reference to Parcel
  const samples = await prisma.lien.findMany({
    where: { countyFips: "12031", lienCategory: "tax" },
    orderBy: { amount: "desc" },
    take: 3,
  });
  console.log("\nTop-3 by amount:");
  for (const s of samples) {
    console.log(`  RE#${s.apn} taxYear-from-docNum=${s.documentNumber} amount=$${s.amount?.toLocaleString()} owner=${s.defendantName}`);
    // Try to find the parcel
    if (s.apn) {
      const parcel = await prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips: "12031", apn: s.apn } },
      });
      if (parcel) {
        console.log(`    → Parcel: ${parcel.ownerName} @ ${parcel.situsAddress}, ${parcel.situsCity}; market=$${parcel.marketValue?.toLocaleString()}`);
      } else {
        console.log(`    → No matching parcel in our table`);
      }
    }
  }

  // Count parcel-joined leads (delinquent parcels we already have rich data on)
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12031' AND l."lienCategory" = 'tax'`;
  console.log(`\n${joined[0].count} delinquent records JOIN to existing Parcel rows (cross-ref leads)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
