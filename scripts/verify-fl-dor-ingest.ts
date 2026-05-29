/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Data quality verification for a completed FL DOR ingest. Run after
// fl-dor-ingest-top-metros.ts (or the full-statewide runner) to confirm:
//
//   1. Coverage — which counties have data; how many parcels per county
//   2. Completeness — what % of rows have key fields (owner / value / sqft)
//   3. Sanity — value distributions look reasonable (no obvious garbage)
//   4. Cross-reference — counties FIPS match the FL DOR crosswalk
//   5. Bronze layer — RawSnapshot file metadata captured
//
// Run: npx tsx -r dotenv/config scripts/verify-fl-dor-ingest.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== FL DOR Ingest — data quality report ===\n");

  // 1. Coverage by county
  const byCounty = await prisma.$queryRaw<Array<{ countyFips: string; n: bigint }>>`
    SELECT "countyFips", count(*)::bigint as n FROM "Parcel"
    WHERE "source" LIKE 'bulk:fl-dor%'
    GROUP BY "countyFips" ORDER BY n DESC`;

  console.log("[1] Coverage by county:");
  let total = 0n;
  for (const r of byCounty) {
    const fipsName = await getCountyName(r.countyFips);
    console.log(`  ${r.countyFips}  ${fipsName.padEnd(20)} ${r.n.toLocaleString().padStart(10)}`);
    total += r.n;
  }
  console.log(`  TOTAL                          ${total.toLocaleString().padStart(10)}\n`);

  // 2. Completeness — per-field fill rate across the whole population
  const completeness = await prisma.$queryRaw<Array<{ field: string; have: bigint; pct: string }>>`
    SELECT 'ownerName' AS field, count("ownerName") AS have,
           ROUND(100.0 * count("ownerName") / count(*), 1)::text AS pct FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'situsAddress', count("situsAddress"), ROUND(100.0 * count("situsAddress") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'marketValue', count("marketValue"), ROUND(100.0 * count("marketValue") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'assessedValue', count("assessedValue"), ROUND(100.0 * count("assessedValue") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'yearBuilt', count("yearBuilt"), ROUND(100.0 * count("yearBuilt") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'squareFeet', count("squareFeet"), ROUND(100.0 * count("squareFeet") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'lotSize', count("lotSize"), ROUND(100.0 * count("lotSize") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'lastSalePrice', count("lastSalePrice"), ROUND(100.0 * count("lastSalePrice") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL
    SELECT 'propertyType (DOR_UC)', count("propertyType"), ROUND(100.0 * count("propertyType") / count(*), 1)::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'`;

  console.log("[2] Field completeness:");
  for (const c of completeness) {
    console.log(`  ${c.field.padEnd(24)} ${c.have.toLocaleString().padStart(10)}  ${c.pct.padStart(5)}%`);
  }

  // 3. Value distribution sanity
  const valStats = await prisma.$queryRaw<Array<{ stat: string; v: string }>>`
    SELECT 'min market' AS stat, MIN("marketValue")::text AS v FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "marketValue" > 0
    UNION ALL SELECT 'p25 market', percentile_cont(0.25) WITHIN GROUP (ORDER BY "marketValue")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "marketValue" > 0
    UNION ALL SELECT 'median market', percentile_cont(0.5) WITHIN GROUP (ORDER BY "marketValue")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "marketValue" > 0
    UNION ALL SELECT 'p75 market', percentile_cont(0.75) WITHIN GROUP (ORDER BY "marketValue")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "marketValue" > 0
    UNION ALL SELECT 'max market', MAX("marketValue")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'
    UNION ALL SELECT 'min year', MIN("yearBuilt")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "yearBuilt" > 1700
    UNION ALL SELECT 'median year', percentile_cont(0.5) WITHIN GROUP (ORDER BY "yearBuilt")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%' AND "yearBuilt" > 1700
    UNION ALL SELECT 'max year', MAX("yearBuilt")::text FROM "Parcel" WHERE "source" LIKE 'bulk:fl-dor%'`;
  console.log("\n[3] Value distribution sanity:");
  for (const r of valStats) console.log(`  ${r.stat.padEnd(16)} ${r.v}`);

  // 4. BulkIngestJob audit
  const jobs = await prisma.bulkIngestJob.findMany({
    where: { sourceTag: { startsWith: "bulk:fl-dor" } },
    orderBy: { startedAt: "desc" },
    take: 15,
  });
  console.log("\n[4] Recent BulkIngestJob audit:");
  for (const j of jobs) {
    const elapsed = j.durationMs ? (j.durationMs / 1000).toFixed(0) + "s" : "running";
    const rate = j.durationMs && j.recordsUpserted ? Math.round(j.recordsUpserted / (j.durationMs / 1000)) + "/s" : "";
    console.log(`  ${j.startedAt.toISOString().slice(0, 19)}  ${j.sourceTag.padEnd(20)} scope=${(j.scope ?? "").padEnd(8)} ${j.status.padEnd(10)} ${j.recordsUpserted.toLocaleString().padStart(8)} rows in ${elapsed.padStart(7)} ${rate}`);
  }

  // 5. Bronze (RawSnapshot)
  const bronze = await prisma.rawSnapshot.findMany({
    where: { source: { in: ["fl-dor", "fl-dor-sdf", "fl-dor-portal"] } },
    orderBy: { capturedAt: "desc" },
    take: 10,
  });
  console.log("\n[5] Bronze layer captures (RawSnapshot):");
  for (const r of bronze) {
    console.log(`  ${r.capturedAt.toISOString().slice(0, 19)}  ${r.source.padEnd(15)} ${r.sourceTag.padEnd(28)} fips=${r.countyFips ?? "-"}`);
  }

  await prisma.$disconnect();
}

async function getCountyName(fips: string): Promise<string> {
  const { FL_COUNTIES } = await import("@/lib/data-sources/bulk/fl-counties");
  return FL_COUNTIES.find((c) => c.fips === fips)?.name ?? "?";
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
