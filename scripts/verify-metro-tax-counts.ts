/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

const METROS = [
  { name: "Duval",         fips: "12031" },
  { name: "Hillsborough",  fips: "12057" },
  { name: "Orange",        fips: "12095" },
  { name: "Broward",       fips: "12011" },
  { name: "Miami-Dade",    fips: "12086" },
  { name: "Palm Beach",    fips: "12099" },
];

async function main() {
  console.log("=== CTO verification: tax-delinquent Lien counts + Parcel JOIN rate ===\n");
  let totalLiens = 0, totalJoined = 0;
  for (const m of METROS) {
    const lienCount = await prisma.lien.count({
      where: { countyFips: m.fips, lienCategory: "tax" },
    });
    const joined = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint FROM "Lien" l
      INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
      WHERE l."countyFips" = ${m.fips} AND l."lienCategory" = 'tax'`;
    const joinedCount = Number(joined[0].count);
    const rate = lienCount === 0 ? 0 : (100 * joinedCount / lienCount);
    totalLiens += lienCount;
    totalJoined += joinedCount;
    console.log(`${m.name.padEnd(14)} liens=${lienCount.toString().padStart(7)} join=${joinedCount.toString().padStart(7)} rate=${rate.toFixed(1)}%`);
  }
  console.log(`\n${"TOTAL".padEnd(14)} liens=${totalLiens.toString().padStart(7)} join=${totalJoined.toString().padStart(7)} rate=${(100 * totalJoined / totalLiens).toFixed(1)}%`);

  // Total $ exposure cross-referenced
  const totalDollars = await prisma.$queryRaw<{ sum: number | null }[]>`
    SELECT COALESCE(SUM(l."amount"), 0)::float AS sum FROM "Lien" l
    INNER JOIN "Parcel" p ON p."countyFips" = l."countyFips" AND p."apn" = l."apn"
    WHERE l."lienCategory" = 'tax' AND l."countyFips" IN ('12031','12057','12095','12011','12086','12099')`;
  console.log(`\nTotal $ exposure (cross-ref): $${totalDollars[0].sum?.toLocaleString()}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
