import type { Enricher, EnrichContext, EnrichResult } from "../enrichment";
import { distressSourcesFor } from "./distress-sources";
import { captureRaw } from "../raw-capture";

// ---------------------------------------------------------------------------
// Tax Collector enricher — current delinquency status (the earliest financial
// distress signal). Firecrawl-extracts the county's delinquent-tax / certificate
// list, matched to this parcel by APN or owner. Degrades gracefully when the
// county's delinquency source isn't wired.
// ---------------------------------------------------------------------------

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

const DELINQUENCY_SCHEMA = {
  type: "object",
  properties: {
    delinquent: { type: "boolean", description: "Is this parcel/owner currently tax-delinquent?" },
    delinquentAmount: { type: "number", description: "Total delinquent tax owed" },
    delinquentYears: { type: "string", description: "Tax years owed" },
    certificateSold: { type: "boolean", description: "Has a tax certificate been sold on it?" },
  },
} as const;

export const taxCollectorEnricher: Enricher = {
  name: "tax_collector",
  needsOwnerName: true,

  async enrich(ctx: EnrichContext): Promise<EnrichResult | null> {
    const sources = distressSourcesFor(ctx.countyFips);
    if (!sources?.taxDelinquencyUrl) return null;
    if (!process.env.FIRECRAWL_API_KEY) return null;

    const query = ctx.apn ?? ctx.ownerName;
    if (!query) return null;

    try {
      const res = await fetch(FIRECRAWL_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: sources.taxDelinquencyUrl,
          onlyMainContent: true,
          proxy: "auto",
          timeout: 60000,
          formats: [
            {
              type: "json",
              schema: DELINQUENCY_SCHEMA,
              prompt:
                `Determine whether parcel/owner "${query}" appears on this county's delinquent ` +
                `real-estate tax list. Return delinquency status, amount owed, years owed, and ` +
                `whether a tax certificate has been sold.`,
            },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();

      // BRONZE: preserve the full delinquency response (immutable).
      void captureRaw({
        entityType: "parcel",
        source: "firecrawl",
        sourceTag: `scraper:taxcollector-${ctx.countyFips}`,
        category: "tax_delinquency",
        countyFips: ctx.countyFips,
        apn: ctx.apn,
        requestParams: { url: sources.taxDelinquencyUrl, query },
        rawResponse: data?.data ?? data,
      });

      const j = data?.data?.json ?? {};

      const distress: string[] = [];
      if (j.delinquent) distress.push("tax_delinquent");
      if (j.certificateSold) distress.push("tax_certificate_sold");

      return {
        sourceTag: `scraper:taxcollector-${ctx.countyFips}`,
        fields: {
          taxDelinquent: j.delinquent ?? undefined,
          taxDelinquentAmount: j.delinquentAmount ?? undefined,
          taxDelinquentYears: j.delinquentYears ?? undefined,
        },
        distressSignals: distress,
        confidence: 0.85,
      };
    } catch {
      return null;
    }
  },
};
