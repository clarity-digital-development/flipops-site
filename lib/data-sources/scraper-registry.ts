import type { FirecrawlScraper } from "@/lib/scrapers/vendors/firecrawl";
import { buildDuvalFlScraper } from "@/lib/scrapers/counties/fl-duval";

// ---------------------------------------------------------------------------
// Registry of per-county appraiser scrapers (FirecrawlScraper-backed).
// Keyed by 5-digit county FIPS. Extend as counties are onboarded — each new
// county is a one-line addition once its config file exists.
// ---------------------------------------------------------------------------

const APPRAISER_SCRAPERS: Record<string, () => FirecrawlScraper> = {
  "12031": buildDuvalFlScraper, // Duval FL — verified end-to-end
};

export function getAppraiserScraper(countyFips: string): FirecrawlScraper | null {
  const factory = APPRAISER_SCRAPERS[countyFips];
  return factory ? factory() : null;
}

export function scrapeableAppraiserCounties(): string[] {
  return Object.keys(APPRAISER_SCRAPERS);
}
