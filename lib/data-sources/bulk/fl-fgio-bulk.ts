import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { flCountyByCoNo } from "./fl-counties";

// ---------------------------------------------------------------------------
// FloridaGIO BULK geocode ingester — lat/lng backfill for the 11M-row Parcel
// table. UPDATE-only: it never inserts parcels; it joins the FGIO statewide
// cadastral geometry onto rows already ingested from the FL DOR NAL roll
// (countyFips, apn) and stamps Parcel.latitude / Parcel.longitude.
//
// WHY A FILE INGESTER: lib/data-sources/bulk/fl-fgio.ts documents that the
// FGIO ArcGIS FeatureServer is throttled to tiny interactive queries — bulk
// MUST use the FloridaGIO Hub FILE download.
//
// ── DOWNLOAD RUNBOOK (verified live 2026-06-09) ─────────────────────────────
// Two FGIO-hosted items on geodata.floridagio.gov (AGOL org Gh9awoU677aKree0):
//
//   • POLYGONS  — "Florida Statewide Parcels"
//       itemId  efa909d6b1c841d298b0a649e7f71cf2
//       service …/Florida_Statewide_Cadastral/FeatureServer/0  (10,831,924 rows)
//   • CENTROIDS — "Florida Statewide Parcel Centroid Version"  ← PREFERRED
//       itemId  0307355f1818412fa97fbde39b30f640
//       service …/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0
//       layer 0 "FDOR Cadastral Centroids 2025", esriGeometryPoint,
//       native SR = 6439 / FL GDL Albers (METERS — must re-project!)
//
// Hub Download API v1 (the ONLY working bulk path):
//   GET https://hub.arcgis.com/api/download/v1/items/{itemId}/shapefile
//        ?redirect=false&layers=0&spatialRefId=4326[&where=CO_NO%3D{coNo}]
//   • ONLY the `shapefile` format is enabled on this Hub site — csv / geojson /
//     filegdb / kml / etc. all return 400 "Supported file formats are shapefile"
//     (verified 2026-06-09 against both items).
//   • spatialRefId=4326 is REQUIRED — without it the export ships in FL Albers
//     meters and every coordinate fails the WGS84 sanity gate below.
//   • Response is a job: {"status":"Pending|ExportingData"} → poll the same URL
//     until {"status":"Completed","resultUrl":"…/replicafilescache/….zip"}.
//     Per-county exports (where=CO_NO=N) complete in ~1–3 min and are cached
//     server-side. downloadCountyCentroidShapefile() below automates this.
//   • STATEWIDE (no `where`) will NOT work as a single shapefile: 10.83M rows
//     × 2,248-byte DBF record ≈ 24 GB, far past the 2 GB DBF limit. Largest
//     single county is Miami-Dade at 585,220 centroids ≈ 1.3 GB DBF — under
//     the cap. THE BULK PATH IS THE PER-COUNTY LOOP (67 downloads).
//     If a county export ever trips the cap, split it with
//     where=CO_NO%3D{n}%20AND%20OBJECTID%3C{mid} / %3E%3D{mid}.
//
// File formats accepted by ingestFile():
//   • .zip      — Hub export zip (extracted automatically, lazy adm-zip)
//   • .shp      — point shapefile (+ sibling .dbf with CO_NO / PARCEL_ID)
//   • .geojson / .json / .ndjson — FeatureCollection, bare feature array, or
//     newline-delimited features in EPSG:4326 (e.g. ogr2ogr conversions).
//     Streaming feature-boundary scanner — the whole file is never JSON.parsed.
//
// DB write: batched `UPDATE "Parcel" … FROM (VALUES …)` — 4 bind vars per row,
// default 2,000 rows/batch (8,000 binds, well under the 32,767 PG cap).
// Resilience mirrors lib/scrapers/base/bulk-ingester.ts: SET LOCAL
// synchronous_commit=OFF, 60s transaction timeout, connection-drop retry with
// backoff, micro-pause every 50 batches, best-effort BulkIngestJob audit.
// ---------------------------------------------------------------------------

export const FGIO_CENTROID_ITEM_ID = "0307355f1818412fa97fbde39b30f640";
export const FGIO_POLYGON_ITEM_ID = "efa909d6b1c841d298b0a649e7f71cf2";
const HUB_DOWNLOAD_API = "https://hub.arcgis.com/api/download/v1/items";

// Florida WGS84 sanity bounds (generous: covers Key West → Pensacola).
const FL_LON_MIN = -88.0;
const FL_LON_MAX = -79.0;
const FL_LAT_MIN = 24.0;
const FL_LAT_MAX = 31.5;

export interface GeocodeRecord {
  countyFips: string;
  apn: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeIngestOptions {
  /** Limit updates to one county FIPS (records for other counties are skipped). */
  countyFips?: string;
  /** Cap total parsed records (testing). */
  maxRecords?: number;
  /** Parse + map + count, but write nothing (no DB updates, no audit row). */
  dryRun?: boolean;
  /** Rows per UPDATE batch. Default 2000; hard-capped at 8000 (32767/4 binds). */
  batchSize?: number;
}

export interface GeocodeIngestResult {
  sourceTag: string;
  scope: string;
  /** Geometry+attribute records successfully parsed from the file. */
  recordsParsed: number;
  /** Records dropped: unknown CO_NO, blank APN, bad/out-of-bounds geometry. */
  recordsSkipped: number;
  /** Records dropped by the countyFips filter. */
  recordsFiltered: number;
  /** Parcel rows actually updated (matched on countyFips+apn). */
  rowsUpdated: number;
  batches: number;
  durationMs: number;
}

/** Raw record off the file before CO_NO→FIPS mapping. */
interface RawGeocode {
  coNo: number | null;
  parcelId: string | null;
  lon: number | null;
  lat: number | null;
}

// ---------------------------------------------------------------------------
// Ingester
// ---------------------------------------------------------------------------

export class FlFgioBulkGeocodeIngester {
  constructor(private vintage = "2025") {}

  get sourceTag(): string {
    return `bulk:fl-fgio-geo-${this.vintage}`;
  }

  /**
   * Stream a local FGIO file (.zip / .shp / .geojson / .json / .ndjson) and
   * UPDATE Parcel.latitude/longitude in batches. Never inserts.
   */
  async ingestFile(
    filePath: string,
    opts: GeocodeIngestOptions = {},
  ): Promise<GeocodeIngestResult> {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const batchSize = Math.min(Math.max(opts.batchSize ?? 2000, 1), 8000);
    const scope = opts.countyFips ?? "statewide";
    const startedAt = Date.now();

    // Audit row (skipped entirely on dry runs — nothing is written).
    let jobId: string | null = null;
    if (!opts.dryRun) {
      const job = await prisma.bulkIngestJob.create({
        data: {
          sourceTag: this.sourceTag,
          scope,
          status: "running",
          triggerType: "manual-script",
        },
      });
      jobId = job.id;
    }

    let parsed = 0;
    let skipped = 0;
    let filtered = 0;
    let updated = 0;
    let batches = 0;
    let boundsFailures = 0;
    // Dedup within a batch — condo buildings can emit several rows for one
    // (countyFips, apn); duplicate join keys in UPDATE…FROM are nondeterministic.
    let pending = new Map<string, GeocodeRecord>();

    const flush = async () => {
      if (pending.size === 0) return;
      const batch = [...pending.values()];
      pending = new Map();
      if (!opts.dryRun) {
        updated += await retryOnConnectionDrop(() => this.updateBatch(batch));
      }
      batches++;
      if (batches % 50 === 0) {
        const rate = Math.round(parsed / ((Date.now() - startedAt) / 1000));
        console.log(
          `[fl-fgio-bulk] batch ${batches}: parsed=${parsed} updated=${updated} skipped=${skipped} (${rate} rec/s)`,
        );
        // Give Railway PG's WAL checkpoint a moment to catch up.
        await new Promise((r) => setTimeout(r, 250));
        if (jobId) {
          try {
            await prisma.bulkIngestJob.update({
              where: { id: jobId },
              data: { recordsFetched: parsed, recordsUpserted: updated },
            });
          } catch {
            /* best-effort audit */
          }
        }
      }
    };

    try {
      for await (const raw of streamGeocodeRecords(filePath)) {
        // WGS84 / projection gate: if the first 100 parseable coordinates are
        // ALL outside Florida's lon/lat box, the file is almost certainly in a
        // projected CRS (the FGIO native SR is FL Albers METERS). Fail loudly.
        if (raw.lon !== null && raw.lat !== null && !inFloridaBounds(raw.lon, raw.lat)) {
          boundsFailures++;
          skipped++;
          if (parsed === 0 && boundsFailures >= 100) {
            throw new Error(
              `First ${boundsFailures} coordinates are all outside Florida WGS84 bounds — ` +
                `this file looks projected (FL Albers?). Re-export with spatialRefId=4326 ` +
                `(Hub API) or ogr2ogr -t_srs EPSG:4326.`,
            );
          }
          continue;
        }

        const rec = this.mapRecord(raw);
        if (!rec) {
          skipped++;
          continue;
        }
        if (opts.countyFips && rec.countyFips !== opts.countyFips) {
          filtered++;
          continue;
        }
        parsed++;
        pending.set(`${rec.countyFips}|${rec.apn}`, rec);
        if (pending.size >= batchSize) await flush();
        if (opts.maxRecords && parsed >= opts.maxRecords) break;
      }
      await flush();

      const durationMs = Date.now() - startedAt;
      if (jobId) {
        try {
          await prisma.bulkIngestJob.update({
            where: { id: jobId },
            data: {
              status: "succeeded",
              recordsFetched: parsed,
              recordsUpserted: updated,
              finishedAt: new Date(),
              durationMs,
            },
          });
        } catch {
          /* best-effort audit */
        }
      }
      return {
        sourceTag: this.sourceTag,
        scope,
        recordsParsed: parsed,
        recordsSkipped: skipped,
        recordsFiltered: filtered,
        rowsUpdated: updated,
        batches,
        durationMs,
      };
    } catch (err) {
      if (jobId) {
        try {
          await prisma.bulkIngestJob.update({
            where: { id: jobId },
            data: {
              status: "failed",
              recordsFetched: parsed,
              recordsUpserted: updated,
              finishedAt: new Date(),
              durationMs: Date.now() - startedAt,
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          });
        } catch {
          /* best-effort audit */
        }
      }
      throw err;
    }
  }

  private mapRecord(raw: RawGeocode): GeocodeRecord | null {
    if (raw.lon === null || raw.lat === null) return null;
    if (raw.coNo === null) return null;
    const county = flCountyByCoNo(Math.round(raw.coNo));
    if (!county) return null;
    const apn = raw.parcelId?.trim();
    if (!apn) return null;
    return {
      countyFips: county.fips,
      apn,
      latitude: raw.lat,
      longitude: raw.lon,
    };
  }

  /**
   * Batched UPDATE … FROM (VALUES …). 4 bind vars/row → max 8000 rows per
   * statement under the 32,767 PG bind-var cap (we chunk defensively anyway).
   * UPDATE-only by construction: rows with no (countyFips, apn) match are
   * silently unmatched — never inserted.
   */
  private async updateBatch(records: GeocodeRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const MAX_ROWS_PER_QUERY = Math.floor(32000 / 4);
    if (records.length > MAX_ROWS_PER_QUERY) {
      let total = 0;
      for (let i = 0; i < records.length; i += MAX_ROWS_PER_QUERY) {
        total += await this.updateBatch(records.slice(i, i + MAX_ROWS_PER_QUERY));
      }
      return total;
    }

    const values: unknown[] = [];
    const tuples: string[] = [];
    records.forEach((r, idx) => {
      const base = idx * 4;
      values.push(r.countyFips, r.apn, r.latitude, r.longitude);
      // PG infers VALUES column types from the first tuple — cast it explicitly.
      tuples.push(
        idx === 0
          ? `($${base + 1}::text, $${base + 2}::text, $${base + 3}::float8, $${base + 4}::float8)`
          : `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`,
      );
    });

    const sql =
      `UPDATE "Parcel" AS p SET latitude = v.lat, longitude = v.lng, "updatedAt" = NOW() ` +
      `FROM (VALUES ${tuples.join(", ")}) AS v("countyFips", apn, lat, lng) ` +
      `WHERE p."countyFips" = v."countyFips" AND p.apn = v.apn`;

    // synchronous_commit=OFF + explicit 60s timeout — same Railway-PG
    // safeguards as BulkIngester.upsertBatch (Dade WAL PANIC / Lee tx-timeout
    // incidents). $executeRawUnsafe returns the affected-row count.
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL synchronous_commit = OFF");
        return tx.$executeRawUnsafe(sql, ...values);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }
}

export function buildFlFgioBulkGeocodeIngester(vintage?: string): FlFgioBulkGeocodeIngester {
  return new FlFgioBulkGeocodeIngester(vintage);
}

// ---------------------------------------------------------------------------
// Hub Download API automation — request + poll + download one county's
// centroid shapefile export. Exports are cached server-side, so re-runs are
// nearly instant. Returns the local .zip path.
// ---------------------------------------------------------------------------

export async function downloadCountyCentroidShapefile(
  coNo: number,
  destDir: string,
  opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<string> {
  const pollIntervalMs = opts.pollIntervalMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 15 * 60_000;
  const url =
    `${HUB_DOWNLOAD_API}/${FGIO_CENTROID_ITEM_ID}/shapefile` +
    `?redirect=false&layers=0&spatialRefId=4326&where=${encodeURIComponent(`CO_NO=${coNo}`)}`;

  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `fl-fgio-centroids-co${coNo}-4326.zip`);

  const deadline = Date.now() + timeoutMs;
  let resultUrl: string | null = null;
  while (Date.now() < deadline) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hub download API HTTP ${res.status} (CO_NO=${coNo})`);
    const job = (await res.json()) as { status?: string; resultUrl?: string; message?: string };
    if (job.status === "Completed" && job.resultUrl) {
      resultUrl = job.resultUrl;
      break;
    }
    if (job.status === "Failed") {
      throw new Error(`Hub export failed for CO_NO=${coNo}: ${job.message ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  if (!resultUrl) throw new Error(`Hub export timed out after ${timeoutMs}ms (CO_NO=${coNo})`);

  const res = await fetch(resultUrl);
  if (!res.ok || !res.body) throw new Error(`Hub result download HTTP ${res.status} (CO_NO=${coNo})`);
  await pipeline(
    Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );
  return dest;
}

// ---------------------------------------------------------------------------
// File dispatch
// ---------------------------------------------------------------------------

async function* streamGeocodeRecords(filePath: string): AsyncGenerator<RawGeocode> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".zip") {
    const shpPath = await extractShapefileFromZip(filePath);
    yield* streamShapefileGeocodes(shpPath);
  } else if (ext === ".shp") {
    yield* streamShapefileGeocodes(filePath);
  } else if (ext === ".geojson" || ext === ".json" || ext === ".ndjson") {
    yield* streamGeoJsonGeocodes(filePath);
  } else {
    throw new Error(`Unsupported file type "${ext}" — expected .zip, .shp, .geojson, .json, or .ndjson`);
  }
}

/** Extract .shp/.dbf/.prj from a Hub export zip next to the zip itself. */
async function extractShapefileFromZip(zipPath: string): Promise<string> {
  // Lazy import keeps adm-zip out of any accidental client bundle.
  const { default: AdmZip } = await import("adm-zip");
  const extractDir = zipPath.replace(/\.zip$/i, "");
  mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  let shpPath: string | null = null;
  for (const entry of zip.getEntries()) {
    const lower = entry.entryName.toLowerCase();
    if (lower.endsWith(".shp") || lower.endsWith(".dbf") || lower.endsWith(".prj")) {
      zip.extractEntryTo(entry.entryName, extractDir, false, true);
      if (lower.endsWith(".shp")) shpPath = path.join(extractDir, path.basename(entry.entryName));
    }
  }
  if (!shpPath) throw new Error(`No .shp entry found in ${zipPath}`);
  return shpPath;
}

function inFloridaBounds(lon: number, lat: number): boolean {
  return lon >= FL_LON_MIN && lon <= FL_LON_MAX && lat >= FL_LAT_MIN && lat <= FL_LAT_MAX;
}

// ---------------------------------------------------------------------------
// Shapefile path — streaming point reader (.shp) zipped with a streaming DBF
// attribute reader (.dbf). Point types only (1/11/21); the FGIO centroid
// layer is esriGeometryPoint. Polygon files should go through the GeoJSON
// path (ogr2ogr) or — better — just use the centroid item.
// ---------------------------------------------------------------------------

/** Pull-based buffered reader over a file stream — never loads the file whole. */
class ChunkReader {
  private chunks: Buffer[] = [];
  private pos = 0; // read cursor into chunks[0]
  private buffered = 0;
  private iter: AsyncIterator<Buffer>;
  private done = false;

  constructor(filePath: string) {
    const stream = createReadStream(filePath, { highWaterMark: 1 << 20 });
    this.iter = stream[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  }

  /** Read exactly n bytes; returns null at clean EOF (0 bytes available). */
  async read(n: number): Promise<Buffer | null> {
    while (this.buffered < n && !this.done) {
      const { value, done } = await this.iter.next();
      if (done) {
        this.done = true;
        break;
      }
      this.chunks.push(value);
      this.buffered += value.length;
    }
    if (this.buffered === 0) return null;
    if (this.buffered < n) throw new Error(`Unexpected EOF: wanted ${n} bytes, got ${this.buffered}`);
    // Assemble n bytes across chunk boundaries without re-concatenating the
    // whole buffer (O(n) per read — the naive Buffer.concat approach is O(n²)).
    const out = Buffer.allocUnsafe(n);
    let copied = 0;
    while (copied < n) {
      const head = this.chunks[0];
      const take = Math.min(head.length - this.pos, n - copied);
      head.copy(out, copied, this.pos, this.pos + take);
      copied += take;
      this.pos += take;
      if (this.pos === head.length) {
        this.chunks.shift();
        this.pos = 0;
      }
    }
    this.buffered -= n;
    return out;
  }
}

const SHP_POINT_TYPES = new Set([1, 11, 21]); // Point, PointZ, PointM

async function* streamShpPoints(
  shpPath: string,
): AsyncGenerator<{ x: number; y: number } | null> {
  const reader = new ChunkReader(shpPath);
  const header = await reader.read(100);
  if (!header) throw new Error(`Empty .shp file: ${shpPath}`);
  if (header.readInt32BE(0) !== 9994) throw new Error(`Not a shapefile: ${shpPath}`);
  const shapeType = header.readInt32LE(32);
  if (!SHP_POINT_TYPES.has(shapeType)) {
    throw new Error(
      `.shp shape type ${shapeType} unsupported — this reader handles point layers only ` +
        `(use the FGIO centroid item ${FGIO_CENTROID_ITEM_ID}, or convert polygons to GeoJSON).`,
    );
  }

  for (;;) {
    const recHeader = await reader.read(8);
    if (!recHeader) return; // clean EOF
    const contentBytes = recHeader.readInt32BE(4) * 2;
    const content = await reader.read(contentBytes);
    if (!content) throw new Error("Truncated .shp record");
    const recType = content.readInt32LE(0);
    if (recType === 0 || contentBytes < 20) {
      yield null; // null shape — keep in lockstep with the DBF
      continue;
    }
    yield { x: content.readDoubleLE(4), y: content.readDoubleLE(12) };
  }
}

interface DbfRow {
  deleted: boolean;
  coNo: number | null;
  parcelId: string | null;
}

async function* streamDbfRows(dbfPath: string): AsyncGenerator<DbfRow> {
  const reader = new ChunkReader(dbfPath);
  const head = await reader.read(32);
  if (!head) throw new Error(`Empty .dbf file: ${dbfPath}`);
  const recordCount = head.readUInt32LE(4);
  const headerSize = head.readUInt16LE(8);
  const recordSize = head.readUInt16LE(10);

  // Field descriptors: 32 bytes each from offset 32 until the 0x0D terminator.
  const fieldArea = await reader.read(headerSize - 32);
  if (!fieldArea) throw new Error(`Truncated .dbf header: ${dbfPath}`);
  let coNoOff = -1;
  let coNoLen = 0;
  let pidOff = -1;
  let pidLen = 0;
  let off = 0;
  let recPos = 1; // byte 0 of each record is the deletion flag
  while (off + 32 <= fieldArea.length && fieldArea[off] !== 0x0d) {
    const name = fieldArea
      .subarray(off, off + 11)
      .toString("ascii")
      .split("\0")[0]
      .trim();
    const len = fieldArea[off + 16];
    if (name === "CO_NO") {
      coNoOff = recPos;
      coNoLen = len;
    } else if (name === "PARCEL_ID") {
      pidOff = recPos;
      pidLen = len;
    }
    recPos += len;
    off += 32;
  }
  if (coNoOff < 0 || pidOff < 0) {
    throw new Error(`.dbf is missing CO_NO and/or PARCEL_ID fields: ${dbfPath}`);
  }

  for (let i = 0; i < recordCount; i++) {
    const rec = await reader.read(recordSize);
    if (!rec) return; // tolerate a short tail
    const deleted = rec[0] === 0x2a; // '*'
    // CO_NO ships as a DBF Float ("  4.90000000000e+01") — parseFloat handles it.
    const coNoRaw = rec.subarray(coNoOff, coNoOff + coNoLen).toString("ascii").trim();
    const coNo = coNoRaw.length ? Number.parseFloat(coNoRaw) : NaN;
    const parcelId = rec.subarray(pidOff, pidOff + pidLen).toString("ascii").trim();
    yield {
      deleted,
      coNo: Number.isFinite(coNo) ? coNo : null,
      parcelId: parcelId.length ? parcelId : null,
    };
  }
}

async function* streamShapefileGeocodes(shpPath: string): AsyncGenerator<RawGeocode> {
  const dbfPath = shpPath.replace(/\.shp$/i, ".dbf");
  if (!existsSync(dbfPath)) {
    throw new Error(`Sibling .dbf not found for ${shpPath} — attributes (CO_NO/PARCEL_ID) live there.`);
  }
  // Projection gate via .prj when present: any PROJCS (FL Albers, Web
  // Mercator, …) means meters, not degrees — reject before touching the DB.
  const prjPath = shpPath.replace(/\.shp$/i, ".prj");
  if (existsSync(prjPath) && statSync(prjPath).size > 0) {
    const prj = readFileSync(prjPath, "utf8");
    if (/PROJCS/i.test(prj)) {
      throw new Error(
        `.prj declares a projected CRS — re-export with spatialRefId=4326 ` +
          `(Hub API) or reproject with ogr2ogr -t_srs EPSG:4326. PRJ: ${prj.slice(0, 120)}…`,
      );
    }
  }

  const points = streamShpPoints(shpPath);
  const rows = streamDbfRows(dbfPath);
  for (;;) {
    const [p, r] = await Promise.all([points.next(), rows.next()]);
    if (p.done || r.done) return;
    if (r.value.deleted) continue;
    yield {
      coNo: r.value.coNo,
      parcelId: r.value.parcelId,
      lon: p.value?.x ?? null,
      lat: p.value?.y ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// GeoJSON path — hand-rolled streaming feature-boundary scanner. Handles:
//   • {"type":"FeatureCollection", …, "features":[ {…}, {…} ]}
//   • newline-delimited GeoJSON (one feature per line)
//   • a bare JSON array of features
// Tracks string/escape state + brace depth and JSON.parses ONE feature at a
// time — the multi-GB statewide file is never materialized.
// ---------------------------------------------------------------------------

async function* streamGeoJsonFeatures(
  filePath: string,
): AsyncGenerator<Record<string, unknown>> {
  const stream = createReadStream(filePath, { encoding: "utf8", highWaterMark: 1 << 20 });

  // Modes: "detect" → first object might be an NDJSON feature OR a
  // FeatureCollection wrapper; "wrapper" → capture depth-1→2 objects;
  // "flat" → capture depth-0→1 objects (NDJSON / bare array).
  let mode: "detect" | "wrapper" | "flat" = "detect";
  let depth = 0;
  let inString = false;
  let escaped = false;
  let capturing = false;
  let captureFromDepth = 0; // depth at which the captured object STARTED
  let buf = "";
  // detect-mode helpers: watch for a top-level "features" key.
  let keyBuf: string | null = null; // string currently being read at wrapper depth
  let lastKey = "";
  const MAX_PROBE = 16 * 1024 * 1024;

  for await (const chunk of stream as AsyncIterable<string>) {
    // capture-slice start within this chunk; if a capture is in flight from a
    // previous chunk, it resumes at index 0.
    let sliceStart = capturing ? 0 : -1;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];

      if (inString) {
        if (keyBuf !== null && !escaped && c !== '"') keyBuf += c;
        if (escaped) {
          escaped = false;
        } else if (c === "\\") {
          escaped = true;
        } else if (c === '"') {
          inString = false;
          if (keyBuf !== null) {
            lastKey = keyBuf;
            keyBuf = null;
          }
        }
        continue;
      }

      switch (c) {
        case '"':
          inString = true;
          // Track potential keys at the wrapper level while detecting.
          if (mode === "detect" && capturing && depth === captureFromDepth + 1) keyBuf = "";
          break;
        case "{":
          if (!capturing) {
            const startDepth = depth;
            const shouldCapture =
              mode === "flat" ? startDepth === 0 : mode === "wrapper" ? startDepth === 1 : startDepth === 0;
            if (shouldCapture) {
              capturing = true;
              captureFromDepth = startDepth;
              buf = "";
              sliceStart = i;
            }
          }
          depth++;
          break;
        case "}":
          depth--;
          if (capturing && depth === captureFromDepth) {
            // Object closed — emit it.
            buf += chunk.slice(sliceStart, i + 1);
            sliceStart = -1;
            capturing = false;
            const text = buf;
            buf = "";
            if (mode === "detect") mode = "flat"; // first object closed before any features:[ → NDJSON/bare
            const obj = JSON.parse(text) as Record<string, unknown>;
            if (obj && obj["type"] === "Feature") yield obj;
            continue;
          }
          break;
        case "[":
          if (mode === "detect" && capturing && lastKey === "features" && depth === captureFromDepth + 1) {
            // The probed depth-0 object is a FeatureCollection wrapper.
            // Discard the probe buffer; capture its depth-2 feature objects.
            mode = "wrapper";
            capturing = false;
            buf = "";
            sliceStart = -1;
          }
          break;
        default:
          break;
      }

      if (mode === "detect" && capturing && buf.length > MAX_PROBE) {
        throw new Error(
          `GeoJSON probe exceeded ${MAX_PROBE} bytes without finding a "features" array ` +
            `or a complete feature — is this valid (ND)GeoJSON?`,
        );
      }
    }
    if (capturing && sliceStart >= 0) buf += chunk.slice(sliceStart);
  }
}

async function* streamGeoJsonGeocodes(filePath: string): AsyncGenerator<RawGeocode> {
  for await (const feature of streamGeoJsonFeatures(filePath)) {
    const props = (feature["properties"] ?? {}) as Record<string, unknown>;
    const coNoRaw = props["CO_NO"] ?? props["co_no"];
    const pidRaw = props["PARCEL_ID"] ?? props["parcel_id"];
    const coNo = coNoRaw === null || coNoRaw === undefined ? NaN : Number(coNoRaw);
    const centroid = geometryCentroid(feature["geometry"] as Geometry | null);
    yield {
      coNo: Number.isFinite(coNo) ? coNo : null,
      parcelId: pidRaw === null || pidRaw === undefined ? null : String(pidRaw),
      lon: centroid?.lon ?? null,
      lat: centroid?.lat ?? null,
    };
  }
}

interface Geometry {
  type?: string;
  coordinates?: unknown;
}

/** Centroid for Point / MultiPoint / Polygon / MultiPolygon in lon/lat order. */
export function geometryCentroid(geom: Geometry | null | undefined): { lon: number; lat: number } | null {
  if (!geom || !geom.type || geom.coordinates === undefined) return null;
  switch (geom.type) {
    case "Point": {
      const c = geom.coordinates as number[];
      return isPair(c) ? { lon: c[0], lat: c[1] } : null;
    }
    case "MultiPoint": {
      const pts = geom.coordinates as number[][];
      return Array.isArray(pts) && isPair(pts[0]) ? { lon: pts[0][0], lat: pts[0][1] } : null;
    }
    case "Polygon": {
      const rings = geom.coordinates as number[][][];
      return Array.isArray(rings) && rings.length ? ringCentroid(rings[0]) : null;
    }
    case "MultiPolygon": {
      const polys = geom.coordinates as number[][][][];
      if (!Array.isArray(polys) || !polys.length) return null;
      // Use the outer ring with the largest absolute area.
      let best: number[][] | null = null;
      let bestArea = -1;
      for (const poly of polys) {
        const ring = poly?.[0];
        if (!Array.isArray(ring) || ring.length < 3) continue;
        const a = Math.abs(ringSignedArea(ring));
        if (a > bestArea) {
          bestArea = a;
          best = ring;
        }
      }
      return best ? ringCentroid(best) : null;
    }
    default:
      return null;
  }
}

function isPair(c: unknown): c is number[] {
  return Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number";
}

function ringSignedArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return area / 2;
}

/** Signed-area polygon centroid; falls back to the vertex mean when degenerate. */
function ringCentroid(ring: number[][]): { lon: number; lat: number } | null {
  if (!Array.isArray(ring) || ring.length === 0 || !isPair(ring[0])) return null;
  const area = ringSignedArea(ring);
  if (Math.abs(area) > 1e-12) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      cx += (ring[i][0] + ring[i + 1][0]) * cross;
      cy += (ring[i][1] + ring[i + 1][1]) * cross;
    }
    return { lon: cx / (6 * area), lat: cy / (6 * area) };
  }
  // Degenerate ring — vertex mean.
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of ring) {
    if (!isPair(p)) continue;
    sx += p[0];
    sy += p[1];
    n++;
  }
  return n ? { lon: sx / n, lat: sy / n } : null;
}

// ---------------------------------------------------------------------------
// Connection-drop retry — duplicated from lib/scrapers/base/bulk-ingester.ts
// (it is module-private there and that file is outside this lane's ownership).
// Retries idempotent UPDATE batches on connection-level failures only.
// ---------------------------------------------------------------------------

const CONNECTION_DROP_PATTERNS = [
  "ECONNRESET",
  "Server has closed the connection",
  "Can't reach database server",
  "Connection terminated",
  "kind: Closed",
  "P1001",
  "P1017",
  "Transaction already closed",
  "Transaction API error",
];

function isConnectionDrop(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return CONNECTION_DROP_PATTERNS.some((p) => msg.includes(p));
}

async function retryOnConnectionDrop<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < maxRetries && isConnectionDrop(err)) {
        const backoff = Math.min(2 ** attempt * 1000, 8000);
        console.warn(
          `[fl-fgio-bulk] connection drop (attempt ${attempt + 1}/${maxRetries + 1}); retrying in ${backoff}ms:`,
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
