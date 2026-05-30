/* eslint-disable no-console */
import { scrapeOrangeTaxDelinquent } from "@/lib/scrapers/vendors/orange-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Orange (FL, FIPS 12095) delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({ where: { countyFips: "12095", lienCategory: "tax" } });
  console.log("Before — Orange tax liens:", before);

  const t0 = Date.now();
  const r = await scrapeOrangeTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Tax year:                ", r.taxYear);
  console.log("  Total pages:             ", r.totalPages);
  console.log("  Max Adv # observed:      ", r.totalReported.toLocaleString());
  console.log("  Records parsed:          ", r.found.toLocaleString());
  console.log("  Persisted:               ", r.persisted.toLocaleString());
  console.log("  Skipped (hallucinated):  ", r.skippedHallucinated);

  const after = await prisma.lien.count({ where: { countyFips: "12095", lienCategory: "tax" } });
  console.log(`\nAfter — Orange tax liens: ${after} (+${after - before})`);

  // Top 5 by amount, cross-referenced to Parcel
  const samples = await prisma.lien.findMany({
    where: { countyFips: "12095", lienCategory: "tax" },
    orderBy: { amount: "desc" },
    take: 5,
  });
  console.log("\nTop-5 by amount (cross-ref to Parcel):");
  for (const s of samples) {
    console.log(`  apn=${s.apn} docNum=${s.documentNumber} amount=$${s.amount?.toLocaleString()} owner=${s.defendantName}`);
    if (s.apn) {
      const parcel = await prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips: "12095", apn: s.apn } },
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
    WHERE l."countyFips" = '12095' AND l."lienCategory" = 'tax'`;
  console.log(`\n${joined[0].count} delinquent records JOIN to existing Parcel rows (cross-ref leads)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
