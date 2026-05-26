import { FirecrawlScraper } from "../vendors/firecrawl";

// ---------------------------------------------------------------------------
// Duval County, FL (Jacksonville). FIPS 12031.
//
// NOTE: Duval is NOT an iasWorld county — the Property Appraiser runs a custom
// ASP.NET site with GET-addressable detail pages:
//   https://paopropertysearch.coj.net/Basic/Detail.aspx?RE={parcelNumber}
//   https://paopropertysearch.coj.net/Basic/Search.aspx  (address search form)
//
// Real URLs verified 2026-04-28. Because every county's HTML is bespoke, we
// run Duval through Firecrawl's AI extraction rather than a hand-written parser.
// This is Tier 1 (open public access) — Firecrawl's basic proxy is sufficient.
//
// To migrate to a cheaper custom cheerio parser later (once Duval's query
// volume justifies it), extend CountyScraper directly and parse Detail.aspx.
// ---------------------------------------------------------------------------

export class DuvalFlScraper extends FirecrawlScraper {}

export function buildDuvalFlScraper(): DuvalFlScraper {
  return new DuvalFlScraper({
    countyFips: "12031",
    state: "FL",
    county: "Duval",
    endpoints: {
      detailUrlTemplate:
        "https://paopropertysearch.coj.net/Basic/Detail.aspx?RE={parcelId}",
      searchUrl: "https://paopropertysearch.coj.net/Basic/Search.aspx",
      // Duval Tax Collector publishes delinquent real-estate tax data separately.
      delinquencyListUrl: "https://taxcollector.coj.net/RealEstate/Delinquent",
    },
    rateLimitMs: 2000,
    maxPages: 100,
  });
}
