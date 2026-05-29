/* eslint-disable no-console */
import { scrapeRecentRecordings } from "@/lib/scrapers/vendors/clerk-recordings";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Phase F2.1 smoke test: bulk-scrape the past 3 days of Duval Clerk
// Official Records, classify into Mortgage/Lien/Foreclosure, persist.
//
// Cost: ~1-3 Firecrawl credits (depends on result paginating). Don't run
// this casually — designed for verification, not steady-state ingest.
//
// Run: npx tsx -r dotenv/config scripts/test-clerk-recordings-duval.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

const COUNTY_FIPS = "12031"; // Duval
const DAYS_BACK = 3;

async function main() {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);

  console.log(`=== Duval Clerk Recordings — last ${DAYS_BACK} days ===`);
  console.log(`Range: ${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)}\n`);

  // Counts before
  const [mBefore, lBefore, fBefore] = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: COUNTY_FIPS } }),
    prisma.lien.count({ where: { countyFips: COUNTY_FIPS } }),
    prisma.foreclosure.count({ where: { countyFips: COUNTY_FIPS } }),
  ]);
  console.log("Before — Duval Mortgages:", mBefore, "Liens:", lBefore, "Foreclosures:", fBefore);

  const t0 = Date.now();
  const result = await scrapeRecentRecordings({
    countyFips: COUNTY_FIPS,
    fromDate,
    toDate,
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!result) {
    console.log("\n✗ County not wired in CLERK_RECORDING_SOURCES");
    process.exit(2);
  }

  console.log(`\nFirecrawl run: ${elapsed}s`);
  console.log("Recordings found:", result.found);
  console.log("Persisted:");
  console.log("  Mortgages:    +" + result.persistedMortgages);
  console.log("  Liens:        +" + result.persistedLiens);
  console.log("  Foreclosures: +" + result.persistedForeclosures);

  // Counts after
  const [mAfter, lAfter, fAfter] = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: COUNTY_FIPS } }),
    prisma.lien.count({ where: { countyFips: COUNTY_FIPS } }),
    prisma.foreclosure.count({ where: { countyFips: COUNTY_FIPS } }),
  ]);
  console.log(`\nAfter — Duval Mortgages: ${mAfter} (+${mAfter - mBefore})`);
  console.log(`         Duval Liens:     ${lAfter} (+${lAfter - lBefore})`);
  console.log(`         Duval Foreclos.: ${fAfter} (+${fAfter - fBefore})`);

  // Show a sample of each kind
  const recentMortgage = await prisma.mortgage.findFirst({ where: { countyFips: COUNTY_FIPS }, orderBy: { capturedAt: "desc" } });
  if (recentMortgage) {
    console.log(`\nSample mortgage:`, {
      docNum: recentMortgage.documentNumber,
      date: recentMortgage.recordingDate.toISOString().slice(0, 10),
      amount: recentMortgage.loanAmount,
      lender: recentMortgage.lenderName?.slice(0, 40),
    });
  }
  const recentLien = await prisma.lien.findFirst({ where: { countyFips: COUNTY_FIPS }, orderBy: { capturedAt: "desc" } });
  if (recentLien) {
    console.log(`Sample lien:`, {
      category: recentLien.lienCategory,
      date: recentLien.recordingDate.toISOString().slice(0, 10),
      amount: recentLien.amount,
      plaintiff: recentLien.plaintiffName?.slice(0, 40),
    });
  }
  const recentForeclosure = await prisma.foreclosure.findFirst({ where: { countyFips: COUNTY_FIPS }, orderBy: { capturedAt: "desc" } });
  if (recentForeclosure) {
    console.log(`Sample foreclosure:`, {
      stage: recentForeclosure.stageCode,
      filing: recentForeclosure.filingDate?.toISOString().slice(0, 10),
      amount: recentForeclosure.judgmentAmount,
      caseNumber: recentForeclosure.caseNumber,
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
