/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const byCounty = await prisma.foreclosure.groupBy({
    by: ["countyFips"],
    _count: true,
    where: { source: { startsWith: "scraper:realauction-pw" } },
  });
  console.log("Foreclosures by county (from F2.2 RealAuction):");
  for (const c of byCounty.sort((a, b) => b._count - a._count)) {
    console.log(`  ${c.countyFips}: ${c._count}`);
  }
  const total = await prisma.foreclosure.count({ where: { source: { startsWith: "scraper:realauction-pw" } } });
  console.log(`\nTotal real foreclosure rows: ${total}`);

  const top3 = await prisma.foreclosure.findMany({
    where: { source: { startsWith: "scraper:realauction-pw" }, judgmentAmount: { gt: 100000 } },
    orderBy: { judgmentAmount: "desc" },
    take: 3,
  });
  console.log("\nTop-3 by judgment amount:");
  top3.forEach((f) =>
    console.log(`  ${f.countyFips} case=${f.caseNumber} judgment=$${f.judgmentAmount?.toLocaleString()} maxBid=$${f.openingBid?.toLocaleString()} apn=${f.apn ?? "n/a"}`)
  );

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
