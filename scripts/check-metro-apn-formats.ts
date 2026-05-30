/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

const METROS = [
  { name: "Duval",         fips: "12031" }, // already done — reference
  { name: "Hillsborough",  fips: "12057" },
  { name: "Orange",        fips: "12095" },
  { name: "Broward",       fips: "12011" },
  { name: "Miami-Dade",    fips: "12086" },
  { name: "Palm Beach",    fips: "12099" },
];

async function main() {
  for (const m of METROS) {
    console.log(`\n=== ${m.name} (FIPS ${m.fips}) ===`);
    const samples = await prisma.parcel.findMany({
      where: { countyFips: m.fips },
      take: 5,
      orderBy: { fetchedAt: "desc" },
    });
    console.log(`Total parcels: ${(await prisma.parcel.count({ where: { countyFips: m.fips } })).toLocaleString()}`);
    console.log("Sample APNs:");
    samples.forEach((p) => console.log(`  "${p.apn}" len=${p.apn.length}  ${p.ownerName?.slice(0, 30)}`));
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
