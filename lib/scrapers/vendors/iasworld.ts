import * as cheerio from "cheerio";
import { CountyScraper } from "../base/county-scraper";
import { fetchText } from "../base/http-client";
import type {
  AddressLookup,
  BulkScrapeParams,
  ScrapedProperty,
} from "../base/types";

// ---------------------------------------------------------------------------
// IasworldScraper — shared parser for counties running Tyler Technologies'
// "iasWorld" property assessment platform. ~400 US counties use this; one
// parser unlocks all of them with per-county endpoint config.
//
// Per-county subclasses provide:
//   - endpoints: { search, parcel, taxBill, delinquencyList }
//   - any county-specific HTML quirks (most counties stick close to default)
//
// Conventional iasWorld URL patterns we handle:
//   GET  {search}?street=...&city=...&zip=...    → list of parcel hits
//   GET  {parcel}/{parcelId}                     → parcel detail page
//   GET  {taxBill}/{parcelId}                    → tax bill page incl. delinquency
//   GET  {delinquencyList}?...                   → bulk delinquent list
//
// HTML extraction targets the standard iasWorld field labels (e.g. "Parcel
// ID", "Site Address", "Owner Name", "Total Assessed Value", "Living Area").
// ---------------------------------------------------------------------------

export abstract class IasworldScraper extends CountyScraper {
  protected scraperType(): string {
    return "iasworld";
  }

  // -----------------------------------------------------------------------
  // Address-level lookup
  // -----------------------------------------------------------------------

  async lookupByAddress(addr: AddressLookup): Promise<ScrapedProperty | null> {
    const searchUrl = this.buildSearchUrl(addr);
    const html = await fetchText(searchUrl, { rateLimitMs: this.rateLimitMs });
    const parcelId = this.extractFirstParcelIdFromSearch(html);
    if (!parcelId) return null;
    return this.fetchParcelDetail(parcelId, addr);
  }

  /** Subclass: build the search URL. Most counties accept ?street=...&zip=... */
  protected buildSearchUrl(addr: AddressLookup): string {
    const search = this.requireEndpoint("search");
    const params = new URLSearchParams({
      street: addr.street,
      city: addr.city,
      zip: addr.zip,
    });
    return `${search}?${params.toString()}`;
  }

  /** Subclass override if the search results page uses a different selector. */
  protected extractFirstParcelIdFromSearch(html: string): string | null {
    const $ = cheerio.load(html);
    // Common iasWorld pattern: a results table with parcel links like
    // /Datalets.aspx?KeyValue=12345 or /Parcel/12345
    const link = $("a[href*='KeyValue=']").first().attr("href")
      ?? $("a[href*='/Parcel/']").first().attr("href")
      ?? $("a[href*='ParcelID=']").first().attr("href");
    if (!link) return null;
    const match =
      link.match(/KeyValue=([^&]+)/) ??
      link.match(/\/Parcel\/([^/?#]+)/) ??
      link.match(/ParcelID=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // -----------------------------------------------------------------------
  // Parcel detail
  // -----------------------------------------------------------------------

  protected async fetchParcelDetail(
    parcelId: string,
    fallbackAddress?: AddressLookup,
  ): Promise<ScrapedProperty> {
    const parcelUrl = `${this.requireEndpoint("parcel")}/${encodeURIComponent(parcelId)}`;
    const html = await fetchText(parcelUrl, { rateLimitMs: this.rateLimitMs });
    return this.parseParcelHtml(html, parcelId, fallbackAddress);
  }

  /** Default iasWorld parcel HTML parser. Subclasses override to handle
   * county-specific labels or layout quirks. */
  protected parseParcelHtml(
    html: string,
    parcelId: string,
    fallbackAddress?: AddressLookup,
  ): ScrapedProperty {
    const $ = cheerio.load(html);
    const labelLookup = this.buildLabelLookup($);

    const fullAddress = labelLookup("Site Address") ?? labelLookup("Property Address");
    const ownerName = labelLookup("Owner Name") ?? labelLookup("Current Owner");
    const ownerMailing =
      labelLookup("Mailing Address") ?? labelLookup("Owner Mailing");

    const yearBuilt = parseIntSafe(labelLookup("Year Built") ?? labelLookup("Effective Year Built"));
    const sqft = parseIntSafe(
      labelLookup("Living Area") ??
      labelLookup("Heated Area") ??
      labelLookup("Total Living Area"),
    );
    const beds = parseIntSafe(labelLookup("Bedrooms") ?? labelLookup("Beds"));
    const baths = parseFloatSafe(labelLookup("Bathrooms") ?? labelLookup("Baths"));

    const assessedValue = parseMoney(
      labelLookup("Total Assessed Value") ?? labelLookup("Assessed Value"),
    );
    const marketValue = parseMoney(
      labelLookup("Total Market Value") ?? labelLookup("Just Value") ?? labelLookup("Market Value"),
    );
    const landValue = parseMoney(labelLookup("Land Value"));
    const improvementValue = parseMoney(
      labelLookup("Improvement Value") ?? labelLookup("Building Value"),
    );

    const lastSaleDate = labelLookup("Last Sale Date") ?? labelLookup("Sale Date");
    const lastSalePrice = parseMoney(
      labelLookup("Last Sale Price") ?? labelLookup("Sale Price"),
    );

    return {
      apn: parcelId,
      address: this.parseAddress(fullAddress) ?? fallbackAddress,
      ownerName: ownerName ?? undefined,
      ownerMailingAddress: ownerMailing ?? undefined,
      ownerCorporate: ownerName ? this.looksLikeCorporate(ownerName) : undefined,
      yearBuilt: yearBuilt ?? undefined,
      squareFeet: sqft ?? undefined,
      bedrooms: beds ?? undefined,
      bathrooms: baths ?? undefined,
      assessedValue: assessedValue ?? undefined,
      marketValue: marketValue ?? undefined,
      landValue: landValue ?? undefined,
      improvementValue: improvementValue ?? undefined,
      lastSaleDate: lastSaleDate ?? undefined,
      lastSalePrice: lastSalePrice ?? undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Bulk pulls (e.g. tax delinquency lists)
  // -----------------------------------------------------------------------

  async bulkPull(params: BulkScrapeParams): Promise<ScrapedProperty[]> {
    if (params.category === "tax_delinquency") {
      return this.pullTaxDelinquencyList(params);
    }
    if (params.category === "assessment") {
      // iasWorld assessment data is typically queried per-parcel, not in bulk.
      // For now return empty; counties with downloadable assessment rolls
      // implement this in their subclass.
      return [];
    }
    // Categories not supported by the default iasWorld pattern.
    return [];
  }

  protected async pullTaxDelinquencyList(
    params: BulkScrapeParams,
  ): Promise<ScrapedProperty[]> {
    const url = this.requireEndpoint("delinquencyList");
    const html = await fetchText(
      params.cursor ? `${url}?page=${params.cursor}` : url,
      { rateLimitMs: this.rateLimitMs },
    );
    const $ = cheerio.load(html);

    // iasWorld delinquency pages typically render as a sortable table where
    // each <tr> in tbody is one parcel. Subclasses override if the layout
    // differs or if the data is paginated via a different scheme.
    const records: ScrapedProperty[] = [];
    $("table.delinquent-list tbody tr, table.tax-delinquency tbody tr, table tbody tr").each((_, el) => {
      const $tr = $(el);
      const cells = $tr.find("td").map((__, td) => $(td).text().trim()).get();
      if (cells.length < 4) return;

      const parsed = this.parseDelinquencyRow(cells);
      if (parsed) records.push(parsed);
    });

    return records;
  }

  /** Subclass override if column layout differs from the iasWorld default. */
  protected parseDelinquencyRow(cells: string[]): ScrapedProperty | null {
    // Default iasWorld delinquency table column layout (best-effort):
    // [parcelId, ownerName, situsAddress, amountDue, yearOwed]
    const [parcelId, ownerName, situsAddress, amountDue] = cells;
    if (!parcelId || !situsAddress) return null;
    return {
      apn: parcelId,
      ownerName: ownerName || undefined,
      address: this.parseAddress(situsAddress),
      taxDelinquent: true,
      taxDelinquentAmount: parseMoney(amountDue) ?? undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  protected requireEndpoint(key: string): string {
    const url = this.config.endpoints[key];
    if (!url) {
      throw new Error(
        `[iasworld:${this.config.county}] missing endpoint "${key}" in config`,
      );
    }
    return url;
  }

  /** iasWorld pages use <th>Label</th><td>Value</td> tables. Build a
   * label → value lookup once per page. */
  private buildLabelLookup($: cheerio.CheerioAPI) {
    const map = new Map<string, string>();
    $("th, .label, .field-label").each((_, el) => {
      const $el = $(el);
      const label = $el.text().replace(/[:\s]+$/, "").trim();
      // Value is typically the next td or the next sibling
      const $val = $el.next("td").first();
      const value = $val.length ? $val.text().trim() : $el.parent().find("td").first().text().trim();
      if (label && value) map.set(label.toLowerCase(), value);
    });
    return (label: string): string | null => map.get(label.toLowerCase()) ?? null;
  }

  protected parseAddress(raw?: string | null) {
    if (!raw) return undefined;
    // Best-effort: "1234 Oak St, Jacksonville, FL 32205"
    const m = raw.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s*(\d{5})/);
    if (!m) return undefined;
    return { street: m[1].trim(), city: m[2].trim(), state: m[3], zip: m[4] };
  }

  protected looksLikeCorporate(name: string): boolean {
    return /\b(LLC|INC|CORP|TRUST|LP|LLP|FOUNDATION|ASSOCIATION|HOLDINGS)\b/i.test(name);
  }
}

// ---------------------------------------------------------------------------
// Local parsing utilities
// ---------------------------------------------------------------------------

function parseIntSafe(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatSafe(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseMoney(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
