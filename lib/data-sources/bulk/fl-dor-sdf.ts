import { randomUUID, createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { parse } from "csv-parse";
import { prisma } from "@/lib/prisma";
import { flCountyByCoNo } from "./fl-counties";
import { captureRaw } from "../raw-capture";

// ---------------------------------------------------------------------------
// FL DOR SDF (Sales Data File) ingester — sale history 2009→present, all 67
// counties, ~40 MB total statewide. 23 fields per row (CO_NO, PARCEL_ID,
// SALE_YR, SALE_MO, SALE_PRC, QUAL_CD, SAL_CHNG_CD, VI_CD, OR_BOOK, OR_PAGE,
// CLERK_NO, MULTI_PAR_SAL, etc).
//
// Each row = ONE SALE EVENT (not one parcel). A parcel can have many SDF
// rows. We write to ParcelSale (append-only time-series) keyed on
// (countyFips, apn, saleDate, source) so re-ingests are idempotent.
//
// Pattern is parallel to FlDorIngester but writes a different table and
// doesn't share BulkIngester (Parcel-specific). Refactor to a generic base
// when there's a third source needing the same shape.
// ---------------------------------------------------------------------------

export interface FlDorSdfConfig {
  /** Absolute path to the SDF CSV file. */
  sdfCsvPath: string;
  /** Roll vintage, e.g. "2025". */
  vintage: string;
  /** Batch size for INSERT. SDF rows are smaller than NAL so we can go bigger. */
  batchSize?: number;
}

interface SaleRow {
  countyFips: string;
  apn: string;
  saleDate: Date | null;
  saleYear: number | null;
  saleMonth: number | null;
  salePrice: number | null;
  qualCode: string | null;
  saleChangeCode: string | null;
  vacancyCode: string | null;
  orBook: string | null;
  orPage: string | null;
  clerkNumber: string | null;
  multiParcel: boolean;
}

export class FlDorSdfIngester {
  constructor(private config: FlDorSdfConfig) {}

  get sourceTag(): string {
    return `bulk:fl-dor-sdf-${this.config.vintage}`;
  }

  async ingest(opts: { countyFips?: string; maxRecords?: number } = {}): Promise<{
    sourceTag: string;
    scope: string;
    recordsFetched: number;
    recordsUpserted: number;
    durationMs: number;
  }> {
    const batchSize = this.config.batchSize ?? 2000;
    const wantFips = opts.countyFips ?? null;
    const scope = wantFips ?? "FL";

    const job = await prisma.bulkIngestJob.create({
      data: { sourceTag: this.sourceTag, scope, status: "running" },
    });

    // One per-file bronze snapshot (NOT per row). The CSV file IS the bronze.
    void captureRaw({
      entityType: "parcel",
      source: "fl-dor-sdf",
      sourceTag: this.sourceTag,
      category: "bulk_roll_sdf_file",
      countyFips: wantFips ?? undefined,
      requestParams: { csvPath: this.config.sdfCsvPath, vintage: this.config.vintage, wantFips },
      rawResponse: {
        fileSize: statSync(this.config.sdfCsvPath).size,
        fileSha256Head: fileHashHead(this.config.sdfCsvPath),
      },
    });

    const startedAt = Date.now();
    let fetched = 0;
    let upserted = 0;

    try {
      const stream = createReadStream(this.config.sdfCsvPath).pipe(
        parse({ columns: true, skip_empty_lines: true, relax_column_count: true, trim: true }),
      );

      let batch: SaleRow[] = [];
      for await (const row of stream as AsyncIterable<Record<string, string>>) {
        const coNo = Number.parseInt(row["CO_NO"] ?? "", 10);
        if (Number.isNaN(coNo)) continue;
        const county = flCountyByCoNo(coNo);
        if (!county) continue;
        if (wantFips && county.fips !== wantFips) continue;

        const sale = sdfRowToSaleRow(row, county.fips);
        if (!sale) continue;
        batch.push(sale);
        fetched++;

        if (batch.length >= batchSize) {
          upserted += await this.insertBatch(batch);
          batch = [];
          await prisma.bulkIngestJob.update({
            where: { id: job.id },
            data: { recordsFetched: fetched, recordsUpserted: upserted },
          });
        }
        if (opts.maxRecords && fetched >= opts.maxRecords) break;
      }
      if (batch.length > 0) upserted += await this.insertBatch(batch);

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

  /**
   * Bulk insert into ParcelSale via raw multi-row INSERT with ON CONFLICT DO
   * NOTHING. Sales are append-only — if we re-ingest the same vintage file,
   * the unique constraint dedups quietly. The constraint key includes
   * source so DOR SDF rows and Civitek scrape rows for the same sale event
   * coexist as distinct provenance records.
   */
  private async insertBatch(rows: SaleRow[]): Promise<number> {
    if (rows.length === 0) return 0;

    const cols = [
      "id",
      "countyFips", "apn",
      "saleDate", "saleYear", "saleMonth", "salePrice",
      "qualCode", "saleChangeCode", "vacancyCode",
      "orBook", "orPage", "clerkNumber", "multiParcel",
      "source", "dataVintage", "capturedAt",
    ];
    const source = this.sourceTag;
    const vintage = this.config.vintage;
    const now = new Date();

    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (const r of rows) {
      const row = [
        randomUUID(),
        r.countyFips, r.apn,
        r.saleDate, r.saleYear, r.saleMonth, r.salePrice,
        r.qualCode, r.saleChangeCode, r.vacancyCode,
        r.orBook, r.orPage, r.clerkNumber, r.multiParcel,
        source, vintage, now,
      ];
      const start = values.length;
      values.push(...row);
      placeholders.push("(" + row.map((_, i) => `$${start + i + 1}`).join(", ") + ")");
    }

    const colSql = cols.map((c) => `"${c}"`).join(", ");
    const sql =
      `INSERT INTO "ParcelSale" (${colSql}) VALUES ${placeholders.join(", ")} ` +
      `ON CONFLICT ("countyFips", "apn", "saleDate", "source") DO NOTHING`;

    await prisma.$executeRawUnsafe(sql, ...values);
    return rows.length;
  }
}

function sdfRowToSaleRow(row: Record<string, string>, countyFips: string): SaleRow | null {
  const apn = (row["PARCEL_ID"] ?? "").trim();
  if (!apn) return null;

  const yr = Number.parseInt(row["SALE_YR"] ?? "", 10);
  const mo = Number.parseInt(row["SALE_MO"] ?? "", 10);
  let saleDate: Date | null = null;
  if (yr > 1900 && yr < 2200 && mo >= 1 && mo <= 12) {
    saleDate = new Date(Date.UTC(yr, mo - 1, 1)); // YYYY-MM-01 UTC midnight
  }

  return {
    countyFips,
    apn,
    saleDate,
    saleYear: Number.isFinite(yr) ? yr : null,
    saleMonth: Number.isFinite(mo) ? mo : null,
    salePrice: parseFloatOrNull(row["SALE_PRC"]),
    qualCode: emptyToNull(row["QUAL_CD"]),
    saleChangeCode: emptyToNull(row["SAL_CHNG_CD"]),
    vacancyCode: emptyToNull(row["VI_CD"]),
    orBook: emptyToNull(row["OR_BOOK"]),
    orPage: emptyToNull(row["OR_PAGE"]),
    clerkNumber: emptyToNull(row["CLERK_NO"]),
    multiParcel: (row["MULTI_PAR_SAL"] ?? "").trim() === "1",
  };
}

function parseFloatOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}
function emptyToNull(raw: string | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function fileHashHead(path: string): string {
  const fs = require("node:fs");
  const fd = fs.openSync(path, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    return createHash("sha256").update(buf.subarray(0, bytes)).digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}
