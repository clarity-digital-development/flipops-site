/* eslint-disable no-console */
import { scrapeBrowardTaxDelinquent } from "@/lib/scrapers/vendors/broward-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Broward delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({ where: { countyFips: "12011", lienCategory: "tax" } });
  console.log("Before — Broward tax liens:", before);

  const t0 = Date.now();
  const r = await scrapeBrowardTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Total reported by source:", r.totalReported.toLocaleString());
  console.log("  Records parsed:          ", r.found.toLocaleString());
  console.log("  Persisted:               ", r.persisted.toLocaleString());
  console.log("  Skipped (hallucinated):  ", r.skippedHallucinated);

  const after = await prisma.lien.count({ where: { countyFips: "12011", lienCategory: "tax" } });
  console.log(`\nAfter — Broward tax liens: ${after} (+${after - before})`);

  // Top-5 by amount with cross-reference to Parcel
  const samples = await prisma.lien.findMany({
    where: { countyFips: "12011", lienCategory: "tax" },
    orderBy: { amount: "desc" },
    take: 5,
  });
  console.log("\nTop-5 by amount:");
  for (const s of samples) {
    console.log(`  Folio=${s.apn} doc=${s.documentNumber} amount=$${s.amount?.toLocaleString()} owner=${s.defendantName}`);
    if (s.apn) {
      const parcel = await prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips: "12011", apn: s.apn } },
      });
      if (parcel) {
        console.log(`    → Parcel: ${parcel.ownerName} @ ${parcel.situsAddress}, ${parcel.situsCity}; market=$${parcel.marketValue?.toLocaleString()}`);
      } else {
        console.log("    → No matching parcel in our table");
      }
    }
  }

  // Cross-ref join count
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12011' AND l."lienCategory" = 'tax'`;
  const joinCount = Number(joined[0].count);
  const totalTax = await prisma.lien.count({ where: { countyFips: "12011", lienCategory: "tax" } });
  const joinRate = totalTax > 0 ? ((joinCount / totalTax) * 100).toFixed(1) : "n/a";
  console.log(`\n${joinCount}/${totalTax} delinquent records JOIN to existing Parcel rows (${joinRate}% join rate)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
