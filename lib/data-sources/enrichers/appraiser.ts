import type { Enricher, EnrichContext, EnrichResult } from "../enrichment";
import { getAppraiserScraper } from "../scraper-registry";

// ---------------------------------------------------------------------------
// Appraiser enricher — the highest-quality static record per county.
// Reuses the proven FirecrawlScraper (Duval verified end-to-end). Returns the
// richest current field set: owner, value, characteristics, last sale.
// ---------------------------------------------------------------------------

export const appraiserEnricher: Enricher = {
  name: "appraiser",

  async enrich(ctx: EnrichContext): Promise<EnrichResult | null> {
    const scraper = getAppraiserScraper(ctx.countyFips);
    if (!scraper) return null; // county not onboarded for appraiser scraping yet

    const scraped = ctx.apn
      ? await scraper.lookupByParcelId(ctx.apn)
      : ctx.address
        ? await scraper.lookupByAddress(ctx.address)
        : null;
    if (!scraped) return null;

    const fields: Record<string, unknown> = {
      ownerName: scraped.ownerName,
      ownerMailingAddress: scraped.ownerMailingAddress,
      situsAddress: scraped.address?.street,
      situsCity: scraped.address?.city,
      situsState: scraped.address?.state,
      situsZip: scraped.address?.zip,
      marketValue: scraped.marketValue,
      assessedValue: scraped.assessedValue,
      landValue: scraped.landValue,
      propertyType: scraped.propertyType,
      yearBuilt: scraped.yearBuilt,
      squareFeet: scraped.squareFeet,
      lotSize: scraped.lotSize,
      lastSalePrice: scraped.lastSalePrice,
      lastSaleYear: scraped.lastSaleDate
        ? Number(String(scraped.lastSaleDate).match(/\d{4}/)?.[0]) || undefined
        : undefined,
    };

    const distress: string[] = [];
    if (scraped.taxDelinquent) distress.push("tax_delinquent");
    if (scraped.vacant) distress.push("vacant");

    return {
      sourceTag: `scraper:appraiser-${ctx.countyFips}`,
      fields,
      distressSignals: distress,
      confidence: 0.95, // system of record, live
    };
  },
};
