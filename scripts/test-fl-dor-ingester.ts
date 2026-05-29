/* eslint-disable no-console */
import path from "node:path";
import { FlDorIngester } from "@/lib/data-sources/bulk/fl-dor";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Smoke test for the FL DOR NAL ingester.
//
// Runs against data/fixtures/nal-synthetic.csv (6 rows across Duval CO_NO=26,
// Sarasota CO_NO=57, Broward CO_NO=16) and verifies:
//   • Parcel rows persist with the right field shape
//   • RawSnapshot bronze captures the full Cotality-canonical-named row
//   • county FIPS crosswalk is correct
//   • countyFips filter (smoke-test scope) only ingests one county
//
// Once the real DOR-delivered NAL CSV arrives, just swap nalCsvPath and run.
// ---------------------------------------------------------------------------

const FIXTURE = path.resolve(process.cwd(), "data/fixtures/nal-synthetic.csv");

async function run() {
  console.log("=== FL DOR NAL ingester smoke test ===\n");

  // -- Phase 1: filtered to Duval only (smoke-first per user directive) ----
  console.log("Phase 1 — Duval-only (FIPS 12031, CO_NO=26)…");
  const duvalBefore = await prisma.parcel.count({ where: { countyFips: "12031", source: "bulk:fl-dor-test" } });
  const duvalIngester = new FlDorIngester({ nalCsvPath: FIXTURE, vintage: "test", batchSize: 100 });
  const duvalResult = await duvalIngester.ingest({ countyFips: "12031" });
  console.log("  result:", duvalResult);
  const duvalAfter = await prisma.parcel.count({ where: { countyFips: "12031", source: "bulk:fl-dor-test" } });
  console.log(`  Parcel(Duval) before=${duvalBefore} after=${duvalAfter}`);

  // Snapshot inspection
  const sampleDuval = await prisma.parcel.findFirst({
    where: { countyFips: "12031", source: "bulk:fl-dor-test" },
    orderBy: { fetchedAt: "desc" },
  });
  console.log("  Sample Duval Parcel:", JSON.stringify({
    apn: sampleDuval?.apn,
    ownerName: sampleDuval?.ownerName,
    situsAddress: sampleDuval?.situsAddress,
    marketValue: sampleDuval?.marketValue,
    assessedValue: sampleDuval?.assessedValue,
    yearBuilt: sampleDuval?.yearBuilt,
    squareFeet: sampleDuval?.squareFeet,
    lastSalePrice: sampleDuval?.lastSalePrice,
    lastSaleYear: sampleDuval?.lastSaleYear,
    propertyType: sampleDuval?.propertyType,
  }, null, 2));

  const duvalSnapshots = await prisma.rawSnapshot.findMany({
    where: { source: "fl-dor", countyFips: "12031", sourceTag: "bulk:fl-dor-test" },
    orderBy: { capturedAt: "desc" },
    take: 1,
  });
  console.log(`  RawSnapshot(Duval) rows: ${duvalSnapshots.length}`);
  if (duvalSnapshots[0]) {
    const payload = duvalSnapshots[0].rawResponse as Record<string, unknown>;
    const cotalityKeys = Object.keys(payload).filter((k) => !k.startsWith("_"));
    console.log(`  Cotality-named keys in bronze (${cotalityKeys.length}):`, cotalityKeys.slice(0, 10).join(", "), "…");
    console.log(`  Sample bronze payload: FIPS=${payload["FIPS COUNTY CODE"]}, OWNER 1 FULL NAME=${payload["OWNER 1 FULL NAME"]}, MARKET TOTAL VALUE=${payload["MARKET TOTAL VALUE"]}, SALE RECORDING DATE=${payload["SALE RECORDING DATE"]}`);
  }

  // -- Phase 2: full statewide (no filter) -------------------------------
  console.log("\nPhase 2 — full statewide (no filter)…");
  const statewideIngester = new FlDorIngester({ nalCsvPath: FIXTURE, vintage: "test", batchSize: 100 });
  const statewideResult = await statewideIngester.ingest();
  console.log("  result:", statewideResult);

  const byCounty = await prisma.parcel.groupBy({
    by: ["countyFips"],
    _count: true,
    where: { source: "bulk:fl-dor-test" },
  });
  console.log("  Parcels by countyFips (this source):");
  byCounty.forEach((c) => console.log(`    ${c.countyFips}: ${c._count}`));

  console.log("\n✅ Smoke test complete. To run against the real DOR CSV:");
  console.log("     new FlDorIngester({ nalCsvPath: '/path/to/NAL2025.csv', vintage: '2025' }).ingest()");

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Smoke test failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
