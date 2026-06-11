/* eslint-disable no-console */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Hillsborough (12057) geocode converter — HCPA Public Downloads → NDJSON for
// scripts/ingest-fl-geocodes.ts.
//
// The FGIO Hub exporter 500s on Hillsborough, the HCPA gis server's
// WebParcels/ParcelCentroids MapServer layers reject every /query shape
// (HTTP 400 "Failed to execute query"), so the workable county path is the
// HCPA Public Downloads portal (https://downloads.hcpafl.org — ASP.NET
// postback site; files land via __doPostBack on the grdFiles grid):
//
//   • LatLon_Table_*.zip → latlon.dbf  (FOLIO C10, lat F, lon F) ~465K rows
//   • parcel_*.zip       → parcel.dbf  (FOLIO C10, STRAP C22, …) ~531K rows
//
// parcel.dbf's STRAP is byte-identical to the FL DOR NAL PARCEL_ID we store
// in Parcel.apn for 12057 (e.g. "153323ZZZ000000000200A") — verified against
// live rows 2026-06-10. The LatLon table is keyed by the 10-digit HCPA folio,
// so this joins folio → strap and emits one GeoJSON Feature per line with
// {CO_NO: 39, PARCEL_ID: <strap>} + Point(lon, lat) in EPSG:4326 — exactly
// what lib/data-sources/bulk/fl-fgio-bulk.ts's NDJSON path parses.
//
// Usage:
//   npx tsx scripts/convert-county-gis.ts \
//     --latlon data/raw/county-gis/12057-latlon-table.zip \
//     --parcel data/raw/county-gis/12057-parcel.zip \
//     --out data/raw/county-gis/12057.ndjson
// ---------------------------------------------------------------------------

interface DbfField {
  name: string;
  length: number;
  offset: number;
}

interface DbfTable {
  recordCount: number;
  recordSize: number;
  fields: Map<string, DbfField>;
  /** Buffer positioned at the first record. */
  records: Buffer;
}

function parseDbf(buf: Buffer): DbfTable {
  const recordCount = buf.readUInt32LE(4);
  const headerSize = buf.readUInt16LE(8);
  const recordSize = buf.readUInt16LE(10);
  const fields = new Map<string, DbfField>();
  let off = 32;
  let pos = 1; // byte 0 of each record is the deletion flag
  while (off + 32 <= headerSize && buf[off] !== 0x0d) {
    const name = buf.subarray(off, off + 11).toString("ascii").split("\0")[0].trim();
    const length = buf[off + 16];
    fields.set(name.toUpperCase(), { name, length, offset: pos });
    pos += length;
    off += 32;
  }
  return { recordCount, recordSize, fields, records: buf.subarray(headerSize) };
}

function readField(t: DbfTable, recIdx: number, f: DbfField): string {
  const base = recIdx * t.recordSize;
  return t.records.subarray(base + f.offset, base + f.offset + f.length).toString("ascii").trim();
}

function isDeleted(t: DbfTable, recIdx: number): boolean {
  return t.records[recIdx * t.recordSize] === 0x2a; // '*'
}

async function loadDbfFromZip(zipPath: string, dbfName?: string): Promise<DbfTable> {
  const { default: AdmZip } = await import("adm-zip");
  const zip = new AdmZip(zipPath);
  const entry = zip
    .getEntries()
    .find((e) =>
      dbfName ? e.entryName.toLowerCase() === dbfName : e.entryName.toLowerCase().endsWith(".dbf"),
    );
  if (!entry) throw new Error(`No ${dbfName ?? ".dbf"} entry in ${zipPath}`);
  return parseDbf(entry.getData());
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const latlonZip = args.latlon ?? path.join("data", "raw", "county-gis", "12057-latlon-table.zip");
  const parcelZip = args.parcel ?? path.join("data", "raw", "county-gis", "12057-parcel.zip");
  const outPath = args.out ?? path.join("data", "raw", "county-gis", "12057.ndjson");
  for (const p of [latlonZip, parcelZip]) {
    if (!existsSync(p)) throw new Error(`Missing input: ${p}`);
  }
  mkdirSync(path.dirname(outPath), { recursive: true });

  console.log(`Loading LatLon table from ${latlonZip}…`);
  const latlon = await loadDbfFromZip(latlonZip);
  const llFolio = latlon.fields.get("FOLIO");
  const llLat = latlon.fields.get("LAT");
  const llLon = latlon.fields.get("LON");
  if (!llFolio || !llLat || !llLon) {
    throw new Error(`latlon.dbf missing FOLIO/lat/lon fields (have: ${[...latlon.fields.keys()].join(",")})`);
  }
  const coords = new Map<string, [number, number]>();
  let badCoord = 0;
  for (let i = 0; i < latlon.recordCount; i++) {
    if (isDeleted(latlon, i)) continue;
    const folio = readField(latlon, i, llFolio);
    const lat = Number.parseFloat(readField(latlon, i, llLat));
    const lon = Number.parseFloat(readField(latlon, i, llLon));
    if (!folio || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      badCoord++;
      continue;
    }
    coords.set(folio, [lon, lat]);
  }
  console.log(`  ${coords.size} folio→(lon,lat) entries (${badCoord} unparseable)`);

  console.log(`Loading parcel attribute table from ${parcelZip}…`);
  const parcel = await loadDbfFromZip(parcelZip, "parcel.dbf");
  const pFolio = parcel.fields.get("FOLIO");
  const pStrap = parcel.fields.get("STRAP");
  if (!pFolio || !pStrap) {
    throw new Error(`parcel.dbf missing FOLIO/STRAP fields (have: ${[...parcel.fields.keys()].join(",")})`);
  }

  const out = createWriteStream(outPath);
  let written = 0;
  let noCoord = 0;
  let noStrap = 0;
  for (let i = 0; i < parcel.recordCount; i++) {
    if (isDeleted(parcel, i)) continue;
    const folio = readField(parcel, i, pFolio);
    const strap = readField(parcel, i, pStrap);
    if (!strap) {
      noStrap++;
      continue;
    }
    const c = coords.get(folio);
    if (!c) {
      noCoord++;
      continue;
    }
    const line = JSON.stringify({
      type: "Feature",
      properties: { CO_NO: 39, PARCEL_ID: strap },
      geometry: { type: "Point", coordinates: c },
    });
    if (!out.write(line + "\n")) await new Promise<void>((r) => out.once("drain", () => r()));
    written++;
  }
  await new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.end(() => resolve());
  });
  console.log(
    `Done: ${written} features → ${outPath} (no-coord=${noCoord}, no-strap=${noStrap}, parcelRows=${parcel.recordCount})`,
  );
}

main().catch((err) => {
  console.error("❌ convert-county-gis failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
