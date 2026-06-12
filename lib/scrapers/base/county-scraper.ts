import { prisma } from "@/lib/prisma";
import type {
  AddressLookup,
  BulkScrapeParams,
  ScrapeCategory,
  ScrapeResult,
  ScrapedProperty,
  ScraperConfig,
} from "./types";

// ---------------------------------------------------------------------------
// Abstract base class for county scrapers. Concrete scrapers either:
//   - extend this directly (custom per-county sites), or
//   - extend a vendor-specific class (IasworldScraper, PatriotScraper, etc.)
//     which itself extends CountyScraper.
//
// Subclasses implement at minimum:
//   - lookupByAddress(addr) — resolve a single property
//   - bulkPull(params)    — pull lists (tax delinquencies, recent foreclosures, etc.)
//
// The base provides:
//   - upsert helpers that write into Property + PropertyDataPoint
//   - run() entry point that wraps a scrape in a ScrapeJob audit row
//   - normalize() helper for turning raw HTML/PDF text into ScrapedProperty
// ---------------------------------------------------------------------------

export abstract class CountyScraper {
  constructor(public readonly config: ScraperConfig) {}

  // -----------------------------------------------------------------------
  // Subclass surface
  // -----------------------------------------------------------------------

  /** Subclass: look up a single property by street address. Returns null if
   * the county can't find it. Throws on transport/parse errors. */
  abstract lookupByAddress(
    addr: AddressLookup,
  ): Promise<ScrapedProperty | null>;

  /** Subclass: pull a list of properties matching the given criteria
   * (e.g. all tax-delinquent records for the county, paginated). */
  abstract bulkPull(params: BulkScrapeParams): Promise<ScrapedProperty[]>;

  /** Optional override: per-scraper schema-aware parsing helpers, etc. */
  protected get rateLimitMs(): number {
    return this.config.rateLimitMs ?? 1500;
  }

  // -----------------------------------------------------------------------
  // Public entrypoint — called by cron, on-demand routes, and tests
  // -----------------------------------------------------------------------

  /**
   * Run a bulk scrape, persist results, and write a ScrapeJob audit row.
   * Returns the structured ScrapeResult.
   */
  async run(
    category: ScrapeCategory,
    triggerType: "cron" | "on_demand" | "user_request",
    params?: Omit<BulkScrapeParams, "category">,
  ): Promise<ScrapeResult> {
    const scraperRow = await this.ensureRegistered();
    const job = await prisma.scrapeJob.create({
      data: {
        scraperId: scraperRow.id,
        category,
        triggerType,
        status: "running",
      },
    });

    const startedAt = Date.now();
    try {
      const records = await this.bulkPull({ ...params, category });
      const upsertedCount = await this.upsertResults(records);

      const durationMs = Date.now() - startedAt;
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          recordsScraped: records.length,
          recordsUpserted: upsertedCount,
          finishedAt: new Date(),
          durationMs,
        },
      });
      await prisma.countyScraper.update({
        where: { id: scraperRow.id },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          errorCount: 0,
          lastError: null,
        },
      });

      return {
        category,
        countyFips: this.config.countyFips,
        records,
        recordsScraped: records.length,
        recordsUpserted: upsertedCount,
        durationMs,
        warnings: [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage,
        },
      });
      await prisma.countyScraper.update({
        where: { id: scraperRow.id },
        data: {
          lastRunAt: new Date(),
          errorCount: { increment: 1 },
          lastError: errorMessage,
        },
      });
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Persistence helpers
  // -----------------------------------------------------------------------

  /** Idempotent: ensures a CountyScraper row exists and returns it. */
  private async ensureRegistered() {
    const { countyFips, state, county } = this.config;
    const existing = await prisma.countyScraper.findUnique({
      where: { countyFips },
    });
    if (existing) return existing;
    return prisma.countyScraper.create({
      data: {
        countyFips,
        state,
        county,
        scraperType: this.scraperType(),
        parserModule: this.parserModule(),
        endpoints: this.config.endpoints,
        rateLimitMs: this.rateLimitMs,
        status: "active",
      },
    });
  }

  /** Subclass identifier — used in the registry. */
  protected abstract scraperType(): string;
  protected abstract parserModule(): string;

  /**
   * Upsert each scraped record into the Property table and stamp per-field
   * provenance into PropertyDataPoint. Returns count of successful upserts.
   *
   * userId is required by Property's multi-tenant model. For scraper-sourced
   * records that don't yet have a user owner, we tag them under a system
   * sentinel user. When a user adds the lead to their workspace, ownership
   * transfers via a separate flow.
   */
  protected async upsertResults(records: ScrapedProperty[]): Promise<number> {
    let upserted = 0;
    for (const r of records) {
      try {
        await this.upsertOne(r);
        upserted++;
      } catch (err) {
        // Soft-fail individual records so one bad row doesn't kill the run.
        console.warn(
          `[scraper:${this.config.county}] failed to upsert record:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return upserted;
  }

  private async upsertOne(r: ScrapedProperty): Promise<void> {
    if (!r.address) return;
    const { street, city, state, zip } = r.address;

    // Find-or-create Property row keyed on (userId, address, city, state, zip).
    // For now we use a system user so scraped data accumulates without a real
    // user; future: an ingest pipeline assigns ownership per market.
    const systemUserId = await this.resolveSystemUserId();
    const property = await prisma.property.upsert({
      where: {
        userId_address_city_state_zip: {
          userId: systemUserId,
          address: street,
          city,
          state,
          zip,
        },
      },
      update: {
        ownerName: r.ownerName ?? undefined,
        bedrooms: r.bedrooms ?? undefined,
        bathrooms: r.bathrooms ?? undefined,
        squareFeet: r.squareFeet ?? undefined,
        yearBuilt: r.yearBuilt ?? undefined,
        lotSize: r.lotSize ?? undefined,
        propertyType: r.propertyType ?? undefined,
        assessedValue: r.assessedValue ?? undefined,
        estimatedValue: r.marketValue ?? undefined,
        lastSaleDate: r.lastSaleDate ?? undefined,
        lastSalePrice: r.lastSalePrice ?? undefined,
        taxDelinquent: r.taxDelinquent ?? undefined,
        foreclosure: r.foreclosure ?? undefined,
        preForeclosure: r.preForeclosure ?? undefined,
        vacant: r.vacant ?? undefined,
        bankruptcy: r.bankruptcy ?? undefined,
        apn: r.apn ?? undefined,
        dataSource: this.sourceTag(),
      },
      create: {
        userId: systemUserId,
        address: street,
        city,
        state,
        zip,
        apn: r.apn ?? null,
        ownerName: r.ownerName ?? null,
        bedrooms: r.bedrooms ?? null,
        bathrooms: r.bathrooms ?? null,
        squareFeet: r.squareFeet ?? null,
        yearBuilt: r.yearBuilt ?? null,
        lotSize: r.lotSize ?? null,
        propertyType: r.propertyType ?? null,
        assessedValue: r.assessedValue ?? null,
        estimatedValue: r.marketValue ?? null,
        lastSaleDate: r.lastSaleDate ?? null,
        lastSalePrice: r.lastSalePrice ?? null,
        taxDelinquent: r.taxDelinquent ?? false,
        foreclosure: r.foreclosure ?? false,
        preForeclosure: r.preForeclosure ?? false,
        vacant: r.vacant ?? false,
        bankruptcy: r.bankruptcy ?? false,
        dataSource: this.sourceTag(),
      },
    });

    // Stamp per-field provenance for the fields we actually touched.
    const dataPoints: { field: string; value: unknown }[] = [];
    if (r.taxDelinquent !== undefined)
      dataPoints.push({ field: "tax_delinquent", value: r.taxDelinquent });
    if (r.taxDelinquentAmount !== undefined)
      dataPoints.push({ field: "tax_delinquent_amount", value: r.taxDelinquentAmount });
    if (r.assessedValue !== undefined)
      dataPoints.push({ field: "assessed_value", value: r.assessedValue });
    if (r.marketValue !== undefined)
      dataPoints.push({ field: "market_value", value: r.marketValue });
    if (r.lastSalePrice !== undefined)
      dataPoints.push({ field: "last_sale_price", value: r.lastSalePrice });
    if (r.bedrooms !== undefined)
      dataPoints.push({ field: "bedrooms", value: r.bedrooms });
    if (r.bathrooms !== undefined)
      dataPoints.push({ field: "bathrooms", value: r.bathrooms });
    if (r.squareFeet !== undefined)
      dataPoints.push({ field: "square_feet", value: r.squareFeet });
    if (r.foreclosure !== undefined)
      dataPoints.push({ field: "foreclosure", value: r.foreclosure });

    if (dataPoints.length === 0) return;

    const source = this.sourceTag();
    const fetchedAt = new Date();
    await prisma.$transaction(
      dataPoints.map((dp) =>
        prisma.propertyDataPoint.upsert({
          where: {
            propertyId_field_source: {
              propertyId: property.id,
              field: dp.field,
              source,
            },
          },
          create: {
            propertyId: property.id,
            field: dp.field,
            source,
            value: JSON.stringify(dp.value),
            fetchedAt,
          },
          update: {
            value: JSON.stringify(dp.value),
            fetchedAt,
          },
        }),
      ),
    );
  }

  /** Returns the canonical source tag used in PropertyDataPoint.source.
   * Format: "scraper:<state>-<county>". */
  protected sourceTag(): string {
    return `scraper:${this.config.state.toLowerCase()}-${this.config.county.toLowerCase().replace(/\s+/g, "-")}`;
  }

  /** Find or create the system user that owns scraper-sourced properties
   * before they're claimed by a real user. */
  private async resolveSystemUserId(): Promise<string> {
    const SYSTEM_EMAIL = "system+scrapers@flipops.io";
    let user = await prisma.user.findFirst({ where: { email: SYSTEM_EMAIL } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: SYSTEM_EMAIL,
          targetMarkets: '[]', // required JSON-array column
        },
      });
    }
    return user.id;
  }
}
