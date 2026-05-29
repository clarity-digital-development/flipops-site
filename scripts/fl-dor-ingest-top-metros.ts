/* eslint-disable no-console */
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { listDorFiles, downloadDorFile } from "@/lib/data-sources/bulk/fl-dor-portal";
import { FlDorIngester } from "@/lib/data-sources/bulk/fl-dor";
import { flCountyByCoNo } from "@/lib/data-sources/bulk/fl-counties";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Multi-county NAL ingest — top-5 FL metros (Dade, Pinellas, Broward, Lee,
// Palm Beach). User-selected validation batch before the full 67-county run.
//
// Strategy: download all 5 .zips in parallel (network-bound), then ingest
// them serially (db-bound; concurrent INSERTs would just queue at Railway
// PG). Each county's BulkIngestJob audit row stays independent.
//
// Run: npx tsx -r dotenv/config scripts/fl-dor-ingest-top-metros.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

const TOP_METROS = [
  { coNo: 23, name: "Dade" },        // Miami-Dade, ~715k parcels
  { coNo: 62, name: "Pinellas" },    // ~480k
  { coNo: 16, name: "Broward" },     // ~700k
  { coNo: 46, name: "Lee" },         // ~525k
  { coNo: 60, name: "Palm Beach" },  // ~635k
];
const VINTAGE = process.env.VINTAGE ?? "2025";
const RAW_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-2025");

async function discoverFiles() {
  console.log("=== Phase 1: discover NAL URLs via SharePoint REST API ===");
  const allNal = await listDorFiles({ categories: ["NAL"], vintage: VINTAGE });
  const targets = TOP_METROS.map((m) => {
    const f = allNal.find((x) => x.coNo === m.coNo);
    if (!f) throw new Error(`No ${VINTAGE} NAL for CO_NO=${m.coNo} (${m.name})`);
    return { ...m, file: f };
  });
  for (const t of targets) {
    console.log(`  ${t.name.padEnd(12)} CO_NO=${String(t.coNo).padStart(2)}  ${(t.file.sizeBytes / 1024 / 1024).toFixed(1)} MB`);
  }
  return targets;
}

async function downloadAll(targets: Awaited<ReturnType<typeof discoverFiles>>) {
  console.log("\n=== Phase 2: download (parallel) ===");
  const dest = path.join(RAW_DIR, "NAL", "2025F");
  const results = await Promise.all(
    targets.map(async (t) => {
      const start = Date.now();
      const zipPath = await downloadDorFile(t.file, dest);
      console.log(`  ✓ ${t.name.padEnd(12)} ${((Date.now() - start) / 1000).toFixed(1)}s — ${zipPath}`);
      return { ...t, zipPath };
    }),
  );
  return results;
}

function extractCsv(zipPath: string, county: { coNo: number; name: string }): string {
  const extractDir = path.join(RAW_DIR, "extracted", `NAL_${VINTAGE}_co${county.coNo}`);
  fs.mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  for (const e of zip.getEntries()) {
    const n = e.entryName.toLowerCase();
    if (n.endsWith(".csv") || n.endsWith(".txt")) {
      const out = path.join(extractDir, path.basename(e.entryName));
      zip.extractEntryTo(e.entryName, extractDir, false, true);
      return out;
    }
  }
  throw new Error(`No CSV in ${zipPath}`);
}

async function ingestOne(target: { coNo: number; name: string; zipPath: string }) {
  const county = flCountyByCoNo(target.coNo)!;
  const csvPath = extractCsv(target.zipPath, target);
  const fileSizeMb = (fs.statSync(csvPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n  → ${target.name} (FIPS=${county.fips}) — CSV ${fileSizeMb} MB`);

  const before = await prisma.parcel.count({ where: { countyFips: county.fips, source: `bulk:fl-dor-${VINTAGE}` } });
  const start = Date.now();
  const result = await new FlDorIngester({ nalCsvPath: csvPath, vintage: VINTAGE, batchSize: 1000 })
    .ingest({ countyFips: county.fips });
  const elapsed = (Date.now() - start) / 1000;
  const after = await prisma.parcel.count({ where: { countyFips: county.fips, source: `bulk:fl-dor-${VINTAGE}` } });

  const rate = Math.round(result.recordsUpserted / elapsed);
  console.log(`     ${result.recordsFetched} fetched, ${result.recordsUpserted} upserted (${rate} rows/sec)`);
  console.log(`     ${target.name} Parcel rows: ${before} → ${after}`);

  return { ...target, fips: county.fips, ...result, elapsed, before, after };
}

async function main() {
  const overallStart = Date.now();

  const targets = await discoverFiles();
  const downloaded = await downloadAll(targets);

  console.log("\n=== Phase 3: ingest (serial — db-bound) ===");
  const ingestResults: Array<Awaited<ReturnType<typeof ingestOne>>> = [];
  for (const t of downloaded) {
    try {
      ingestResults.push(await ingestOne(t));
    } catch (err) {
      console.error(`  ✗ ${t.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const totalRows = ingestResults.reduce((s, r) => s + r.recordsUpserted, 0);
  const totalElapsedSec = (Date.now() - overallStart) / 1000;
  console.log(`\n=== Summary ===`);
  console.log(`  Total parcels upserted: ${totalRows.toLocaleString()}`);
  console.log(`  Total wall-clock: ${(totalElapsedSec / 60).toFixed(1)} min`);
  console.log(`  Aggregate rate: ${Math.round(totalRows / totalElapsedSec)} rows/sec`);

  console.log(`\n  Per-county:`);
  for (const r of ingestResults) {
    console.log(`    ${r.name.padEnd(12)} ${r.recordsUpserted.toLocaleString().padStart(8)} rows in ${r.elapsed.toFixed(1)}s`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Top-metros ingest failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
