/* eslint-disable no-console */
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { listDorFiles, downloadDorFile } from "@/lib/data-sources/bulk/fl-dor-portal";
import { FlDorSdfIngester } from "@/lib/data-sources/bulk/fl-dor-sdf";
import { flCountyByCoNo } from "@/lib/data-sources/bulk/fl-counties";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// SDF (Sales Data File) ingest for the top-5 FL metros — follows the NAL
// ingest. SDF files are tiny (~2-3 MB each) compared to NAL but they fill
// the entire sale-history layer back to 2009 (~Cotality PRIORxx sale fields
// plus the FL DOR sale qualification codes).
//
// Run: npx tsx -r dotenv/config scripts/fl-dor-sdf-top-metros.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

const TOP_METROS = [
  { coNo: 23, name: "Dade" },
  { coNo: 62, name: "Pinellas" },
  { coNo: 16, name: "Broward" },
  { coNo: 46, name: "Lee" },
  { coNo: 60, name: "Palm Beach" },
];
const VINTAGE = process.env.VINTAGE ?? "2025";
const RAW_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-2025");

async function main() {
  const overallStart = Date.now();
  console.log("=== Phase 1: discover SDF URLs ===");
  const allSdf = await listDorFiles({ categories: ["SDF"], vintage: VINTAGE });
  const targets = TOP_METROS.map((m) => {
    const f = allSdf.find((x) => x.coNo === m.coNo);
    if (!f) throw new Error(`No ${VINTAGE} SDF for CO_NO=${m.coNo} (${m.name})`);
    return { ...m, file: f };
  });
  for (const t of targets) {
    console.log(`  ${t.name.padEnd(12)} CO_NO=${String(t.coNo).padStart(2)}  ${(t.file.sizeBytes / 1024).toFixed(0)} KB`);
  }

  console.log("\n=== Phase 2: download (parallel) ===");
  const dest = path.join(RAW_DIR, "SDF", "2025F");
  const downloaded = await Promise.all(
    targets.map(async (t) => {
      const zipPath = await downloadDorFile(t.file, dest);
      console.log(`  ✓ ${t.name}: ${zipPath}`);
      return { ...t, zipPath };
    }),
  );

  console.log("\n=== Phase 3: ingest (serial) ===");
  const results: Array<{ name: string; coNo: number; fips: string; rows: number; elapsed: number }> = [];
  for (const t of downloaded) {
    const county = flCountyByCoNo(t.coNo)!;
    const extractDir = path.join(RAW_DIR, "extracted", `SDF_${VINTAGE}_co${t.coNo}`);
    fs.mkdirSync(extractDir, { recursive: true });
    const zip = new AdmZip(t.zipPath);
    let csvPath: string | null = null;
    for (const e of zip.getEntries()) {
      const n = e.entryName.toLowerCase();
      if (n.endsWith(".csv") || n.endsWith(".txt")) {
        csvPath = path.join(extractDir, path.basename(e.entryName));
        zip.extractEntryTo(e.entryName, extractDir, false, true);
        break;
      }
    }
    if (!csvPath) { console.error(`  ✗ ${t.name}: no CSV in zip`); continue; }

    const start = Date.now();
    const r = await new FlDorSdfIngester({ sdfCsvPath: csvPath, vintage: VINTAGE, batchSize: 1500 })
      .ingest({ countyFips: county.fips });
    const elapsed = (Date.now() - start) / 1000;
    console.log(`  ${t.name.padEnd(12)} ${r.recordsUpserted.toLocaleString().padStart(8)} sale rows in ${elapsed.toFixed(1)}s (${Math.round(r.recordsUpserted / elapsed)} rows/sec)`);
    results.push({ name: t.name, coNo: t.coNo, fips: county.fips, rows: r.recordsUpserted, elapsed });
  }

  const totalRows = results.reduce((s, r) => s + r.rows, 0);
  const totalSec = (Date.now() - overallStart) / 1000;
  console.log(`\n=== Summary ===`);
  console.log(`  Total sale events: ${totalRows.toLocaleString()}`);
  console.log(`  Total wall-clock: ${(totalSec / 60).toFixed(1)} min`);

  // Sanity check via raw SQL (Prisma client types lag schema until regeneration).
  const sample = await prisma.$queryRawUnsafe<Array<{ countyFips: string; apn: string; saleDate: Date | null; salePrice: number | null }>>(
    `SELECT "countyFips", "apn", "saleDate", "salePrice" FROM "ParcelSale" WHERE "source" = $1 ORDER BY "saleDate" DESC NULLS LAST LIMIT 1`,
    `bulk:fl-dor-sdf-${VINTAGE}`,
  );
  if (sample[0]) {
    const s = sample[0];
    console.log(`\n  Sample sale row: ${s.countyFips}/${s.apn} on ${s.saleDate?.toISOString().slice(0, 10)} for $${s.salePrice?.toLocaleString()}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("SDF top-metros ingest failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
