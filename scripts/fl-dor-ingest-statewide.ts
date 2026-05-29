/* eslint-disable no-console */
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { listDorFiles, downloadDorFile } from "@/lib/data-sources/bulk/fl-dor-portal";
import { FlDorIngester } from "@/lib/data-sources/bulk/fl-dor";
import { FlDorSdfIngester } from "@/lib/data-sources/bulk/fl-dor-sdf";
import { FL_COUNTIES, flCountyByCoNo } from "@/lib/data-sources/bulk/fl-counties";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// FL DOR statewide unified runner — NAL + SDF for all 67 FL counties (or
// any subset). The production-grade runner: resume support, per-county
// failure isolation, progress checkpointing, parallel downloads, serial
// ingest (db-bound).
//
// Environment / flags:
//   VINTAGE=2025               which annual roll to ingest (default 2025)
//   ONLY=12031,12086           comma-separated FIPS list to limit scope
//   SKIP_NAL=true              skip NAL (e.g. re-running SDF only)
//   SKIP_SDF=true              skip SDF
//   FORCE=true                 don't skip counties with succeeded jobs
//
// Run: npx tsx -r dotenv/config scripts/fl-dor-ingest-statewide.ts dotenv_config_path=.env.local
//
// Resume: each county-track is one BulkIngestJob row. A "succeeded" job
// means we already ingested that county-track for that vintage; the runner
// skips it unless FORCE=true. Re-runs are also idempotent at the SQL level
// (upsert on Parcel.unique(countyFips,apn) + insert-or-do-nothing on
// ParcelSale.unique(countyFips,apn,saleDate,source)) — re-running is safe,
// just wasteful.
// ---------------------------------------------------------------------------

const VINTAGE = process.env.VINTAGE ?? "2025";
const RAW_DIR = path.resolve(process.cwd(), `data/raw/fl-dor-${VINTAGE}`);
const ONLY_FIPS = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SKIP_NAL = process.env.SKIP_NAL === "true";
const SKIP_SDF = process.env.SKIP_SDF === "true";
const FORCE = process.env.FORCE === "true";
const DOWNLOAD_CONCURRENCY = Number.parseInt(process.env.DOWNLOAD_CONCURRENCY ?? "6", 10);

interface CountyJobState {
  coNo: number;
  fips: string;
  name: string;
  nalSucceeded: boolean;
  sdfSucceeded: boolean;
  nalZipPath?: string;
  sdfZipPath?: string;
}

async function main() {
  const overallStart = Date.now();
  const sourceTagNal = `bulk:fl-dor-${VINTAGE}`;
  const sourceTagSdf = `bulk:fl-dor-sdf-${VINTAGE}`;

  // --- Plan: which counties / which tracks need work? -----------------
  console.log("=== FL DOR statewide ingest ===");
  console.log(`Vintage: ${VINTAGE}`);

  const targetCounties = ONLY_FIPS.length > 0
    ? FL_COUNTIES.filter((c) => ONLY_FIPS.includes(c.fips))
    : FL_COUNTIES;

  console.log(`Counties in scope: ${targetCounties.length} of ${FL_COUNTIES.length}`);
  if (SKIP_NAL) console.log("⚠ SKIP_NAL set — NAL won't be ingested");
  if (SKIP_SDF) console.log("⚠ SKIP_SDF set — SDF won't be ingested");
  if (FORCE) console.log("⚠ FORCE set — succeeded counties will re-ingest");

  // Read prior successful jobs for resume
  const priorJobs = await prisma.bulkIngestJob.findMany({
    where: { sourceTag: { in: [sourceTagNal, sourceTagSdf] }, status: "succeeded" },
    select: { sourceTag: true, scope: true },
  });
  const succeededNalFips = new Set(priorJobs.filter((j) => j.sourceTag === sourceTagNal).map((j) => j.scope));
  const succeededSdfFips = new Set(priorJobs.filter((j) => j.sourceTag === sourceTagSdf).map((j) => j.scope));

  const plan: CountyJobState[] = targetCounties.map((c) => ({
    coNo: c.coNo,
    fips: c.fips,
    name: c.name,
    nalSucceeded: FORCE ? false : succeededNalFips.has(c.fips),
    sdfSucceeded: FORCE ? false : succeededSdfFips.has(c.fips),
  }));

  const nalTodo = plan.filter((p) => !p.nalSucceeded && !SKIP_NAL);
  const sdfTodo = plan.filter((p) => !p.sdfSucceeded && !SKIP_SDF);
  console.log(`\nNAL: ${nalTodo.length} counties to process (${plan.length - nalTodo.length} already succeeded)`);
  console.log(`SDF: ${sdfTodo.length} counties to process (${plan.length - sdfTodo.length} already succeeded)`);

  if (nalTodo.length === 0 && sdfTodo.length === 0) {
    console.log("\n✓ Nothing to do. Use FORCE=true to re-ingest.");
    return;
  }

  // --- Discover all NAL + SDF URLs once -------------------------------
  console.log("\n=== Discover ===");
  const cats: ("NAL" | "SDF")[] = [];
  if (!SKIP_NAL) cats.push("NAL");
  if (!SKIP_SDF) cats.push("SDF");
  const allFiles = await listDorFiles({ categories: cats, vintage: VINTAGE });

  // --- Parallel downloads (network-bound) -----------------------------
  console.log(`\n=== Download (concurrency=${DOWNLOAD_CONCURRENCY}) ===`);
  const dlStart = Date.now();
  const dlQueue: Array<{ url: string; dest: string; coNo: number; track: "NAL" | "SDF"; sizeBytes: number; assignTo: CountyJobState }> = [];

  for (const state of plan) {
    if (!state.nalSucceeded && !SKIP_NAL) {
      const f = allFiles.find((x) => x.category === "NAL" && x.coNo === state.coNo);
      if (f) dlQueue.push({ url: f.downloadUrl, dest: path.join(RAW_DIR, "NAL", f.vintageTag, f.filename), coNo: state.coNo, track: "NAL", sizeBytes: f.sizeBytes, assignTo: state });
    }
    if (!state.sdfSucceeded && !SKIP_SDF) {
      const f = allFiles.find((x) => x.category === "SDF" && x.coNo === state.coNo);
      if (f) dlQueue.push({ url: f.downloadUrl, dest: path.join(RAW_DIR, "SDF", f.vintageTag, f.filename), coNo: state.coNo, track: "SDF", sizeBytes: f.sizeBytes, assignTo: state });
    }
  }

  const dlTotal = dlQueue.length;
  let dlDone = 0;
  async function worker() {
    while (dlQueue.length > 0) {
      const job = dlQueue.shift();
      if (!job) return;
      try {
        const fileObj = allFiles.find((x) => x.category === job.track && x.coNo === job.coNo)!;
        const downloaded = await downloadDorFile(fileObj, path.dirname(job.dest));
        if (job.track === "NAL") job.assignTo.nalZipPath = downloaded;
        else job.assignTo.sdfZipPath = downloaded;
      } catch (err) {
        console.warn(`  ✗ download ${job.track} CO_NO=${job.coNo}:`, err instanceof Error ? err.message : err);
      }
      dlDone++;
      if (dlDone % 10 === 0 || dlDone === dlTotal) {
        console.log(`  ${dlDone}/${dlTotal} downloads complete`);
      }
    }
  }
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
  console.log(`  download phase: ${((Date.now() - dlStart) / 1000).toFixed(0)}s`);

  // --- Serial ingest (db-bound) ---------------------------------------
  console.log(`\n=== Ingest (serial — db-bound) ===`);
  const results: Array<{ fips: string; name: string; track: "NAL" | "SDF"; ok: boolean; rows: number; sec: number; err?: string }> = [];

  for (const state of plan) {
    if (state.nalZipPath && !SKIP_NAL && !state.nalSucceeded) {
      const r = await ingestOne(state, "NAL", state.nalZipPath, sourceTagNal);
      results.push({ fips: state.fips, name: state.name, track: "NAL", ...r });
    }
    if (state.sdfZipPath && !SKIP_SDF && !state.sdfSucceeded) {
      const r = await ingestOne(state, "SDF", state.sdfZipPath, sourceTagSdf);
      results.push({ fips: state.fips, name: state.name, track: "SDF", ...r });
    }
  }

  // --- Summary --------------------------------------------------------
  const okRows = results.filter((r) => r.ok).reduce((s, r) => s + r.rows, 0);
  const failedCounties = results.filter((r) => !r.ok);
  console.log("\n=== Summary ===");
  console.log(`  Total rows persisted: ${okRows.toLocaleString()}`);
  console.log(`  Total wall-clock: ${((Date.now() - overallStart) / 60000).toFixed(1)} min`);
  console.log(`  Succeeded county-tracks: ${results.length - failedCounties.length}/${results.length}`);
  if (failedCounties.length > 0) {
    console.log(`  Failures:`);
    for (const f of failedCounties) console.log(`    ${f.name} (${f.track}) — ${f.err}`);
  }

  await prisma.$disconnect();
}

async function ingestOne(
  state: CountyJobState,
  track: "NAL" | "SDF",
  zipPath: string,
  expectedSourceTag: string,
): Promise<{ ok: boolean; rows: number; sec: number; err?: string }> {
  const extractDir = path.join(RAW_DIR, "extracted", `${track}_${VINTAGE}_co${state.coNo}`);
  let csvPath: string | null = null;
  try {
    fs.mkdirSync(extractDir, { recursive: true });
    const zip = new AdmZip(zipPath);
    for (const e of zip.getEntries()) {
      const n = e.entryName.toLowerCase();
      if (n.endsWith(".csv") || n.endsWith(".txt")) {
        csvPath = path.join(extractDir, path.basename(e.entryName));
        zip.extractEntryTo(e.entryName, extractDir, false, true);
        break;
      }
    }
  } catch (err) {
    return { ok: false, rows: 0, sec: 0, err: `extract failed: ${(err as Error).message}` };
  }
  if (!csvPath) return { ok: false, rows: 0, sec: 0, err: "no CSV in zip" };

  const start = Date.now();
  try {
    let rows = 0;
    if (track === "NAL") {
      const r = await new FlDorIngester({ nalCsvPath: csvPath, vintage: VINTAGE, batchSize: 1000 })
        .ingest({ countyFips: state.fips });
      rows = r.recordsUpserted;
    } else {
      const r = await new FlDorSdfIngester({ sdfCsvPath: csvPath, vintage: VINTAGE, batchSize: 1500 })
        .ingest({ countyFips: state.fips });
      rows = r.recordsUpserted;
    }
    const sec = (Date.now() - start) / 1000;
    const rate = Math.round(rows / sec);
    console.log(`  ✓ ${state.name.padEnd(18)} ${track}  ${rows.toLocaleString().padStart(9)} rows in ${sec.toFixed(0).padStart(4)}s  (${rate}/s)`);
    void expectedSourceTag; // referenced for clarity
    return { ok: true, rows, sec };
  } catch (err) {
    const sec = (Date.now() - start) / 1000;
    const msg = (err as Error).message?.split("\n")[0] ?? String(err);
    console.log(`  ✗ ${state.name.padEnd(18)} ${track}  failed after ${sec.toFixed(0)}s: ${msg}`);
    return { ok: false, rows: 0, sec, err: msg };
  }
}

// Verify flCountyByCoNo crosswalk is imported (otherwise unused-import warning)
void flCountyByCoNo;

main().catch((err) => {
  console.error("Statewide ingest crashed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
