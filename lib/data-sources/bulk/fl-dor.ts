import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { parse } from "csv-parse";
import {
  BulkIngester,
  type IngestOptions,
  type ParcelRecord,
} from "@/lib/scrapers/base/bulk-ingester";
import { flCountyByCoNo } from "./fl-counties";
import { captureRaw } from "../raw-capture";
import { NAL_TO_COTALITY } from "./fl-dor-mapper";

// ---------------------------------------------------------------------------
// FL DOR NAL statewide CSV ingester.
//
// THE breadth path for all 67 FL counties. One annual CSV from the FL DOR
// Data Portal covers assessment + ownership + sale history + DOR-coded land
// use for every parcel in the state. Annual refresh; no per-county scraping.
//
// Access (NOT a static download — file is emailed):
//   https://floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx
//   PTOTechnology@floridarevenue.com for bulk requests
// Field spec: 2025_NAL_SDF_NAP_Users_Guide.pdf (canonical FL DOR data dictionary).
//
// We map NAL columns → Cotality Property Domain v3 canonical field names so
// the row we persist to RawSnapshot has the unified shape regardless of
// source. The typed `ParcelRecord` slice we hand to BulkIngester.upsertBatch
// uses our existing Parcel columns; everything else lives in RawSnapshot.
//
// Pattern is state-agnostic: each state's DOR-equivalent gets its own
// FlDorIngester-shaped class with its own column → Cotality map.
// ---------------------------------------------------------------------------

export interface FlDorIngestConfig {
  /** Absolute path to the NAL CSV file (delivered by DOR via email link). */
  nalCsvPath: string;
  /** Roll vintage label, e.g. "2025". */
  vintage: string;
  /** Batch size for upserts to Parcel. */
  batchSize?: number;
}

interface RowMaps {
  [nalColumn: string]: number; // header index lookup
}

export class FlDorIngester extends BulkIngester {
  constructor(private config: FlDorIngestConfig) {
    super();
  }

  get sourceTag(): string {
    return `bulk:fl-dor-${this.config.vintage}`;
  }
  get dataVintage(): string {
    return this.config.vintage;
  }
  protected defaultScope(): string {
    return "FL";
  }

  protected async *fetchBatches(
    opts: IngestOptions,
  ): AsyncGenerator<ParcelRecord[], void, unknown> {
    const batchSize = this.config.batchSize ?? 1000;
    const wantFips = opts.countyFips ?? null;

    // Bronze for a bulk file ingest: ONE snapshot describing the file +
    // checksum + mapper version. The full per-row Cotality shape is
    // re-derivable any time by re-running this code against the same file.
    // This avoids 13k+ RawSnapshot inserts per county which would dominate
    // the wall-clock vs the typed Parcel upserts.
    void captureRaw({
      entityType: "parcel",
      source: "fl-dor",
      sourceTag: this.sourceTag,
      category: "bulk_roll_file",
      countyFips: wantFips ?? undefined,
      requestParams: {
        csvPath: this.config.nalCsvPath,
        vintage: this.config.vintage,
        wantFips,
      },
      rawResponse: {
        fileSize: statSync(this.config.nalCsvPath).size,
        fileSha256Head: fileHashHead(this.config.nalCsvPath),
        mapperFields: Object.keys(NAL_TO_COTALITY).length,
        mapperFingerprint: createHash("sha256").update(JSON.stringify(NAL_TO_COTALITY)).digest("hex").slice(0, 16),
      },
    });

    const stream = createReadStream(this.config.nalCsvPath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }),
    );

    let batch: ParcelRecord[] = [];
    for await (const row of stream as AsyncIterable<Record<string, string>>) {
      const coNo = Number.parseInt(row["CO_NO"] ?? "", 10);
      if (Number.isNaN(coNo)) continue;
      const county = flCountyByCoNo(coNo);
      if (!county) continue;
      if (wantFips && county.fips !== wantFips) continue;

      const parcelRecord = nalRowToParcelRecord(row, county.fips);
      if (!parcelRecord) continue;

      batch.push(parcelRecord);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  }
}

/** Hash only the first 1MB of a potentially-large file — enough for
 *  content-change detection without a full-file scan. */
function fileHashHead(path: string): string {
  const fd = require("node:fs").openSync(path, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    const bytes = require("node:fs").readSync(fd, buf, 0, buf.length, 0);
    return createHash("sha256").update(buf.subarray(0, bytes)).digest("hex");
  } finally {
    require("node:fs").closeSync(fd);
  }
}

// ---------------------------------------------------------------------------
// Row transformers
// ---------------------------------------------------------------------------

/**
 * Map a NAL CSV row → the typed ParcelRecord we persist to the Parcel table.
 * Pulls only the fields that are 1:1 with our existing Parcel columns;
 * everything else lives in the RawSnapshot bronze layer.
 */
export function nalRowToParcelRecord(
  row: Record<string, string>,
  countyFips: string,
): ParcelRecord | null {
  const apn = (row["PARCEL_ID"] ?? "").trim();
  if (!apn) return null;

  // Owner mailing address: concatenate the NAL address-line fields into one
  // string for our existing single-column ownerMailingAddress. The Cotality
  // shape in RawSnapshot keeps them decomposed.
  const ownerMail = [row["OWN_ADDR1"], row["OWN_ADDR2"], row["OWN_CITY"], row["OWN_STATE"], row["OWN_ZIPCD"]]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ") || null;

  const situs = [row["PHY_ADDR1"], row["PHY_ADDR2"]]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ") || null;

  return {
    countyFips,
    apn,
    state: "FL",
    ownerName: row["OWN_NAME"]?.trim() || null,
    ownerMailingAddress: ownerMail,
    situsAddress: situs,
    situsCity: row["PHY_CITY"]?.trim() || null,
    situsState: "FL",
    situsZip: row["PHY_ZIPCD"]?.trim() || null,
    marketValue: num(row["JV"]),
    assessedValue: num(row["AV_SD"]),
    landValue: num(row["LND_VAL"]),
    propertyType: row["DOR_UC"]?.trim() || null, // raw DOR code; LUSE lookup happens later
    yearBuilt: int(row["ACT_YR_BLT"]),
    squareFeet: num(row["TOT_LVG_AREA"]),
    lotSize: num(row["LND_SQFOOT"]),
    lastSalePrice: num(row["SALE_PRC1"]),
    lastSaleYear: int(row["SALE_YR1"]),
    latitude: null,  // NAL has no geometry — FloridaGIO ingester joins this in
    longitude: null,
  };
}

/**
 * Map a NAL CSV row → the Cotality-canonical-name shape for RawSnapshot.
 * Every Cotality field carries the cotalityFieldNum so downstream consumers
 * can re-index or join against the dictionary. Sale year + month are
 * composed into a YYYYMM01 numeric "SALE RECORDING DATE" approximation
 * because NAL doesn't carry the day.
 */
export function nalRowToCotalityShape(
  row: Record<string, string>,
  countyFips: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    // Source provenance (not in Cotality dictionary — for traceability)
    _source: "fl-dor-nal",
    _sourceState: "FL",
  };

  // FIPS is composed from CO_NO via crosswalk (not a direct column copy)
  out["FIPS COUNTY CODE"] = countyFips;
  out["SITUS COUNTY"] = countyFips;
  out["SITUS STATE"] = "FL";

  // 1:1 mapped fields
  for (const [nalCol, mapping] of Object.entries(NAL_TO_COTALITY)) {
    if (nalCol === "CO_NO") continue; // already handled via crosswalk
    const raw = row[nalCol];
    if (raw === undefined || raw === null || raw === "") continue;
    if (mapping.type === "number") {
      const n = Number.parseFloat(raw);
      if (!Number.isNaN(n)) out[mapping.cotalityFieldName] = n;
    } else {
      out[mapping.cotalityFieldName] = raw.trim();
    }
  }

  // Composed: SALE_YR1 + SALE_MO1 → SALE RECORDING DATE (YYYYMMDD with DD=01)
  const yr = row["SALE_YR1"];
  const mo = row["SALE_MO1"];
  if (yr && mo) {
    const yrN = Number.parseInt(yr, 10);
    const moN = Number.parseInt(mo, 10);
    if (yrN > 1900 && yrN < 2200 && moN >= 1 && moN <= 12) {
      out["SALE RECORDING DATE"] = yrN * 10000 + moN * 100 + 1;
    }
  }

  return out;
}

function num(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}
function int(raw: string | undefined): number | null {
  const n = num(raw);
  return n === null ? null : Math.round(n);
}
