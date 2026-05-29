/* eslint-disable no-console */
import { scrapeRealAuctions } from "@/lib/scrapers/vendors/realauction";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// F2.2 RealAuction live smoke — Duval foreclosure auctions
// (duval.realforeclose.com). RealAuction calendars are public static pages
// listing upcoming + recently-resolved auctions. No form-driving needed —
// just fetch + extract. If this works, the same parser covers 16 wired
// FL counties via subdomain config.
//
// Run: npx tsx -r dotenv/config scripts/test-realauction-duval.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

const COUNTY_FIPS = "12031"; // Duval

async function main() {
  console.log(`=== RealAuction Duval foreclosure smoke ===\n`);

  const before = await prisma.foreclosure.count({ where: { countyFips: COUNTY_FIPS } });
  const liensBefore = await prisma.lien.count({ where: { countyFips: COUNTY_FIPS, lienCategory: "tax" } });
  console.log("Before — Duval Foreclosures:", before, "tax Liens:", liensBefore);

  console.log("\n→ Foreclosure track...");
  const t0 = Date.now();
  const foreResult = await scrapeRealAuctions({ countyFips: COUNTY_FIPS, track: "foreclosure" });
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s — found:`, foreResult?.foundAuctions, "persisted:", foreResult?.persistedForeclosures);

  console.log("\n→ Tax-deed track...");
  const t1 = Date.now();
  const taxResult = await scrapeRealAuctions({ countyFips: COUNTY_FIPS, track: "tax-deed" });
  console.log(`  ${((Date.now() - t1) / 1000).toFixed(1)}s — found:`, taxResult?.foundAuctions, "persisted-forec:", taxResult?.persistedForeclosures, "persisted-liens:", taxResult?.persistedLiens);

  const after = await prisma.foreclosure.count({ where: { countyFips: COUNTY_FIPS } });
  const liensAfter = await prisma.lien.count({ where: { countyFips: COUNTY_FIPS, lienCategory: "tax" } });
  console.log(`\nAfter — Duval Foreclosures: ${after} (+${after - before})`);
  console.log(`         Duval tax Liens:    ${liensAfter} (+${liensAfter - liensBefore})`);

  // Sample
  const sample = await prisma.foreclosure.findFirst({
    where: { countyFips: COUNTY_FIPS },
    orderBy: { capturedAt: "desc" },
  });
  if (sample) {
    console.log(`\nSample Foreclosure row:`);
    console.log(`  caseNumber:    ${sample.caseNumber}`);
    console.log(`  stageCode:     ${sample.stageCode}`);
    console.log(`  auctionDate:   ${sample.auctionDate?.toISOString().slice(0, 10) ?? 'n/a'}`);
    console.log(`  judgmentAmount: $${sample.judgmentAmount?.toLocaleString() ?? 'n/a'}`);
    console.log(`  openingBid:     $${sample.openingBid?.toLocaleString() ?? 'n/a'}`);
    console.log(`  plaintiff:     ${sample.plaintiffName ?? 'n/a'}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
