/**
 * Smoke-test the Duval FL scraper end-to-end against the live site + DB.
 * Run: DATABASE_URL=... FIRECRAWL_API_KEY=... npx tsx scripts/test-duval-scraper.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { buildDuvalFlScraper } from "../lib/scrapers/counties/fl-duval";
import { prisma } from "../lib/prisma";

async function main() {
  const scraper = buildDuvalFlScraper();

  console.log("1) lookupByParcelId against real Duval site (Firecrawl-backed)...");
  const result = await scraper.lookupByParcelId("0224370000");
  console.log("   →", JSON.stringify(result));

  console.log("\n2) full run() — registers county + writes ScrapeJob audit row...");
  try {
    const r = await scraper.run("tax_delinquency", "user_request");
    console.log(`   → scraped ${r.recordsScraped}, upserted ${r.recordsUpserted}, ${r.durationMs}ms`);
  } catch (e) {
    console.log("   → run() error (OK if delinquency URL unverified):", e instanceof Error ? e.message : e);
  }

  const row = await prisma.countyScraper.findUnique({ where: { countyFips: "12031" } });
  console.log(
    "\n3) CountyScraper row:",
    row ? `${row.county} status=${row.status} type=${row.scraperType} errors=${row.errorCount}` : "NOT FOUND",
  );
  const jobs = await prisma.scrapeJob.count({ where: { scraper: { countyFips: "12031" } } });
  console.log("   ScrapeJob audit rows:", jobs);

  await prisma.$disconnect();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
