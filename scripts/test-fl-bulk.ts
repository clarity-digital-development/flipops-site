/**
 * Smoke-test the FloridaGIO bulk ingester against the live FeatureServer + DB.
 * Ingests Duval County (FIPS 12031) capped at 2000 records.
 * Run: DATABASE_URL=... npx tsx scripts/test-fl-bulk.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { buildFloridaGioIngester } from "../lib/data-sources/bulk/fl-fgio";
import { prisma } from "../lib/prisma";

async function main() {
  const ingester = buildFloridaGioIngester("2025");
  console.log("Ingesting Duval (FIPS 12031), capped at 2000 records...");
  const result = await ingester.ingest({ countyFips: "12031", maxRecords: 2000 });
  console.log("Result:", JSON.stringify(result, null, 2));

  const total = await prisma.parcel.count({ where: { countyFips: "12031" } });
  console.log("\nParcel rows for Duval in DB:", total);

  const sample = await prisma.parcel.findFirst({
    where: { countyFips: "12031", ownerName: { not: null }, marketValue: { gt: 0 } },
  });
  console.log("\nSample parcel with data:");
  console.log(JSON.stringify(
    sample && {
      apn: sample.apn,
      owner: sample.ownerName,
      situs: `${sample.situsAddress}, ${sample.situsCity} ${sample.situsZip}`,
      marketValue: sample.marketValue,
      assessedValue: sample.assessedValue,
      yearBuilt: sample.yearBuilt,
      sqft: sample.squareFeet,
      latlng: [sample.latitude, sample.longitude],
      source: sample.source,
    },
    null, 2,
  ));

  const jobs = await prisma.bulkIngestJob.count({ where: { sourceTag: ingester.sourceTag } });
  console.log("\nBulkIngestJob audit rows:", jobs);

  await prisma.$disconnect();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
