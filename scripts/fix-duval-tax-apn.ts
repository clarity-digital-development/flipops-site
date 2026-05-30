/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// One-shot: transform existing Duval tax Lien APNs from RE# format
// (181780-1056) to the Parcel APN format (1817801056R) so JOINs work.

async function main() {
  // Verify the transform works against actual parcels first
  const sampleLien = await prisma.lien.findFirst({
    where: { countyFips: "12031", lienCategory: "tax", apn: { contains: "-" } },
  });
  if (!sampleLien?.apn) { console.log("No lien with dash"); return; }
  const transformed = sampleLien.apn.replace("-", "") + "R";
  console.log(`Transform check: ${sampleLien.apn} → ${transformed}`);

  const parcelExists = await prisma.parcel.findUnique({
    where: { countyFips_apn: { countyFips: "12031", apn: transformed } },
  });
  if (parcelExists) {
    console.log(`  ✓ matches Parcel: ${parcelExists.ownerName} @ ${parcelExists.situsAddress}`);
  } else {
    console.log(`  ✗ no Parcel match — transform may be wrong; check sample`);
    // Try a couple alternative formats
    const alts = [
      sampleLien.apn.replace("-", ""),
      "1" + sampleLien.apn.replace("-", "") + "R",
      sampleLien.apn.replace(/-/g, ""),
    ];
    for (const a of alts) {
      const p = await prisma.parcel.findUnique({ where: { countyFips_apn: { countyFips: "12031", apn: a } } });
      console.log(`  alt "${a}": ${p ? "✓ found " + p.ownerName : "no"}`);
    }
    return;
  }

  // Apply the transform to every Duval tax Lien
  // Use raw SQL for speed (26k+ rows).
  // Pattern: replace - with empty, append R. Skip if apn already has R suffix or is null.
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Lien"
    SET "apn" = REPLACE("apn", '-', '') || 'R'
    WHERE "countyFips" = '12031'
      AND "lienCategory" = 'tax'
      AND "apn" IS NOT NULL
      AND "apn" LIKE '%-%'
      AND "apn" NOT LIKE '%R'
  `);
  console.log(`\nUpdated ${result} Lien rows (apn → Parcel format)`);

  // Verify JOIN
  const joined = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12031' AND l."lienCategory" = 'tax'`;
  console.log(`Cross-ref leads now: ${joined[0].count.toLocaleString()}`);

  // Sample top JOIN'd leads — delinquent properties we have full Parcel data on
  const topLeads = await prisma.$queryRaw<Array<{
    apn: string; amount: number; defendant: string; owner: string; addr: string; city: string; market: number;
  }>>`
    SELECT l."apn", l."amount", l."defendantName" AS defendant,
           p."ownerName" AS owner, p."situsAddress" AS addr, p."situsCity" AS city, p."marketValue" AS market
    FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."countyFips" = '12031' AND l."lienCategory" = 'tax'
    ORDER BY l."amount" DESC LIMIT 5`;
  console.log(`\nTop-5 delinquent leads (cross-referenced):`);
  topLeads.forEach((t) => {
    console.log(`  apn=${t.apn} owed=$${t.amount.toLocaleString()} market=$${t.market?.toLocaleString()}`);
    console.log(`    owner: ${t.owner}`);
    console.log(`    address: ${t.addr}, ${t.city}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
