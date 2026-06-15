import { randomUUID } from "node:crypto";
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
  effectiveYearBuilt?: number | null;
  improvementQuality?: number | null;
  specialFeatureValue?: number | null;
  numResUnits?: number | null;
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
   *
   * Safeguards for Railway PG (after the Dade-WAL-PANIC incident):
   *   • Each upsertBatch runs in its own transaction with
   *     synchronous_commit = OFF — cuts WAL flush pressure massively for
   *     bulk-load workloads where we can re-run a failed batch from
   *     the source CSV anytime.
   *   • Connection-drop errors retry the batch (up to 3x with backoff)
   *     instead of cascading through the whole ingest.
   *   • Audit-row updates are best-effort; if they fail, ingest keeps going.
   *   • Periodic micro-pause (every 50 batches) gives Railway's checkpoint
   *     a chance to flush WAL between bursts.
   */
  async ingest(opts: IngestOptions = {}): Promise<BulkIngestResult> {
    const scope = opts.countyFips ?? this.defaultScope();
    // All known callers of this base class are CLI scripts (FlDorIngester
    // subclass via scripts/fl-dor-ingest-*.ts, test-fl-bulk.ts). Tag as
    // "manual-script" so analytics distinguishing scheduler-fired vs
    // operator-triggered runs work correctly without relying on the schema
    // default.
    const job = await prisma.bulkIngestJob.create({
      data: { sourceTag: this.sourceTag, scope, status: "running", triggerType: "manual-script" },
    });

    const startedAt = Date.now();
    let fetched = 0;
    let upserted = 0;
    let batchIndex = 0;

    try {
      for await (const batch of this.fetchBatches(opts)) {
        if (batch.length === 0) continue;
        fetched += batch.length;
        upserted += await retryOnConnectionDrop(() => this.upsertBatch(batch));
        batchIndex++;

        // Audit update is best-effort — a failed update doesn't kill ingest.
        try {
          await prisma.bulkIngestJob.update({
            where: { id: job.id },
            data: { recordsFetched: fetched, recordsUpserted: upserted },
          });
        } catch { /* ignore audit failure */ }

        // Every 50 batches, give WAL checkpoint a moment to catch up.
        if (batchIndex % 50 === 0) {
          await new Promise((r) => setTimeout(r, 250));
        }
        if (opts.maxRecords && fetched >= opts.maxRecords) break;
      }

      const durationMs = Date.now() - startedAt;
      try {
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
      } catch { /* audit failure on success path — don't mask the real result */ }
      return { sourceTag: this.sourceTag, scope, recordsFetched: fetched, recordsUpserted: upserted, durationMs };
    } catch (err) {
      try {
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
      } catch { /* ignore audit failure on error path too */ }
      throw err;
    }
  }

  protected defaultScope(): string {
    return "statewide";
  }

  /**
   * Batched upsert into Parcel via raw multi-row INSERT ... ON CONFLICT.
   * Per-row prisma.parcel.upsert was untenable at NAL scale (one network
   * round-trip per row → ~50ms × 600k rows for big counties = hours per
   * county). This sends one SQL statement per batch — Postgres handles
   * 1000-row inserts in tens of ms.
   */
  protected async upsertBatch(records: ParcelRecord[]): Promise<number> {
    const filtered = records.filter((r) => r.apn && r.countyFips);
    if (filtered.length === 0) return 0;

    // Postgres caps prepared-statement bind variables at 32767 (Int16 wire
    // format). With 26 columns per row, max safe batch is ~1250. If a
    // caller passed something larger we chunk transparently.
    const COLS_PER_ROW = 26;
    const MAX_ROWS_PER_QUERY = Math.floor(32000 / COLS_PER_ROW);
    if (filtered.length > MAX_ROWS_PER_QUERY) {
      let total = 0;
      for (let i = 0; i < filtered.length; i += MAX_ROWS_PER_QUERY) {
        total += await this.upsertBatch(filtered.slice(i, i + MAX_ROWS_PER_QUERY));
      }
      return total;
    }

    const vintage = this.dataVintage;
    const source = this.sourceTag;
    const now = new Date();

    // Column list (matches insertion order below + Parcel schema). `id` and
    // `updatedAt` are Prisma-managed in normal CRUD; raw SQL must populate
    // them explicitly. ON CONFLICT UPDATE excludes `id`+`createdAt` so we
    // never overwrite the original ID or creation timestamp on re-ingest.
    const cols = [
      "id",
      "countyFips", "apn", "state",
      "ownerName", "ownerMailingAddress",
      "situsAddress", "situsCity", "situsState", "situsZip",
      "marketValue", "assessedValue", "landValue",
      "propertyType", "yearBuilt", "squareFeet", "lotSize",
      "effectiveYearBuilt", "improvementQuality", "specialFeatureValue", "numResUnits",
      "lastSalePrice", "lastSaleYear",
      "latitude", "longitude",
      "source", "dataVintage", "fetchedAt",
      "createdAt", "updatedAt",
    ];
    const NEVER_UPDATE = new Set(["id", "countyFips", "apn", "createdAt"]);
    const updateCols = cols.filter((c) => !NEVER_UPDATE.has(c));

    // Build $1..$N placeholders + flat values array.
    const values: unknown[] = [];
    const placeholderRows: string[] = [];
    for (const r of filtered) {
      const row = [
        randomUUID(), // id — never overwritten on conflict, so this is safe to generate fresh per row
        r.countyFips, r.apn, r.state,
        r.ownerName ?? null, r.ownerMailingAddress ?? null,
        r.situsAddress ?? null, r.situsCity ?? null, r.situsState ?? null, r.situsZip ?? null,
        r.marketValue ?? null, r.assessedValue ?? null, r.landValue ?? null,
        r.propertyType ?? null, r.yearBuilt ?? null, r.squareFeet ?? null, r.lotSize ?? null,
        r.effectiveYearBuilt ?? null, r.improvementQuality ?? null, r.specialFeatureValue ?? null, r.numResUnits ?? null,
        r.lastSalePrice ?? null, r.lastSaleYear ?? null,
        r.latitude ?? null, r.longitude ?? null,
        source, vintage, now,
        now, now, // createdAt, updatedAt
      ];
      const start = values.length;
      values.push(...row);
      placeholderRows.push(
        "(" + row.map((_, i) => `$${start + i + 1}`).join(", ") + ")",
      );
    }

    const colSql = cols.map((c) => `"${c}"`).join(", ");
    const updateSql = updateCols
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    const sql =
      `INSERT INTO "Parcel" (${colSql}) VALUES ${placeholderRows.join(", ")} ` +
      `ON CONFLICT ("countyFips", "apn") DO UPDATE SET ${updateSql}`;

    // Wrap in a transaction with synchronous_commit OFF — bulk-load workloads
    // don't need fsync-per-batch (we can re-run from the source CSV anytime).
    // This dramatically reduces WAL flush pressure on Railway PG; without it
    // the Dade NAL ingest tripped a pg_wal disk-full PANIC at the server.
    //
    // Transaction timeout bumped to 60s: Prisma's default is 5s, which the
    // Lee ingest blew past when a connection drop mid-batch triggered a
    // retry. The retry wait + reconnect time exceeded the tx window and we
    // got "Transaction already closed" instead of recovery. 60s is well
    // above any realistic single-batch + one retry cycle.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL synchronous_commit = OFF");
        await tx.$executeRawUnsafe(sql, ...values);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return filtered.length;
  }
}

// ---------------------------------------------------------------------------
// Connection-drop retry. Bulk ingests can take hours; Railway PG / Prisma /
// pgbouncer connections can hiccup mid-run. Without retry, a single
// ECONNRESET kills the entire ingest. We retry idempotent batch upserts on
// connection-level failures only; logical errors (constraint violations etc)
// pass through immediately.
// ---------------------------------------------------------------------------

const CONNECTION_DROP_PATTERNS = [
  "ECONNRESET",
  "Server has closed the connection",
  "Can't reach database server",
  "Connection terminated",
  "kind: Closed",
  "P1001", // Prisma: Can't reach database server
  "P1017", // Prisma: Server closed connection
  // Lee-incident: when a connection drops mid-transaction, Prisma marks the
  // transaction expired; the retry on the same call site should be allowed
  // because it'll spin up a fresh transaction on a fresh connection.
  "Transaction already closed",
  "Transaction API error",
];

function isConnectionDrop(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return CONNECTION_DROP_PATTERNS.some((p) => msg.includes(p));
}

async function retryOnConnectionDrop<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < maxRetries && isConnectionDrop(err)) {
        const backoff = Math.min(2 ** attempt * 1000, 8000);
        console.warn(
          `[bulk-ingester] connection drop on batch (attempt ${attempt + 1}/${maxRetries + 1}); retrying in ${backoff}ms:`,
          err instanceof Error ? err.message.split("\n")[0] : String(err),
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw new Error("retryOnConnectionDrop: exhausted retries");
}
