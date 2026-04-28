// ---------------------------------------------------------------------------
// Shared types for the scraper subsystem.
// ---------------------------------------------------------------------------

/** Categories of data we scrape. Aligned with Cotality's data dictionaries
 * but only the operationally-needed subset (per COTALITY-SUBSTITUTION-STRATEGY.md). */
export type ScrapeCategory =
  | "assessment"      // Property characteristics + assessed values
  | "tax_delinquency" // Active tax delinquencies + lien sales
  | "foreclosure"     // NOD, NOTS, court filings
  | "lien"            // Mechanics, HOA, federal/state tax liens
  | "permit"          // Building permits + code violations
  | "deed";           // Recent deed transfers

/** What every scrape returns. Property data is normalized into a flat shape
 * that the data-sources facade can stamp into PropertyDataPoint rows. */
export interface ScrapedProperty {
  /** Identifying fields — at least one of these must resolve to a Property record */
  apn?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  /** Owner */
  ownerName?: string;
  ownerMailingAddress?: string;
  ownerCorporate?: boolean;

  /** Assessment / values */
  assessedValue?: number;
  marketValue?: number;
  landValue?: number;
  improvementValue?: number;
  taxYear?: number;

  /** Structure */
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;

  /** Tax status */
  taxDelinquent?: boolean;
  taxDelinquentAmount?: number;
  taxDelinquentSince?: string; // ISO date

  /** Distress signals */
  foreclosure?: boolean;
  preForeclosure?: boolean;
  vacant?: boolean;
  bankruptcy?: boolean;

  /** Lien data — minimal shape; full lien details live in a separate rel */
  hasMechanicsLien?: boolean;
  hasHoaLien?: boolean;
  hasFederalTaxLien?: boolean;

  /** Last known transaction */
  lastSaleDate?: string;
  lastSalePrice?: number;

  /** Free-form bag for fields specific to a county that don't fit the schema */
  metadata?: Record<string, unknown>;
}

/** Output of a single scrape run. */
export interface ScrapeResult {
  category: ScrapeCategory;
  countyFips: string;
  records: ScrapedProperty[];
  recordsScraped: number;
  recordsUpserted: number;
  durationMs: number;
  warnings: string[];
}

/** Input config common to all scrapers. */
export interface ScraperConfig {
  countyFips: string;
  state: string;
  county: string;
  /** Per-county endpoint URLs; shape varies per scraperType */
  endpoints: Record<string, string>;
  /** Politeness — minimum ms between requests to this county's domain */
  rateLimitMs?: number;
  /** Optional residential proxy URL — falls back to direct fetch if absent */
  proxyUrl?: string;
  /** Cap pages per run; defaults to ~50 to avoid runaway scrapes */
  maxPages?: number;
}

/** Search query passed to scrapers that support address-level lookup. */
export interface AddressLookup {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/** Bulk pull params (e.g., "all tax-delinquent properties in this county"). */
export interface BulkScrapeParams {
  category: ScrapeCategory;
  /** Optional ZIP filter to narrow large counties */
  zip?: string;
  /** For pagination resumption */
  cursor?: string;
}
