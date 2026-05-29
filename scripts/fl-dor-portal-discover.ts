/* eslint-disable no-console */
import { listDorFiles } from "@/lib/data-sources/bulk/fl-dor-portal";

// ---------------------------------------------------------------------------
// Discovery: enumerate every NAL/SDF/NAP file currently published on the FL
// DOR Data Portal via the SharePoint REST API. Prints a summary by category
// + total bytes per category so we know what we're downloading before kicking
// off the bulk pull.
//
// Run: npx tsx -r dotenv/config scripts/fl-dor-portal-discover.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

async function main() {
  console.log("Querying FL DOR SharePoint REST API…\n");
  const start = Date.now();
  const files = await listDorFiles();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Found ${files.length} file(s) in ${elapsed}s\n`);
  if (files.length === 0) { process.exit(2); }

  const byCat: Record<string, { count: number; bytes: number; vintages: Set<string> }> = {};
  for (const f of files) {
    byCat[f.category] ??= { count: 0, bytes: 0, vintages: new Set() };
    byCat[f.category].count++;
    byCat[f.category].bytes += f.sizeBytes;
    byCat[f.category].vintages.add(f.vintageTag);
  }

  console.log("=== Summary by category ===");
  for (const [cat, s] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${s.count} files / ${(s.bytes / 1024 / 1024).toFixed(0)} MB / vintages: ${[...s.vintages].join(", ")}`);
  }

  console.log("\n=== Largest files (top 5 per category) ===");
  for (const cat of ["NAL", "SDF", "NAP"] as const) {
    const top = files.filter((f) => f.category === cat).sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 5);
    if (top.length === 0) continue;
    console.log(`\n  ${cat}:`);
    for (const f of top) console.log(`    ${(f.sizeBytes / 1024 / 1024).toFixed(1).padStart(6)} MB  CO_NO=${String(f.coNo).padStart(2)}  ${f.county}`);
  }

  console.log(`\n=== Smallest files (good smoke-test candidates) ===`);
  const smallest = [...files].sort((a, b) => a.sizeBytes - b.sizeBytes).slice(0, 3);
  for (const f of smallest) console.log(`  ${(f.sizeBytes / 1024).toFixed(0).padStart(6)} KB  ${f.category}  CO_NO=${f.coNo}  ${f.county}`);

  console.log(`\nNext: downloadVintage('2025', './data/raw/fl-dor-2025') → unzip → FlDorIngester.`);
}

main().catch((err) => {
  console.error("Discovery failed:", err);
  process.exit(1);
});
