import { prisma } from "@/lib/prisma";
import type { CountyScraper } from "@/lib/scrapers/base/county-scraper";
import { buildDuvalFlScraper } from "@/lib/scrapers/counties/fl-duval";

// ---------------------------------------------------------------------------
// data-sources — unified facade for "fetch field X for property Y from the
// cheapest fresh-enough source available."
//
// Resolution priority for any data point:
//   1. Recent (< staleness threshold) PropertyDataPoint row from a scraper
//   2. Recent PropertyDataPoint row from a paid API (BatchData / ATTOM)
//   3. Live scrape if we have a registered scraper for the county
//   4. Live API call as last resort
//   5. null if nothing produced data
//
// The point of this facade is to keep the rest of the codebase ignorant of
// which source is currently authoritative for a given field. As we onboard
// more counties to scrapers, the routing changes here, not in product code.
// ---------------------------------------------------------------------------

const SCRAPER_FACTORIES: Record<string, () => CountyScraper> = {
  // FIPS code → scraper factory. Extend this map as counties are onboarded.
  "12031": buildDuvalFlScraper,
};

/** Default freshness windows per field category (in milliseconds). */
const FRESHNESS_BY_FIELD: Record<string, number> = {
  tax_delinquent: 24 * 60 * 60 * 1000, // 1 day
  tax_delinquent_amount: 24 * 60 * 60 * 1000,
  foreclosure: 7 * 24 * 60 * 60 * 1000, // 1 week
  preForeclosure: 7 * 24 * 60 * 60 * 1000,
  bankruptcy: 30 * 24 * 60 * 60 * 1000, // 1 month
  assessed_value: 90 * 24 * 60 * 60 * 1000, // 1 quarter
  market_value: 30 * 24 * 60 * 60 * 1000,
  bedrooms: 365 * 24 * 60 * 60 * 1000, // 1 year
  bathrooms: 365 * 24 * 60 * 60 * 1000,
  square_feet: 365 * 24 * 60 * 60 * 1000,
  last_sale_price: 30 * 24 * 60 * 60 * 1000,
};

const DEFAULT_FRESHNESS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type DataSourceTag =
  | `scraper:${string}`
  | "batchdata"
  | "attom"
  | "manual"
  | "unknown";

export interface ResolvedField {
  field: string;
  value: unknown;
  source: DataSourceTag;
  fetchedAt: Date;
  fresh: boolean;
}

/**
 * Read a single field for a property, preferring the freshest scraper-sourced
 * value. Returns null if no source has the field.
 */
export async function resolveField(
  propertyId: string,
  field: string,
): Promise<ResolvedField | null> {
  const points = await prisma.propertyDataPoint.findMany({
    where: { propertyId, field },
    orderBy: { fetchedAt: "desc" },
  });
  if (points.length === 0) return null;

  // Prefer scraper-sourced over API-sourced.
  const scraperPoint = points.find((p) => p.source.startsWith("scraper:"));
  const chosen = scraperPoint ?? points[0];

  const freshnessMs = FRESHNESS_BY_FIELD[field] ?? DEFAULT_FRESHNESS;
  const ageMs = Date.now() - chosen.fetchedAt.getTime();
  const fresh = ageMs <= freshnessMs;

  return {
    field,
    value: safeParse(chosen.value),
    source: chosen.source as DataSourceTag,
    fetchedAt: chosen.fetchedAt,
    fresh,
  };
}

/**
 * Resolve many fields for one property at once. Used by the property detail
 * drawer / API serializer.
 */
export async function resolveFields(
  propertyId: string,
  fields: string[],
): Promise<Record<string, ResolvedField | null>> {
  const points = await prisma.propertyDataPoint.findMany({
    where: { propertyId, field: { in: fields } },
    orderBy: { fetchedAt: "desc" },
  });

  const out: Record<string, ResolvedField | null> = {};
  for (const f of fields) out[f] = null;

  for (const p of points) {
    if (out[p.field] !== null) continue; // already have a (newer) value
    const freshnessMs = FRESHNESS_BY_FIELD[p.field] ?? DEFAULT_FRESHNESS;
    const ageMs = Date.now() - p.fetchedAt.getTime();
    const isScraper = p.source.startsWith("scraper:");
    const existing = out[p.field];
    if (!existing || (isScraper && !(existing.source as string).startsWith("scraper:"))) {
      out[p.field] = {
        field: p.field,
        value: safeParse(p.value),
        source: p.source as DataSourceTag,
        fetchedAt: p.fetchedAt,
        fresh: ageMs <= freshnessMs,
      };
    }
  }
  return out;
}

/**
 * Trigger a live scrape for a county if we know how to. Caller is responsible
 * for choosing when this is worth doing (e.g. when stale data costs more than
 * the scrape itself).
 */
export async function refreshCounty(
  countyFips: string,
  category: "tax_delinquency" | "assessment" | "foreclosure" | "lien" | "permit" | "deed",
  triggerType: "cron" | "on_demand" | "user_request" = "on_demand",
): Promise<{ ok: boolean; message: string; recordsScraped?: number }> {
  const factory = SCRAPER_FACTORIES[countyFips];
  if (!factory) {
    return {
      ok: false,
      message: `No scraper registered for FIPS ${countyFips}. Add one in lib/scrapers/counties/.`,
    };
  }
  const scraper = factory();
  try {
    const result = await scraper.run(category, triggerType);
    return {
      ok: true,
      message: `Scraped ${result.recordsScraped} records from FIPS ${countyFips}`,
      recordsScraped: result.recordsScraped,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * List the counties we currently have scrapers registered for. Used by the
 * Settings → Data Sources admin view.
 */
export function listScrapeableCounties(): { countyFips: string; ready: boolean }[] {
  return Object.keys(SCRAPER_FACTORIES).map((fips) => ({
    countyFips: fips,
    ready: true,
  }));
}

// ---------------------------------------------------------------------------

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
