import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// BulkIngester — first-class source modality beside CountyScraper, for
// ingesting bulk files / statewide REST APIs into the non-tenant Parcel table.
//
// Per the master plan: statewide bulk is the cheapest, highest-coverage source
// for the static layer (owner/value/characteristics/geometry). Bulk writes to
// Parcel via batched set-based upserts — never per-row $transaction (fatal at
// roll scale). A tenant Property links to a Parcel only when a user works it.
// ---------------------------------------------------------------------------

export type SourceModality = "scraper" | "bulk" | "api";

export interface ParcelRecord {
  countyFips: string;
  apn: string;
  state: string;
  ownerName?: string | null;
  ownerMailingAddress?: string | null;
  situsAddress?: string | null;
  situsCity?: string | null;
  situsState?: string | null;
  situsZip?: string | null;
  marketValue?: number | null;
  assessedValue?: number | null;
  landValue?: number | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  squareFeet?: number | null;
  lotSize?: number | null;
  lastSalePrice?: number | null;
  lastSaleYear?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BulkIngestResult {
  sourceTag: string;
  scope: string;
  recordsFetched: number;
  recordsUpserted: number;
  durationMs: number;
}

export interface IngestOptions {
  /** Limit to specific county FIPS (e.g. one county at a time). */
  countyFips?: string;
  /** Cap total records (for testing). */
  maxRecords?: number;
}

export abstract class BulkIngester {
  readonly modality: SourceModality = "bulk";

  /** Canonical provenance tag, e.g. "bulk:fl-fgio-2025". */
  abstract get sourceTag(): string;
  /** Data vintage label, e.g. "2025". */
  abstract get dataVintage(): string;

  /**
   * Subclass: yield batches of normalized ParcelRecord. The base handles
   * persistence + the BulkIngestJob audit row. Implementations should stream
   * (paginate the API / stream the file) and never materialize everything.
   */
  protected abstract fetchBatches(
    opts: IngestOptions,
  ): AsyncGenerator<ParcelRecord[], void, unknown>;

  /**
   * Entry point. Streams batches, upserts each into Parcel, writes a
   * BulkIngestJob audit row with running/succeeded/failed status.
   */
  async ingest(opts: IngestOptions = {}): Promise<BulkIngestResult> {
    const scope = opts.countyFips ?? this.defaultScope();
    const job = await prisma.bulkIngestJob.create({
      data: { sourceTag: this.sourceTag, scope, status: "running" },
    });

    const startedAt = Date.now();
    let fetched = 0;
    let upserted = 0;

    try {
      for await (const batch of this.fetchBatches(opts)) {
        if (batch.length === 0) continue;
        fetched += batch.length;
        upserted += await this.upsertBatch(batch);
        // Checkpoint progress so a long run is observable / resumable.
        await prisma.bulkIngestJob.update({
          where: { id: job.id },
          data: { recordsFetched: fetched, recordsUpserted: upserted },
        });
        if (opts.maxRecords && fetched >= opts.maxRecords) break;
      }

      const durationMs = Date.now() - startedAt;
      await prisma.bulkIngestJob.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          recordsFetched: fetched,
          recordsUpserted: upserted,
          finishedAt: new Date(),
          durationMs,
        },
      });
      return { sourceTag: this.sourceTag, scope, recordsFetched: fetched, recordsUpserted: upserted, durationMs };
    } catch (err) {
      await prisma.bulkIngestJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          recordsFetched: fetched,
          recordsUpserted: upserted,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  protected defaultScope(): string {
    return "statewide";
  }

  /**
   * Batched upsert into Parcel. Uses one upsert per row inside a single
   * transaction per batch — acceptable at batch sizes of a few thousand.
   * (A future optimization is raw INSERT ... ON CONFLICT for COPY-speed.)
   */
  protected async upsertBatch(records: ParcelRecord[]): Promise<number> {
    const vintage = this.dataVintage;
    const source = this.sourceTag;
    const ops = records
      .filter((r) => r.apn && r.countyFips)
      .map((r) =>
        prisma.parcel.upsert({
          where: { countyFips_apn: { countyFips: r.countyFips, apn: r.apn } },
          create: { ...this.toRow(r), source, dataVintage: vintage },
          update: { ...this.toRow(r), source, dataVintage: vintage, fetchedAt: new Date() },
        }),
      );
    const res = await prisma.$transaction(ops);
    return res.length;
  }

  private toRow(r: ParcelRecord) {
    return {
      countyFips: r.countyFips,
      apn: r.apn,
      state: r.state,
      ownerName: r.ownerName ?? null,
      ownerMailingAddress: r.ownerMailingAddress ?? null,
      situsAddress: r.situsAddress ?? null,
      situsCity: r.situsCity ?? null,
      situsState: r.situsState ?? null,
      situsZip: r.situsZip ?? null,
      marketValue: r.marketValue ?? null,
      assessedValue: r.assessedValue ?? null,
      landValue: r.landValue ?? null,
      propertyType: r.propertyType ?? null,
      yearBuilt: r.yearBuilt ?? null,
      squareFeet: r.squareFeet ?? null,
      lotSize: r.lotSize ?? null,
      lastSalePrice: r.lastSalePrice ?? null,
      lastSaleYear: r.lastSaleYear ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
    };
  }
}
