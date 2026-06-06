/* eslint-disable no-console */
// Run scrapeRealAuctionsPlaywright LOCALLY against Pasco (best-case county)
// with an explicit auctionDate, then read back the persisted Foreclosure
// rows to check whether auctionDate landed.
//
// If auctionDate IS populated after this run → Railway is on stale code
// (force-rebuild). If NOT → bug is in the persist path; isolate further.

import { prisma } from "../lib/prisma";
import { scrapeRealAuctionsPlaywright } from "../lib/scrapers/vendors/realauction-playwright";

async function main() {
  const auctionDate = "06/05/2026"; // XHR probe confirmed Hillsborough has 5 W-area auctions this date
  console.log(`Running scrapeRealAuctionsPlaywright for Hillsborough foreclosure with auctionDate=${auctionDate}`);

  const before = await prisma.foreclosure.count({
    where: { countyFips: "12057", auctionDate: { not: null } },
  });
  console.log(`Before: Hillsborough rows with auctionDate set = ${before}`);

  const result = await scrapeRealAuctionsPlaywright({
    countyFips: "12057",
    track: "foreclosure",
    // useProxy=false — RealAuction's WAF 403s the DataImpulse residential pool.
    useProxy: false,
    auctionDate,
  });

  console.log("Scrape result:", JSON.stringify(result));

  // Read back the most-recently-touched Hillsborough rows
  const recent = await prisma.foreclosure.findMany({
    where: { countyFips: "12057" },
    orderBy: { capturedAt: "desc" },
    take: 10,
    select: {
      caseNumber: true,
      apn: true,
      stageCode: true,
      auctionDate: true,
      capturedAt: true,
    },
  });

  console.log("\nMost recent Hillsborough rows:");
  for (const r of recent) {
    const cap = r.capturedAt?.toISOString().slice(0, 19) ?? "null";
    const aud = r.auctionDate?.toISOString().slice(0, 10) ?? "null";
    console.log(`  ${cap}  case=${r.caseNumber}  apn=${(r.apn ?? "").slice(0, 25).padEnd(25)}  stage=${r.stageCode}  auctionDate=${aud}`);
  }

  const after = await prisma.foreclosure.count({
    where: { countyFips: "12057", auctionDate: { not: null } },
  });
  console.log(`\nAfter: Hillsborough rows with auctionDate set = ${after}`);
  console.log(after > before ? "✓ auctionDate IS being persisted by the new code path." : "✗ auctionDate is NOT being persisted — bug is in vendor file, NOT Railway deploy.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
