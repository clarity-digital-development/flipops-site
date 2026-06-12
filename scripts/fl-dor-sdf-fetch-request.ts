/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

// ---------------------------------------------------------------------------
// FL DOR SDF — fetch + stage the OPS-7 request-fulfilled vintages (M2.7).
//
// DOR fulfilled our public-records request (2010F–2024F Final SDF, all 67
// counties) into a per-request SharePoint dropbox folder. Unlike the standard
// Tax Roll Data Files area (one zip per county, current vintage only), the
// request folder holds ONE statewide zip per vintage:
//
//   ~Public Records/~20260611-1338764/SDF/<YEAR>F.zip
//        └─ <YEAR>F/SDF_<YEAR>_<CO_NO><County>_F.csv   (67 per-county CSVs)
//
// The CSVs are the standard DOR SDF layout (CO_NO, PARCEL_ID, …, SALE_YR,
// SALE_MO, SALE_PRC, QUAL_CD, …) — exactly what FlDorSdfIngester parses.
//
// This script bridges the packaging gap: it downloads each <YEAR>F.zip and
// extracts its 67 CSVs into the backfill runner's local-drop layout, named so
// `localFileCoNo()` maps each deterministically by CO_NO:
//
//   data/raw/fl-dor-sdf-backfill/<YEAR>/co<CO_NO>_SDF_<YEAR>.csv
//
// Then run the existing multi-vintage runner (overlap-cap, idempotency,
// priority ordering, BulkIngestJob audit all reused):
//
//   npx tsx -r dotenv/config scripts/fl-dor-sdf-backfill.ts dotenv_config_path=.env.local
//
// Idempotent: re-downloads only if the local zip size differs from the portal;
// re-extracts only CSVs that are missing/empty.
//
// Flags:
//   VINTAGES=2024,2023   only fetch these vintages (default: all 15 found)
//   KEEP_ZIPS=false      delete each <YEAR>F.zip after extraction (save disk)
//
// Run:
//   npx tsx scripts/fl-dor-sdf-fetch-request.ts
// ---------------------------------------------------------------------------

const PORTAL_ORIGIN = "https://floridarevenue.com";
const PORTAL_BASE = `${PORTAL_ORIGIN}/property/dataportal`;
// The per-request dropbox folder DOR created for OPS-7 (path is stable for the
// life of the request; folder/files are public, no auth).
const REQUEST_SDF_PATH =
  "/property/dataportal/Documents/PTO Data Portal/~Public Records/~20260611-1338764/SDF";

const ZIP_CACHE_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-sdf-request");
const DROP_ROOT = path.resolve(process.cwd(), "data/raw/fl-dor-sdf-backfill");

const ONLY_VINTAGES = (process.env.VINTAGES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const KEEP_ZIPS = process.env.KEEP_ZIPS !== "false";

interface PortalFile {
  name: string; // e.g. "2012F.zip"
  vintage: string; // "2012"
  serverRelativeUrl: string;
  sizeBytes: number;
}

/** List the <YEAR>F.zip files in the request folder via the SharePoint REST API. */
async function listRequestZips(): Promise<PortalFile[]> {
  const url = `${PORTAL_BASE}/_api/web/getfolderbyserverrelativeurl('${encodeURIComponent(
    REQUEST_SDF_PATH,
  )}')/files`;
  const res = await fetch(url, { headers: { Accept: "application/json;odata=verbose" } });
  if (!res.ok) throw new Error(`SharePoint listFolder failed (${res.status}) for ${REQUEST_SDF_PATH}`);
  const json = (await res.json()) as {
    d?: { results?: Array<{ Name: string; Length: string | number; ServerRelativeUrl: string }> };
  };
  const out: PortalFile[] = [];
  for (const f of json.d?.results ?? []) {
    const m = f.Name.match(/^(\d{4})F\.zip$/i);
    if (!m) continue;
    out.push({
      name: f.Name,
      vintage: m[1],
      serverRelativeUrl: f.ServerRelativeUrl,
      sizeBytes: Number.parseInt(String(f.Length ?? "0"), 10) || 0,
    });
  }
  // Newest first — comps/AVM value decays with sale age, so the highest-value
  // vintages land on disk first.
  return out.sort((a, b) => b.vintage.localeCompare(a.vintage));
}

/** Download a vintage zip to the cache dir, skipping if a complete copy exists. */
async function downloadZip(file: PortalFile): Promise<string> {
  fs.mkdirSync(ZIP_CACHE_DIR, { recursive: true });
  const dest = path.join(ZIP_CACHE_DIR, file.name);
  if (fs.existsSync(dest) && fs.statSync(dest).size === file.sizeBytes) {
    console.log(`  = ${file.name} already downloaded (${(file.sizeBytes / 1048576).toFixed(1)} MB)`);
    return dest;
  }
  console.log(`  ↓ ${file.name} (${(file.sizeBytes / 1048576).toFixed(1)} MB)…`);
  const res = await fetch(PORTAL_ORIGIN + file.serverRelativeUrl);
  if (!res.ok) throw new Error(`download failed for ${file.name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  if (buf.length !== file.sizeBytes) {
    console.warn(`    ⚠ size mismatch for ${file.name}: got ${buf.length}, expected ${file.sizeBytes}`);
  }
  return dest;
}

/**
 * Extract the 67 per-county CSVs from a vintage zip into the runner drop dir,
 * renamed `co<CO_NO>_SDF_<YEAR>.csv` so localFileCoNo() maps each by CO_NO.
 * Returns the number of CSVs written.
 */
function extractVintage(zipPath: string, vintage: string): number {
  const outDir = path.join(DROP_ROOT, vintage);
  fs.mkdirSync(outDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  let written = 0;
  let skipped = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const base = path.basename(entry.entryName);
    if (!/\.csv$/i.test(base)) continue;
    // SDF_<YEAR>_<CO_NO><County>_F.csv  → CO_NO is the digits after the year.
    const m = base.match(/SDF_\d{4}_(\d{1,2})[A-Za-z]/i);
    if (!m) {
      console.warn(`    ? cannot parse CO_NO from ${base} — skipped`);
      continue;
    }
    const coNo = Number.parseInt(m[1], 10);
    const target = path.join(outDir, `co${coNo}_SDF_${vintage}.csv`);
    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
      skipped++;
      continue;
    }
    fs.writeFileSync(target, entry.getData());
    written++;
  }
  console.log(`    extracted ${written} CSV(s)${skipped ? ` (+${skipped} already present)` : ""} → ${path.relative(process.cwd(), outDir)}`);
  return written;
}

async function main() {
  console.log("=== FL DOR SDF request-fetch (OPS-7 backfill staging) ===");
  const start = Date.now();

  let zips = await listRequestZips();
  if (ONLY_VINTAGES.length) zips = zips.filter((z) => ONLY_VINTAGES.includes(z.vintage));
  if (zips.length === 0) {
    console.log("No <YEAR>F.zip files found in the request folder (path expired or VINTAGES filter too narrow).");
    process.exit(2);
  }
  console.log(
    `Vintages found: ${zips.map((z) => z.vintage).join(", ")} ` +
      `(${(zips.reduce((s, z) => s + z.sizeBytes, 0) / 1048576).toFixed(0)} MB total zipped)\n`,
  );

  let totalCsvs = 0;
  for (const file of zips) {
    console.log(`Vintage ${file.vintage}:`);
    const zipPath = await downloadZip(file);
    totalCsvs += extractVintage(zipPath, file.vintage);
    if (!KEEP_ZIPS) {
      fs.rmSync(zipPath, { force: true });
      console.log(`    removed ${file.name} (KEEP_ZIPS=false)`);
    }
  }

  console.log(
    `\nDone: ${zips.length} vintage(s), ${totalCsvs} new CSV(s) staged under ` +
      `${path.relative(process.cwd(), DROP_ROOT)}/<YEAR>/ in ${((Date.now() - start) / 1000).toFixed(0)}s.`,
  );
  console.log(
    "\nNext: ingest with the multi-vintage runner (resumable, idempotent):\n" +
      "  npx tsx -r dotenv/config scripts/fl-dor-sdf-backfill.ts dotenv_config_path=.env.local",
  );
}

main().catch((err) => {
  console.error("SDF request-fetch failed:", err);
  process.exit(1);
});
