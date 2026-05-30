/* eslint-disable no-console */
import { scrapeDuvalRecordings } from "@/lib/scrapers/vendors/duval-clerk";
import { prisma } from "@/lib/prisma";

// Test 5 weekdays of Duval clerk recordings to:
//  1. Verify per-day extraction is stable
//  2. Hit a day with > 50 records to verify pagination
//  3. Build a representative slice of distress data

async function main() {
  const days = 5; // weekday loop, scanning back

  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 2); // start 2 days back (clerks have ~1-2d lag)
  while (dates.length < days) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  console.log("=== Duval clerk — last", days, "weekdays ===\n");

  const before = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: "12031" } }),
    prisma.lien.count({ where: { countyFips: "12031" } }),
    prisma.foreclosure.count({ where: { countyFips: "12031" } }),
  ]);
  console.log("Before — Mortgages:", before[0], "Liens:", before[1], "Foreclosures:", before[2]);

  const overall = Date.now();
  for (const d of dates) {
    const t0 = Date.now();
    try {
      const r = await scrapeDuvalRecordings({ date: d, useProxy: false });
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ${d.toISOString().slice(0, 10)} (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}) ${sec}s — found ${r.found}, +mortgages ${r.persistedMortgages} +liens ${r.persistedLiens} +foreclosures ${r.persistedForeclosures}`);
    } catch (e) {
      console.log(`  ${d.toISOString().slice(0, 10)} ✗ ${(e as Error).message.split("\n")[0]}`);
    }
  }

  const after = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: "12031" } }),
    prisma.lien.count({ where: { countyFips: "12031" } }),
    prisma.foreclosure.count({ where: { countyFips: "12031" } }),
  ]);
  console.log("\nAfter — Mortgages:", after[0], `(+${after[0]-before[0]})`, "Liens:", after[1], `(+${after[1]-before[1]})`, "Foreclosures:", after[2], `(+${after[2]-before[2]})`);
  console.log("Wall-clock:", ((Date.now() - overall) / 60_000).toFixed(1), "min");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
