import type { Enricher, EnrichContext, EnrichResult } from "../enrichment";
import { distressSourcesFor } from "./distress-sources";

// ---------------------------------------------------------------------------
// Clerk Official Records enricher — the PREMIUM distress signal.
//
// Searches the county Clerk's Official Records for lis pendens (the actual
// foreclosure filing, dated, with case number — the earliest, most reliable
// distress trigger and what incumbents charge the most for) plus recorded
// mechanics/HOA/tax liens against the owner.
//
// Uses Firecrawl AI extraction so it works across bespoke clerk sites with no
// per-county parser. Searches by owner name (filled in by the appraiser
// enricher upstream). Degrades gracefully when the county isn't wired.
// ---------------------------------------------------------------------------

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

const RECORDS_SCHEMA = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          documentType: { type: "string", description: "e.g. Lis Pendens, Mortgage, Lien, Deed" },
          recordingDate: { type: "string" },
          caseNumber: { type: "string", description: "Court case / instrument number" },
          parties: { type: "string", description: "Grantor/grantee or plaintiff/defendant names" },
        },
      },
    },
  },
} as const;

export const clerkRecordsEnricher: Enricher = {
  name: "clerk_lis_pendens",
  needsOwnerName: true,

  async enrich(ctx: EnrichContext): Promise<EnrichResult | null> {
    const sources = distressSourcesFor(ctx.countyFips);
    if (!sources?.clerkRecordsUrl) return null; // county not wired
    if (!process.env.FIRECRAWL_API_KEY) return null;

    const query = sources.clerkSearchBy === "address" && ctx.address
      ? `${ctx.address.street}, ${ctx.address.city}`
      : ctx.ownerName;
    if (!query) return null;

    try {
      const res = await fetch(FIRECRAWL_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: sources.clerkRecordsUrl,
          onlyMainContent: true,
          proxy: "auto",
          timeout: 60000,
          formats: [
            {
              type: "json",
              schema: RECORDS_SCHEMA,
              prompt:
                `Search the county Official Records for "${query}" and extract any recorded ` +
                `documents — especially LIS PENDENS (foreclosure filings), mechanics liens, HOA liens, ` +
                `and tax liens. Return document type, recording date, case/instrument number, and parties.`,
            },
          ],
          // Many clerk sites need a search form filled before results render.
          actions:
            sources.clerkSearchBy === "owner_name"
              ? [
                  { type: "wait", milliseconds: 1500 },
                  { type: "write", selector: "input[type=text]", text: query },
                  { type: "press", key: "Enter" },
                  { type: "wait", milliseconds: 2500 },
                ]
              : undefined,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const records = (data?.data?.json?.records as Array<Record<string, unknown>>) ?? [];

      const distress: string[] = [];
      const liens = records.filter((r) =>
        /lien/i.test(String(r.documentType ?? "")),
      );
      const lisPendens = records.filter((r) =>
        /lis pendens|foreclosure/i.test(String(r.documentType ?? "")),
      );
      if (lisPendens.length > 0) distress.push("lis_pendens");
      if (liens.length > 0) distress.push("recorded_lien");

      return {
        sourceTag: `scraper:clerk-${ctx.countyFips}`,
        fields: {
          clerkRecordsFound: records.length,
          lisPendensCount: lisPendens.length,
          recordedLienCount: liens.length,
          // Store the raw records for the property timeline (stringified JSON).
          clerkRecords: records.slice(0, 20),
        },
        distressSignals: distress,
        confidence: 0.9, // authoritative court records, but name-match has some noise
      };
    } catch {
      return null;
    }
  },
};
