import { CountyScraper } from "../base/county-scraper";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import type {
  AddressLookup,
  BulkScrapeParams,
  ScrapedProperty,
  ScraperConfig,
} from "../base/types";

// ---------------------------------------------------------------------------
// FirecrawlScraper — the universal scraper engine.
//
// Instead of writing per-county HTML parsers, this uses Firecrawl's /v2/scrape
// endpoint with LLM structured extraction: we hand Firecrawl a URL + a JSON
// schema describing ScrapedProperty, and it returns the structured data
// regardless of the county's HTML layout. Firecrawl handles JS rendering,
// proxy rotation, and captcha internally (Tier 1-3 in one shot).
//
// This is the FAST path: onboard a county by supplying its URL patterns, no
// parser code. For high-volume counties we later migrate to a custom cheerio
// scraper to drop the per-page Firecrawl cost — but Firecrawl gets us live
// nationally on day 1.
//
// County config supplies (via endpoints):
//   detailUrlTemplate  — e.g. "https://.../Detail.aspx?RE={parcelId}"  (GET-addressable detail page)
//   searchUrl          — search page URL (for form-based lookup via actions)
//   delinquencyListUrl — bulk tax-delinquency list page (optional)
// ---------------------------------------------------------------------------

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

// JSON Schema handed to Firecrawl's extractor. Maps 1:1 to ScrapedProperty.
// Firecrawl's LLM fills whatever it can find on the page; missing fields come
// back null and we drop them.
const PROPERTY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    apn: { type: "string", description: "Parcel number / APN / RE number" },
    ownerName: { type: "string", description: "Current property owner name" },
    ownerMailingAddress: { type: "string", description: "Owner mailing address if different from property" },
    situsStreet: { type: "string", description: "Property street address (house number + street)" },
    situsCity: { type: "string" },
    situsState: { type: "string", description: "2-letter state code" },
    situsZip: { type: "string" },
    bedrooms: { type: "number" },
    bathrooms: { type: "number" },
    squareFeet: { type: "number", description: "Heated/living area square feet" },
    yearBuilt: { type: "number" },
    lotSize: { type: "number", description: "Lot size in acres or square feet" },
    propertyType: { type: "string", description: "Use code / property type (e.g. Single Family)" },
    assessedValue: { type: "number", description: "Total assessed value" },
    marketValue: { type: "number", description: "Total market/just value" },
    landValue: { type: "number" },
    improvementValue: { type: "number", description: "Building/improvement value" },
    lastSaleDate: { type: "string", description: "Most recent sale date" },
    lastSalePrice: { type: "number", description: "Most recent sale price" },
    taxDelinquent: { type: "boolean", description: "Whether taxes are currently delinquent" },
    taxDelinquentAmount: { type: "number", description: "Amount of delinquent taxes owed" },
  },
} as const;

// Schema for bulk delinquency list pages — an array of minimal property rows.
const DELINQUENCY_LIST_SCHEMA = {
  type: "object",
  properties: {
    properties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          apn: { type: "string", description: "Parcel number" },
          ownerName: { type: "string" },
          situsAddress: { type: "string", description: "Full property address" },
          delinquentAmount: { type: "number", description: "Amount of delinquent taxes" },
        },
      },
    },
  },
} as const;

interface FirecrawlResponse {
  success: boolean;
  data?: {
    json?: Record<string, unknown>;
    metadata?: { statusCode?: number; error?: string | null };
    warning?: string | null;
  };
  error?: string;
}

export class FirecrawlScraper extends CountyScraper {
  constructor(config: ScraperConfig) {
    super(config);
  }

  protected scraperType(): string {
    return "firecrawl";
  }

  protected parserModule(): string {
    return "lib/scrapers/vendors/firecrawl";
  }

  private get apiKey(): string {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) {
      throw new Error(
        "FIRECRAWL_API_KEY is not set — add it to .env.local and Railway env",
      );
    }
    return key;
  }

  // -----------------------------------------------------------------------
  // Firecrawl scrape call
  // -----------------------------------------------------------------------

  private async firecrawlScrape(
    url: string,
    schema: object,
    prompt: string,
    extraActions?: unknown[],
    captureCtx?: { apn?: string; category?: string },
  ): Promise<Record<string, unknown> | null> {
    const body: Record<string, unknown> = {
      url,
      onlyMainContent: true,
      formats: [{ type: "json", schema, prompt }],
      // "auto" proxy lets Firecrawl escalate to residential/captcha-solving
      // only when the basic proxy is blocked — cheapest path that still works.
      proxy: "auto",
      timeout: 60_000,
    };
    if (extraActions) body.actions = extraActions;

    const res = await fetch(FIRECRAWL_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Firecrawl HTTP ${res.status} for ${url}`);
    }
    const json = (await res.json()) as FirecrawlResponse;
    if (!json.success) {
      throw new Error(`Firecrawl error: ${json.error ?? "unknown"}`);
    }

    // BRONZE LAYER: preserve the FULL Firecrawl response (json + markdown +
    // metadata), not just the extracted fields. Fire-and-forget.
    void captureRaw({
      entityType: "parcel",
      source: "firecrawl",
      sourceTag: `scraper:${captureCtx?.category ?? "appraiser"}-${this.config.countyFips}`,
      category: captureCtx?.category ?? "appraiser",
      countyFips: this.config.countyFips,
      apn: captureCtx?.apn,
      requestParams: { url, prompt },
      rawResponse: json.data ?? json,
    });

    return json.data?.json ?? null;
  }

  // -----------------------------------------------------------------------
  // Address lookup
  // -----------------------------------------------------------------------

  async lookupByAddress(addr: AddressLookup): Promise<ScrapedProperty | null> {
    // Strategy 1: if the county has a GET-addressable search-by-address page,
    // Firecrawl scrapes it directly. Many county sites accept query params.
    const searchUrl = this.config.endpoints.searchUrl;
    if (!searchUrl) {
      throw new Error(
        `[firecrawl:${this.config.county}] missing searchUrl endpoint`,
      );
    }

    // Use Firecrawl browser actions to fill the search form, submit, and
    // land on the result/detail page before extraction. This handles the
    // common ASP.NET postback search pattern (e.g. Duval's Detail.aspx).
    const actions = [
      { type: "wait", milliseconds: 1500 },
      { type: "write", selector: this.config.endpoints.searchInputSelector ?? "input[type=text]", text: `${addr.street}` },
      { type: "press", key: "Enter" },
      { type: "wait", milliseconds: 2500 },
    ];

    const data = await this.firecrawlScrape(
      searchUrl,
      PROPERTY_EXTRACTION_SCHEMA,
      `Extract the property record for the address "${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}". ` +
        `Return owner name, parcel/APN, assessed and market values, bed/bath/sqft, year built, ` +
        `last sale date and price, and whether taxes are delinquent.`,
      actions,
    );

    return this.normalize(data, addr);
  }

  /** Direct-detail lookup when we already know the parcel ID and the county
   * has a GET-addressable detail URL (e.g. Duval's Detail.aspx?RE={parcelId}). */
  async lookupByParcelId(parcelId: string): Promise<ScrapedProperty | null> {
    const template = this.config.endpoints.detailUrlTemplate;
    if (!template) {
      throw new Error(
        `[firecrawl:${this.config.county}] missing detailUrlTemplate endpoint`,
      );
    }
    const url = template.replace("{parcelId}", encodeURIComponent(parcelId));
    const data = await this.firecrawlScrape(
      url,
      PROPERTY_EXTRACTION_SCHEMA,
      `Extract the full property record from this county property detail page. ` +
        `Include owner name, parcel/APN, assessed and market values, bed/bath/sqft, ` +
        `year built, last sale date and price, and tax delinquency status.`,
      undefined,
      { apn: parcelId, category: "appraiser" },
    );
    return this.normalize(data);
  }

  // -----------------------------------------------------------------------
  // Bulk pull (tax delinquency lists)
  // -----------------------------------------------------------------------

  async bulkPull(params: BulkScrapeParams): Promise<ScrapedProperty[]> {
    if (params.category !== "tax_delinquency") {
      // Firecrawl can handle other list types too; add schemas as needed.
      return [];
    }
    const listUrl = this.config.endpoints.delinquencyListUrl;
    if (!listUrl) return [];

    const data = await this.firecrawlScrape(
      params.cursor ? `${listUrl}?page=${params.cursor}` : listUrl,
      DELINQUENCY_LIST_SCHEMA,
      `Extract every property in the tax-delinquency list on this page. For each, ` +
        `return parcel/APN, owner name, full property address, and the delinquent amount owed.`,
    );

    const rows = (data?.properties as Array<Record<string, unknown>>) ?? [];
    return rows
      .map((row) => this.normalizeDelinquencyRow(row))
      .filter((r): r is ScrapedProperty => r !== null);
  }

  // -----------------------------------------------------------------------
  // Normalization — Firecrawl JSON → ScrapedProperty
  // -----------------------------------------------------------------------

  private normalize(
    data: Record<string, unknown> | null,
    fallbackAddr?: AddressLookup,
  ): ScrapedProperty | null {
    if (!data) return null;

    const street = (data.situsStreet as string) ?? fallbackAddr?.street;
    const city = (data.situsCity as string) ?? fallbackAddr?.city;
    const state = (data.situsState as string) ?? fallbackAddr?.state;
    const zip = (data.situsZip as string) ?? fallbackAddr?.zip;

    const address =
      street && city && state && zip
        ? { street, city, state, zip }
        : fallbackAddr;

    return {
      apn: asString(data.apn),
      address,
      ownerName: asString(data.ownerName),
      ownerMailingAddress: asString(data.ownerMailingAddress),
      ownerCorporate: data.ownerName
        ? this.looksLikeCorporate(String(data.ownerName))
        : undefined,
      bedrooms: asNumber(data.bedrooms),
      bathrooms: asNumber(data.bathrooms),
      squareFeet: asNumber(data.squareFeet),
      yearBuilt: asNumber(data.yearBuilt),
      lotSize: asNumber(data.lotSize),
      propertyType: asString(data.propertyType),
      assessedValue: asNumber(data.assessedValue),
      marketValue: asNumber(data.marketValue),
      landValue: asNumber(data.landValue),
      improvementValue: asNumber(data.improvementValue),
      lastSaleDate: asString(data.lastSaleDate),
      lastSalePrice: asNumber(data.lastSalePrice),
      taxDelinquent: asBool(data.taxDelinquent),
      taxDelinquentAmount: asNumber(data.taxDelinquentAmount),
    };
  }

  private normalizeDelinquencyRow(
    row: Record<string, unknown>,
  ): ScrapedProperty | null {
    const situs = asString(row.situsAddress);
    if (!situs && !row.apn) return null;
    return {
      apn: asString(row.apn),
      ownerName: asString(row.ownerName),
      address: this.parseAddress(situs),
      taxDelinquent: true,
      taxDelinquentAmount: asNumber(row.delinquentAmount),
    };
  }

  private parseAddress(raw?: string) {
    if (!raw) return undefined;
    const m = raw.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s*(\d{5})/);
    if (!m) return undefined;
    return { street: m[1].trim(), city: m[2].trim(), state: m[3], zip: m[4] };
  }

  private looksLikeCorporate(name: string): boolean {
    return /\b(LLC|INC|CORP|TRUST|LP|LLP|FOUNDATION|ASSOCIATION|HOLDINGS|PROPERTIES)\b/i.test(name);
  }
}

// ---------------------------------------------------------------------------

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v).trim();
}

function asNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function asBool(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["true", "yes", "delinquent", "1"].includes(s)) return true;
  if (["false", "no", "current", "0"].includes(s)) return false;
  return undefined;
}
