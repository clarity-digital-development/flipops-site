/* eslint-disable no-console */
import { scrapePalmBeachTaxDelinquent } from "@/lib/scrapers/vendors/palm-beach-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Palm Beach delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({ where: { countyFips: "12099", lienCategory: "tax" } });
  console.log("Before — Palm Beach tax liens:", before);

  const t0 = Date.now();
  const r = await scrapePalmBeachTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Total PCN-bearing notices reported:", r.totalReported.toLocaleString());
  console.log("  Tax-deed notices filtered:        ", r.filteredTaxDeed.toLocaleString());
  console.log("  Records parsed:                   ", r.found.toLocaleString());
  console.log("  Persisted:                        ", r.persisted.toLocaleString());
  console.log("  Skipped (hallucinated):           ", r.skippedHallucinated);

  const after = await prisma.lien.count({ where: { countyFips: "12099", lienCategory: "tax" } });
  console.log(`\nAfter — Palm Beach tax liens: ${after} (+${after - before})`);

  // Top-5 by amount with cross-reference to Parcel
  const samples = await prisma.lien.findMany({
    where: { countyFips: "12099", lienCategory: "tax" },
    orderBy: { amount: "desc" },
    take: 5,
  });
  console.log("\nTop-5 by amount:");
  for (const s of samples) {
    console.log(`  PCN ${s.apn} docNum=${s.documentNumber} amount=$${s.amount?.toLocaleString()} owner=${s.defendantName}`);
    if (s.apn) {
      const parcel = await prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips: "12099", apn: s.apn } },
      });
      if (parcel) {
        console.log(
          `    → Parcel: ${parcel.ownerName} @ ${parcel.situsAddress}, ${parcel.situsCity}; market=$${parcel.marketValue?.toLocaleString() ?? "n/a"}`,
        );
      } else {
        console.log(`    → No matching parcel in our table`);
      }
    }
  }

  // Cross-ref join count
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12099' AND l."lienCategory" = 'tax'`;
  console.log(`\n${joined[0].count} delinquent records JOIN to existing Parcel rows (cross-ref leads)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
