/* eslint-disable no-console */
import path from "node:path";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { listDorFiles, downloadDorFile } from "@/lib/data-sources/bulk/fl-dor-portal";
import { FlDorIngester } from "@/lib/data-sources/bulk/fl-dor";
import { flCountyByCoNo } from "@/lib/data-sources/bulk/fl-counties";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// END-TO-END smoke for one FL county against the REAL DOR file (not the
// synthetic fixture). Pick a CO_NO, this script:
//   1. Discovers the NAL .zip URL via SharePoint REST API
//   2. Downloads the .zip
//   3. Extracts the CSV
//   4. Runs FlDorIngester to persist Parcel + RawSnapshot
//   5. Reports stats
//
// Defaults to Baker (CO_NO=12) — the smallest FL county NAL (~1 MB) so it
// completes in seconds. Override with CO_NO env var.
//
// Run: npx tsx -r dotenv/config scripts/fl-dor-ingest-one-county.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

const TARGET_CO_NO = Number.parseInt(process.env.CO_NO ?? "12", 10);
const VINTAGE = process.env.VINTAGE ?? "2025";
const RAW_DIR = path.resolve(process.cwd(), "data/raw/fl-dor-2025");

async function main() {
  const county = flCountyByCoNo(TARGET_CO_NO);
  if (!county) throw new Error(`Unknown CO_NO=${TARGET_CO_NO}`);
  console.log(`=== End-to-end smoke: ${county.name} County (CO_NO=${TARGET_CO_NO}, FIPS=${county.fips}) ===\n`);

  // Step 1: discover the NAL file URL
  console.log("Step 1 — discovering NAL file via SharePoint REST API…");
  const allNal = await listDorFiles({ categories: ["NAL"], vintage: VINTAGE });
  const nalFile = allNal.find((f) => f.coNo === TARGET_CO_NO);
  if (!nalFile) throw new Error(`No ${VINTAGE} NAL file for CO_NO=${TARGET_CO_NO}`);
  console.log(`  ${nalFile.filename} (${(nalFile.sizeBytes / 1024).toFixed(0)} KB)`);

  // Step 2: download
  console.log(`\nStep 2 — downloading to ${RAW_DIR}/NAL/${nalFile.vintageTag}/…`);
  const zipPath = await downloadDorFile(nalFile, path.join(RAW_DIR, "NAL", nalFile.vintageTag));
  console.log(`  ✓ ${zipPath}`);

  // Step 3: extract the CSV
  console.log("\nStep 3 — extracting CSV…");
  const extractDir = path.join(RAW_DIR, "extracted", `NAL_${VINTAGE}_co${TARGET_CO_NO}`);
  fs.mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let csvPath: string | null = null;
  for (const e of entries) {
    const name = e.entryName.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const dest = path.join(extractDir, path.basename(e.entryName));
      zip.extractEntryTo(e.entryName, extractDir, false, true);
      csvPath = dest;
      console.log(`  ✓ ${dest}`);
    }
  }
  if (!csvPath) throw new Error(`No CSV/TXT entry found in ${zipPath}`);

  // Step 4: peek at the header to confirm column shape matches our mapper
  console.log("\nStep 4 — verifying CSV header…");
  const headerLine = fs.readFileSync(csvPath, { encoding: "utf8" }).split(/\r?\n/, 1)[0];
  const cols = headerLine.split(",").map((c) => c.trim());
  console.log(`  header has ${cols.length} columns`);
  const expected = ["CO_NO", "PARCEL_ID", "OWN_NAME", "PHY_ADDR1", "JV", "AV_SD", "DOR_UC", "ACT_YR_BLT"];
  const missing = expected.filter((c) => !cols.includes(c));
  if (missing.length) {
    console.log(`  ⚠️ missing expected columns: ${missing.join(", ")}`);
    console.log(`  first 20 columns: ${cols.slice(0, 20).join(", ")}`);
  } else {
    console.log(`  ✓ all expected NAL columns present`);
  }

  // Step 5: ingest with FlDorIngester
  console.log("\nStep 5 — ingesting via FlDorIngester…");
  const before = await prisma.parcel.count({ where: { countyFips: county.fips, source: `bulk:fl-dor-${VINTAGE}` } });
  const ingester = new FlDorIngester({ nalCsvPath: csvPath, vintage: VINTAGE, batchSize: 500 });
  const result = await ingester.ingest({ countyFips: county.fips });
  const after = await prisma.parcel.count({ where: { countyFips: county.fips, source: `bulk:fl-dor-${VINTAGE}` } });
  console.log(`  ✓ result: ${result.recordsFetched} fetched, ${result.recordsUpserted} upserted in ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`  Parcel(${county.name}) before=${before} after=${after}`);

  // Step 6: spot-check a Parcel row + its RawSnapshot
  const sample = await prisma.parcel.findFirst({
    where: { countyFips: county.fips, source: `bulk:fl-dor-${VINTAGE}` },
    orderBy: { fetchedAt: "desc" },
  });
  console.log(`\nSample Parcel row:`);
  console.log(`  apn=${sample?.apn}`);
  console.log(`  ownerName=${sample?.ownerName}`);
  console.log(`  situsAddress=${sample?.situsAddress}, ${sample?.situsCity} ${sample?.situsZip}`);
  console.log(`  marketValue=$${sample?.marketValue?.toLocaleString()}, assessedValue=$${sample?.assessedValue?.toLocaleString()}`);
  console.log(`  yearBuilt=${sample?.yearBuilt}, squareFeet=${sample?.squareFeet}, lotSize=${sample?.lotSize}`);
  console.log(`  lastSale=$${sample?.lastSalePrice?.toLocaleString()} in ${sample?.lastSaleYear}`);

  const snap = await prisma.rawSnapshot.findFirst({
    where: { source: "fl-dor", countyFips: county.fips, sourceTag: `bulk:fl-dor-${VINTAGE}` },
    orderBy: { capturedAt: "desc" },
  });
  if (snap) {
    const cotality = Object.keys(snap.rawResponse as Record<string, unknown>).filter((k) => !k.startsWith("_"));
    console.log(`\nRawSnapshot bronze: ${cotality.length} Cotality-named fields captured`);
  }

  console.log(`\n✅ Smoke complete. To scale to all 67 counties:`);
  console.log(`     downloadVintage('${VINTAGE}', '${RAW_DIR}', { concurrency: 4 })`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n❌ Smoke failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
