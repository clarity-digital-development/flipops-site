import { createWriteStream, mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { captureRaw } from "../raw-capture";

// ---------------------------------------------------------------------------
// FL DOR Tax Roll Data Files — SharePoint REST API client.
//
// The FL DOR Data Portal is a SharePoint document library. It exposes a
// public REST API at `_api/web/getfolderbyserverrelativeurl(...)/files` that
// returns the full file list as JSON — no auth, no headless browser. Way
// cleaner than my first attempt at JS-rendered scraping.
//
// 2025 structure (verified 2026-05-29):
//   /Tax Roll Data Files/
//     NAL/2025F/{County} {CO_NO} Final NAL 2025.zip      ← 67 files, ~300-500MB total
//     SDF/2025F/{County} {CO_NO} Final SDF 2025.zip      ← 67 files
//     NAP/2025F/{County} {CO_NO} Final NAP 2025.zip      ← 67 files
//
// No statewide bundle — per-county files only. Smallest = Baker (1MB);
// biggest = Pinellas (53MB), Miami-Dade likely larger still.
//
// GREEN-ZONE per the risk policy (see [[feedback-scraping-risk-policy]]):
// the API is public, no rate limit documented, no auth. RawSnapshot
// captures the listing so we detect URL-scheme changes year-over-year.
// ---------------------------------------------------------------------------

const PORTAL_ORIGIN = "https://floridarevenue.com";
const PORTAL_BASE = `${PORTAL_ORIGIN}/property/dataportal`;
const TAX_ROLL_PATH = "/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files";

export interface DorFile {
  filename: string;
  category: "NAL" | "SDF" | "NAP";
  vintage: string;     // year like "2025"
  vintageTag: string;  // e.g. "2025F" for Final roll
  county: string;      // county name as DOR encodes it
  coNo: number;        // FL DOR county number
  sizeBytes: number;
  downloadUrl: string;
}

interface SharePointFileResult {
  Name: string;
  Length: string | number;
  ServerRelativeUrl: string;
  TimeLastModified?: string;
}

/** List every file in a SharePoint folder via REST API. */
async function listFolder(serverRelativeUrl: string): Promise<SharePointFileResult[]> {
  const url = `${PORTAL_BASE}/_api/web/getfolderbyserverrelativeurl('${encodeURIComponent(serverRelativeUrl)}')/files`;
  const res = await fetch(url, { headers: { Accept: "application/json;odata=verbose" } });
  if (!res.ok) throw new Error(`SharePoint listFolder failed (${res.status}): ${serverRelativeUrl}`);
  const json = await res.json() as { d?: { results?: SharePointFileResult[] } };
  return json.d?.results ?? [];
}

async function listSubfolders(serverRelativeUrl: string): Promise<string[]> {
  const url = `${PORTAL_BASE}/_api/web/getfolderbyserverrelativeurl('${encodeURIComponent(serverRelativeUrl)}')/folders`;
  const res = await fetch(url, { headers: { Accept: "application/json;odata=verbose" } });
  if (!res.ok) throw new Error(`SharePoint listSubfolders failed (${res.status}): ${serverRelativeUrl}`);
  const json = await res.json() as { d?: { results?: Array<{ Name: string }> } };
  return (json.d?.results ?? []).map((f) => f.Name).filter((n) => !n.startsWith("~"));
}

/**
 * Discover every NAL / SDF / NAP file currently published for the given
 * vintage. Falls back to discovering vintages dynamically if none specified.
 */
export async function listDorFiles(opts: { categories?: Array<"NAL" | "SDF" | "NAP">; vintage?: string } = {}): Promise<DorFile[]> {
  const categories = opts.categories ?? ["NAL", "SDF", "NAP"];
  const files: DorFile[] = [];

  for (const category of categories) {
    const categoryPath = `${TAX_ROLL_PATH}/${category}`;
    const vintages = await listSubfolders(categoryPath);
    const targetVintages = opts.vintage ? vintages.filter((v) => v.startsWith(opts.vintage!)) : vintages;

    for (const vintageTag of targetVintages) {
      const folderPath = `${categoryPath}/${vintageTag}`;
      const folderFiles = await listFolder(folderPath);

      for (const f of folderFiles) {
        const sizeBytes = Number.parseInt(String(f.Length ?? "0"), 10) || 0;
        const parsed = parseDorFilename(f.Name);
        if (!parsed) continue;
        files.push({
          filename: f.Name,
          category,
          vintage: parsed.vintage,
          vintageTag,
          county: parsed.county,
          coNo: parsed.coNo,
          sizeBytes,
          downloadUrl: `${PORTAL_ORIGIN}${f.ServerRelativeUrl}`,
        });
      }
    }
  }

  // Bronze: capture the discovery result so we detect URL-scheme changes
  // year-over-year. Append-only.
  void captureRaw({
    entityType: "parcel",
    source: "fl-dor-portal",
    sourceTag: "fl-dor-portal:discovery",
    category: "directory_listing",
    requestParams: { categories, vintage: opts.vintage ?? null },
    rawResponse: { files, capturedAt: new Date().toISOString() },
  });

  return files;
}

/**
 * Parse "Baker 12 Final NAL 2025.zip" → { county: "Baker", coNo: 12, vintage: "2025" }
 *
 * Tolerant of DOR filename typos (verified live on the 2025F roll):
 *   "Dixie 25 Final SDF 2025..zip"   ← double dot (this dropped Dixie's
 *                                       entire SDF track in the F1 ingest)
 *   "Collier 21 Final SDF  2025.zip" ← double space (handled by \s+)
 */
function parseDorFilename(name: string): { county: string; coNo: number; vintage: string } | null {
  const m = name.match(/^(.+?)\s+(\d{1,2})\s+(?:Final|Initial|Prelim\w*)?\s*(?:NAL|SDF|NAP)\s+(\d{4})\s*\.+zip$/i);
  if (!m) return null;
  return { county: m[1].trim(), coNo: Number.parseInt(m[2], 10), vintage: m[3] };
}

/**
 * Stream a single DOR file to disk. Skips if a complete copy already exists
 * (compared by Length from the API). Set HTTP_PROXY / HTTPS_PROXY env vars
 * to route through Bright Data when rate-limiting is a concern (not needed
 * for the DOR portal but supported uniformly across all scrapers).
 */
export async function downloadDorFile(file: DorFile, destDir: string): Promise<string> {
  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, file.filename);

  if (existsSync(dest)) {
    const have = statSync(dest).size;
    if (have === file.sizeBytes) return dest; // already complete
  }

  const res = await fetch(file.downloadUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${file.filename}: HTTP ${res.status}`);
  }

  await pipeline(
    Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream),
    createWriteStream(dest),
  );

  const final = statSync(dest).size;
  if (final !== file.sizeBytes) {
    console.warn(`[fl-dor-portal] size mismatch for ${file.filename}: got ${final}, expected ${file.sizeBytes}`);
  }
  return dest;
}

/**
 * Download every NAL + SDF file for a given vintage in parallel (with a
 * concurrency cap). Returns the local paths grouped by category.
 */
export async function downloadVintage(vintage: string, destDir: string, opts: { categories?: Array<"NAL" | "SDF" | "NAP">; concurrency?: number } = {}): Promise<{ category: "NAL" | "SDF" | "NAP"; coNo: number; county: string; path: string }[]> {
  const categories = opts.categories ?? ["NAL", "SDF"];
  const concurrency = opts.concurrency ?? 4;

  const files = await listDorFiles({ categories, vintage });
  const result: { category: "NAL" | "SDF" | "NAP"; coNo: number; county: string; path: string }[] = [];

  // Worker-pool style: keep `concurrency` downloads in flight.
  const queue = [...files];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      if (!f) return;
      try {
        const p = await downloadDorFile(f, path.join(destDir, f.category, f.vintageTag));
        result.push({ category: f.category, coNo: f.coNo, county: f.county, path: p });
      } catch (err) {
        console.warn(`[fl-dor-portal] download failed for ${f.filename}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return result;
}
