/**
 * Smoke-test the depth-layer enrichment orchestrator against the live DB +
 * live sources. Enriches a known Duval parcel.
 * Run: DATABASE_URL=... FIRECRAWL_API_KEY=... npx tsx scripts/test-enrichment.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { enrichProperty } from "../lib/data-sources/enrichment";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Enriching Duval parcel 0224370000 (appraiser + clerk + tax)...\n");
  const summary = await enrichProperty({
    countyFips: "12031",
    state: "FL",
    apn: "0224370000",
  });
  console.log("Enrichment summary:");
  console.log(JSON.stringify(summary, null, 2));

  const parcel = await prisma.parcel.findUnique({
    where: { countyFips_apn: { countyFips: "12031", apn: "0224370000" } },
  });
  console.log("\nPersisted Parcel:");
  console.log(JSON.stringify(
    parcel && {
      apn: parcel.apn,
      owner: parcel.ownerName,
      situs: parcel.situsAddress,
      marketValue: parcel.marketValue,
      yearBuilt: parcel.yearBuilt,
      source: parcel.source,
    },
    null, 2,
  ));

  await prisma.$disconnect();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
