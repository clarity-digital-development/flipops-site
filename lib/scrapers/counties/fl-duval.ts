import { IasworldScraper } from "../vendors/iasworld";

// ---------------------------------------------------------------------------
// Duval County, FL (Jacksonville). FIPS 12031.
//
// The assessor (Duval County Property Appraiser) runs Tyler Technologies'
// iasWorld platform, so we extend IasworldScraper. Tax delinquency lists are
// published by the Tax Collector — separate URL, same general iasWorld layout.
//
// To onboard another iasWorld county, copy this file, change the FIPS / state
// / county / endpoint URLs, and (rarely) override parseParcelHtml or
// parseDelinquencyRow if the county has unusual table layouts.
// ---------------------------------------------------------------------------

export class DuvalFlScraper extends IasworldScraper {
  protected parserModule(): string {
    return "lib/scrapers/counties/fl-duval";
  }
}

/** Factory — used by the data-sources facade and cron jobs. */
export function buildDuvalFlScraper(): DuvalFlScraper {
  return new DuvalFlScraper({
    countyFips: "12031",
    state: "FL",
    county: "Duval",
    endpoints: {
      // Replace with real iasWorld URLs once verified against the live site.
      // These are placeholders that match the typical iasWorld URL pattern.
      search: "https://paopropertysearch.coj.net/Basic/Search.aspx",
      parcel: "https://paopropertysearch.coj.net/Basic/Datalets.aspx",
      delinquencyList: "https://taxcollector.coj.net/Delinquent/PropertyTax",
      taxBill: "https://taxcollector.coj.net/TaxBill",
    },
    rateLimitMs: 2000, // 2s between requests — extra polite to a single county
    maxPages: 100,
  });
}
