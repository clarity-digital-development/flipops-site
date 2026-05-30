/* eslint-disable no-console */
import { scrapeMiamiDadeTaxDelinquent } from "@/lib/scrapers/vendors/miami-dade-tax-delinquent";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Miami-Dade delinquent real-estate tax scrape ===\n");
  const before = await prisma.lien.count({ where: { countyFips: "12086", lienCategory: "tax" } });
  console.log("Before — Miami-Dade tax liens:", before);

  const t0 = Date.now();
  const r = await scrapeMiamiDadeTaxDelinquent();
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\nResult (${elapsed.toFixed(1)}s):`);
  console.log("  Total reported (max seq):", r.totalReported.toLocaleString());
  console.log("  Records parsed:          ", r.found.toLocaleString());
  console.log("  Persisted:               ", r.persisted.toLocaleString());
  console.log("  Skipped (hallucinated):  ", r.skippedHallucinated);

  const after = await prisma.lien.count({ where: { countyFips: "12086", lienCategory: "tax" } });
  console.log(`\nAfter — Miami-Dade tax liens: ${after} (+${after - before})`);

  // Top-5 by amount with cross-reference
  const top5 = await prisma.lien.findMany({
    where: { countyFips: "12086", lienCategory: "tax" },
    orderBy: { amount: "desc" },
    take: 5,
  });
  console.log("\nTop-5 by delinquent amount:");
  for (const s of top5) {
    console.log(`  apn=${s.apn}  docNum=${s.documentNumber}  amount=$${s.amount?.toLocaleString()}  owner="${s.defendantName}"`);
    if (s.apn) {
      const parcel = await prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips: "12086", apn: s.apn } },
      });
      if (parcel) {
        console.log(`    → Parcel: ${parcel.ownerName} @ ${parcel.situsAddress}, ${parcel.situsCity}; market=$${parcel.marketValue?.toLocaleString()}`);
      } else {
        console.log(`    → No matching parcel in our table`);
      }
    }
  }

  // JOIN-rate sanity check
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12086' AND l."lienCategory" = 'tax'`;
  const joinedCount = Number(joined[0].count);
  const joinRate = after > 0 ? ((joinedCount / after) * 100).toFixed(2) : "0.00";
  console.log(`\n${joinedCount.toLocaleString()} of ${after.toLocaleString()} delinquent records JOIN to existing Parcel rows (${joinRate}%)`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
