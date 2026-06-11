/* eslint-disable no-console */
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { listDorFiles, downloadDorFile, type DorFile } from "@/lib/data-sources/bulk/fl-dor-portal";
import { FlDorSdfIngester } from "@/lib/data-sources/bulk/fl-dor-sdf";
import { FL_COUNTIES } from "@/lib/data-sources/bulk/fl-counties";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// FL DOR SDF multi-vintage backfill runner (M2.7).
//
// Why this exists: each roll-year-V SDF file contains sale events from
// calendar years V-1 and V only (verified empirically — the 2025F ingest
// produced sales 2024-01 → 2026-02, nothing older). The 2009→present span
// promised in FL-COVERAGE-PLAN therefore requires vintages 2010F…2024F.
//
// Availability (verified 2026-06-10):
//   - floridarevenue.com data portal hosts ONLY the current vintage (2025F).
//     SDF/<year>F folders for prior years do not exist; Wayback has no
//     archived NAL/SDF zips; FGDL parcel layers were removed Oct 2025 at
//     the GIO's request; old DOR FTP (sdrftp03.dor.state.fl.us) is empty.
//   - Prior vintages (sale files 2009→current) are FREE BY REQUEST from
//     DOR PTO: email PTOTechnology@floridarevenue.com with year(s),
//     county/-ies, and roll file type ("Final SDF").
//
// So this runner ingests from two places, per vintage:
//   1. The portal, when a vintage folder exists there (e.g. 2025F — also
//      useful for refresh runs: DOR keeps updating the current-year files,
//      so a FORCE re-run picks up the newest months of sales).
//   2. A local drop directory for request-fulfilled files:
//        data/raw/fl-dor-sdf-backfill/<vintage>/*.zip   (or *.csv)
//      Filenames must keep DOR's "<County> <CO_NO> Final SDF <YYYY>.zip"
//      shape (typo-tolerant) OR contain "co<NO>"/the county name.
//
// Cross-vintage overlap: vintage V and V+1 both contain year-V sales. When
// a higher vintage has already succeeded for a county, this runner caps the
// lower vintage at maxSaleYear = V-1 so the overlapping year isn't written
// twice under a second source tag. (ParcelSale's unique key includes
// `source` = bulk:fl-dor-sdf-<vintage>, so the constraint alone would NOT
// dedup across vintages.)
//
// Idempotency: per-vintage re-runs are no-ops at the SQL level
// (ON CONFLICT (countyFips, apn, saleDate, source) DO NOTHING). NOTE:
// recordsUpserted counts attempted rows, not net-new — verify net-new via
// row-count deltas, not the job audit numbers.
//
// Environment / flags:
//   VINTAGES=2024,2023        vintages to process (default: all discovered
//                             on the portal + all local drop dirs)
//   ONLY=12029,12086          comma-separated FIPS subset
//   FORCE=true                re-ingest county-vintages with succeeded jobs
//   NO_OVERLAP_CAP=true       disable the maxSaleYear overlap cap
//   MAX_RECORDS=5000          per-county cap (smoke testing)
//
// Run:
//   npx tsx -r dotenv/config scripts/fl-dor-sdf-backfill.ts dotenv_config_path=.env.local
//
// County order: Dixie first (the 2025 filename-typo casualty), then the
// top-6 metros (Dade, Broward, Palm Beach, Hillsborough, Orange, Duval),
// then everything else — comps/AVM value density first.
// ---------------------------------------------------------------------------

const VINTAGES = (process.env.VINTAGES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ONLY_FIPS = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const FORCE = process.env.FORCE === "true";
const NO_OVERLAP_CAP = process.env.NO_OVERLAP_CAP === "true";
const MAX_RECORDS = process.env.MAX_RECORDS ? Number.parseInt(process.env.MAX_RECORDS, 10) : undefined;
const LOCAL_DROP_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-sdf-backfill");

// Dixie first, then top-6 metros by CO_NO, then the rest.
const PRIORITY_CO_NOS = [25, 23, 16, 60, 39, 58, 26]; // Dixie, Dade, Broward, PalmBeach, Hillsborough, Orange, Duval

interface VintageSource {
  vintage: string;
  /** portal files keyed by coNo */
  portal: Map<number, DorFile>;
  /** local zip/csv paths keyed by coNo */
  local: Map<number, string>;
}

function orderedCounties() {
  const scoped = ONLY_FIPS.length > 0 ? FL_COUNTIES.filter((c) => ONLY_FIPS.includes(c.fips)) : FL_COUNTIES;
  return [...scoped].sort((a, b) => {
    const pa = PRIORITY_CO_NOS.indexOf(a.coNo);
    const pb = PRIORITY_CO_NOS.indexOf(b.coNo);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return a.coNo - b.coNo;
  });
}

/** Match a local drop file to a county. Reuses DOR naming, typo-tolerant. */
function localFileCoNo(filename: string): number | null {
  const dor = filename.match(/^(.+?)\s+(\d{1,2})\s+(?:Final|Initial|Prelim\w*)?\s*SDF\s+(\d{4})\s*\.+(?:zip|csv)$/i);
  if (dor) return Number.parseInt(dor[2], 10);
  const co = filename.match(/co[._ -]?(\d{1,2})\b/i);
  if (co) return Number.parseInt(co[1], 10);
  const lower = filename.toLowerCase();
  const byName = FL_COUNTIES.find((c) => lower.includes(c.name.toLowerCase().replace(/\s+/g, " ")));
  return byName?.coNo ?? null;
}

async function discoverSources(): Promise<VintageSource[]> {
  const byVintage = new Map<string, VintageSource>();
  const ensure = (v: string) => {
    let s = byVintage.get(v);
    if (!s) { s = { vintage: v, portal: new Map(), local: new Map() }; byVintage.set(v, s); }
    return s;
  };

  // Portal discovery (all vintages DOR currently hosts — typically just one)
  try {
    const portalFiles = await listDorFiles({ categories: ["SDF"] });
    for (const f of portalFiles) ensure(f.vintage).portal.set(f.coNo, f);
  } catch (err) {
    console.warn("portal discovery failed (continuing with local drops only):", err instanceof Error ? err.message : err);
  }

  // Local drop dirs: data/raw/fl-dor-sdf-backfill/<vintage>/*.{zip,csv}
  if (fs.existsSync(LOCAL_DROP_DIR)) {
    for (const dir of fs.readdirSync(LOCAL_DROP_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory() || !/^\d{4}$/.test(dir.name)) continue;
      const src = ensure(dir.name);
      for (const file of fs.readdirSync(path.join(LOCAL_DROP_DIR, dir.name))) {
        if (!/\.(zip|csv)$/i.test(file)) continue;
        const coNo = localFileCoNo(file);
        if (coNo === null) { console.warn(`  ? cannot map local file to a county: ${dir.name}/${file}`); continue; }
        src.local.set(coNo, path.join(LOCAL_DROP_DIR, dir.name, file));
      }
    }
  }

  let sources = [...byVintage.values()];
  if (VINTAGES.length > 0) sources = sources.filter((s) => VINTAGES.includes(s.vintage));
  // Newest first — comps/AVM value decays with sale age.
  return sources.sort((a, b) => b.vintage.localeCompare(a.vintage));
}

function extractCsv(zipOrCsvPath: string, extractDir: string): string | null {
  if (/\.csv$/i.test(zipOrCsvPath)) return zipOrCsvPath;
  fs.mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipOrCsvPath);
  for (const e of zip.getEntries()) {
    const n = e.entryName.toLowerCase();
    if (n.endsWith(".csv") || n.endsWith(".txt")) {
      zip.extractEntryTo(e.entryName, extractDir, false, true);
      return path.join(extractDir, path.basename(e.entryName));
    }
  }
  return null;
}

async function main() {
  const overallStart = Date.now();
  console.log("=== FL DOR SDF multi-vintage backfill ===");
  console.log(`started: ${new Date().toISOString()}`);
  if (FORCE) console.log("⚠ FORCE — succeeded county-vintages re-ingest");
  if (MAX_RECORDS) console.log(`⚠ MAX_RECORDS=${MAX_RECORDS} (smoke mode)`);

  const sources = await discoverSources();
  if (sources.length === 0) {
    console.log("No SDF vintages found (portal empty + no local drops). Request prior vintages from PTOTechnology@floridarevenue.com and drop the zips under data/raw/fl-dor-sdf-backfill/<vintage>/.");
    return;
  }
  console.log(`Vintages in scope: ${sources.map((s) => `${s.vintage} (portal=${s.portal.size}, local=${s.local.size})`).join(", ")}`);

  // Prior succeeded jobs → resume + overlap-cap decisions.
  const priorJobs = await prisma.bulkIngestJob.findMany({
    where: { sourceTag: { startsWith: "bulk:fl-dor-sdf-" }, status: "succeeded" },
    select: { sourceTag: true, scope: true },
  });
  const succeeded = new Set(priorJobs.map((j) => `${j.sourceTag}|${j.scope}`));
  const maxSucceededVintageByFips = new Map<string, number>();
  for (const j of priorJobs) {
    const v = Number.parseInt(j.sourceTag.replace("bulk:fl-dor-sdf-", ""), 10);
    if (!Number.isFinite(v)) continue;
    const cur = maxSucceededVintageByFips.get(j.scope) ?? 0;
    if (v > cur) maxSucceededVintageByFips.set(j.scope, v);
  }

  const counties = orderedCounties();
  const results: Array<{ vintage: string; name: string; ok: boolean; rows: number; err?: string }> = [];

  for (const src of sources) {
    console.log(`\n=== Vintage ${src.vintage} ===`);
    const vNum = Number.parseInt(src.vintage, 10);

    for (const county of counties) {
      const tag = `bulk:fl-dor-sdf-${src.vintage}`;
      if (!FORCE && succeeded.has(`${tag}|${county.fips}`)) continue;

      // Locate the file: local drop wins (request-fulfilled), else portal.
      let zipPath = src.local.get(county.coNo) ?? null;
      if (!zipPath) {
        const pf = src.portal.get(county.coNo);
        if (pf) {
          try {
            zipPath = await downloadDorFile(pf, path.resolve(process.cwd(), `data/raw/fl-dor-${src.vintage}/SDF/${pf.vintageTag}`));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`  ✗ ${county.name.padEnd(18)} download failed: ${msg}`);
            results.push({ vintage: src.vintage, name: county.name, ok: false, rows: 0, err: `download: ${msg}` });
            continue;
          }
        }
      }
      if (!zipPath) {
        console.log(`  - ${county.name.padEnd(18)} no ${src.vintage} SDF file available (portal or local) — skipped`);
        continue;
      }

      const csvPath = extractCsv(zipPath, path.resolve(process.cwd(), `data/raw/fl-dor-${src.vintage}/extracted/SDF_${src.vintage}_co${county.coNo}`));
      if (!csvPath) {
        console.log(`  ✗ ${county.name.padEnd(18)} no CSV inside ${path.basename(zipPath)}`);
        results.push({ vintage: src.vintage, name: county.name, ok: false, rows: 0, err: "no CSV in zip" });
        continue;
      }

      // Overlap cap: vintage V's file spans sale years V-1..V. If a higher
      // vintage already succeeded for this county, year V is covered — cap
      // at V-1.
      const higherIngested = (maxSucceededVintageByFips.get(county.fips) ?? 0) > vNum;
      const maxSaleYear = !NO_OVERLAP_CAP && higherIngested && Number.isFinite(vNum) ? vNum - 1 : undefined;

      const start = Date.now();
      try {
        const r = await new FlDorSdfIngester({ sdfCsvPath: csvPath, vintage: src.vintage, batchSize: 1500, maxSaleYear })
          .ingest({ countyFips: county.fips, maxRecords: MAX_RECORDS });
        const sec = (Date.now() - start) / 1000;
        console.log(`  ✓ ${county.name.padEnd(18)} ${r.recordsUpserted.toLocaleString().padStart(9)} rows in ${sec.toFixed(0).padStart(4)}s${maxSaleYear ? `  (saleYear ≤ ${maxSaleYear})` : ""}`);
        results.push({ vintage: src.vintage, name: county.name, ok: true, rows: r.recordsUpserted });
        succeeded.add(`${tag}|${county.fips}`);
        const cur = maxSucceededVintageByFips.get(county.fips) ?? 0;
        if (vNum > cur) maxSucceededVintageByFips.set(county.fips, vNum);
      } catch (err) {
        const msg = (err as Error).message?.split("\n")[0] ?? String(err);
        console.log(`  ✗ ${county.name.padEnd(18)} ingest failed: ${msg}`);
        results.push({ vintage: src.vintage, name: county.name, ok: false, rows: 0, err: msg });
      }
    }
  }

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`  County-vintages processed: ${results.length} (${ok.length} ok, ${failed.length} failed)`);
  console.log(`  Rows attempted (incl. conflict-skipped): ${ok.reduce((s, r) => s + r.rows, 0).toLocaleString()}`);
  console.log(`  Wall-clock: ${((Date.now() - overallStart) / 60000).toFixed(1)} min`);
  for (const f of failed) console.log(`    ✗ ${f.vintage} ${f.name} — ${f.err}`);

  const span = await prisma.$queryRawUnsafe<Array<{ min_sale: Date | null; max_sale: Date | null; total: bigint }>>(
    `SELECT min("saleDate") AS min_sale, max("saleDate") AS max_sale, count(*)::bigint AS total FROM "ParcelSale"`,
  );
  if (span[0]) {
    console.log(`  ParcelSale now: ${Number(span[0].total).toLocaleString()} rows, ${span[0].min_sale?.toISOString().slice(0, 7)} → ${span[0].max_sale?.toISOString().slice(0, 7)}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("SDF backfill crashed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
