/* eslint-disable no-console */
import { scrapeRealAuctionsPlaywright } from "@/lib/scrapers/vendors/realauction-playwright";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== RealAuction Playwright smoke — Duval foreclosure ===\n");
  const before = await prisma.foreclosure.count({ where: { countyFips: "12031" } });
  console.log("Before:", before);

  const t0 = Date.now();
  const r = await scrapeRealAuctionsPlaywright({ countyFips: "12031", track: "foreclosure", useProxy: false });
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s elapsed`);
  console.log("Result:", r);

  const after = await prisma.foreclosure.count({ where: { countyFips: "12031" } });
  console.log(`\nAfter: ${after} (+${after - before})`);

  // Show 3 most recent
  const samples = await prisma.foreclosure.findMany({
    where: { countyFips: "12031" },
    orderBy: { capturedAt: "desc" },
    take: 3,
  });
  console.log("\nSamples:");
  samples.forEach((s) => {
    console.log(`  case=${s.caseNumber} stage=${s.stageCode} auctionDate=${s.auctionDate?.toISOString().slice(0, 16) ?? "n/a"} judgment=$${s.judgmentAmount?.toLocaleString() ?? "n/a"} maxBid=$${s.openingBid?.toLocaleString() ?? "n/a"} apn=${s.apn ?? "n/a"}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
