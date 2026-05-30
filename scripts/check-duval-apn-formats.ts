/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  // Sample Duval parcels
  const samples = await prisma.parcel.findMany({
    where: { countyFips: "12031" },
    take: 5,
    orderBy: { fetchedAt: "desc" },
  });
  console.log("Duval Parcel sample APNs:");
  samples.forEach((p) => console.log(`  apn="${p.apn}" len=${p.apn.length} owner=${p.ownerName?.slice(0, 30)}`));

  // Sample Duval tax-delinquent liens
  const liens = await prisma.lien.findMany({
    where: { countyFips: "12031", lienCategory: "tax" },
    take: 5,
    orderBy: { capturedAt: "desc" },
  });
  console.log("\nDuval tax Lien sample APNs (from RE#):");
  liens.forEach((l) => console.log(`  apn="${l.apn}" len=${l.apn?.length} owner=${l.defendantName?.slice(0, 30)}`));

  // Try one specific match
  if (liens[0]?.apn) {
    const tryApn = liens[0].apn;
    console.log(`\nLooking for Parcel with apn="${tryApn}"...`);
    const found = await prisma.parcel.findUnique({
      where: { countyFips_apn: { countyFips: "12031", apn: tryApn } },
    });
    console.log("Found:", found ? `yes — ${found.ownerName}` : "no");

    // Try with various transforms
    const variants = [
      tryApn.replace("-", ""),       // 0022010100
      tryApn.replace("-", "").padEnd(18, "0"), // 002201010000000000
      tryApn.replace("-", " "),      // 002201 0100
    ];
    console.log("\nTrying variants:");
    for (const v of variants) {
      const parcels = await prisma.parcel.findMany({
        where: { countyFips: "12031", apn: { startsWith: v.slice(0, 6) } },
        take: 2,
      });
      console.log(`  Parcels starting with "${v.slice(0, 6)}": ${parcels.length}`);
      parcels.forEach((p) => console.log(`    apn="${p.apn}" owner=${p.ownerName?.slice(0, 30)}`));
    }
  }

  // Also check what total Duval parcel count is
  const totalDuval = await prisma.parcel.count({ where: { countyFips: "12031" } });
  console.log(`\nTotal Duval parcels in DB: ${totalDuval.toLocaleString()}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
