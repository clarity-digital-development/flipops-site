/* eslint-disable no-console */
import { scrapeDuvalRecordings } from "@/lib/scrapers/vendors/duval-clerk";
import { prisma } from "@/lib/prisma";

const DAYS_BACK = 7; // 5/22 = Friday, should have recordings

async function main() {
  const date = new Date();
  date.setDate(date.getDate() - DAYS_BACK);
  // Skip to last Friday if landing on weekend
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
  console.log(`=== Duval clerk Playwright smoke — ${date.toDateString()} ===\n`);

  const [mBefore, lBefore, fBefore] = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: "12031" } }),
    prisma.lien.count({ where: { countyFips: "12031" } }),
    prisma.foreclosure.count({ where: { countyFips: "12031" } }),
  ]);
  console.log(`Before — Mortgages: ${mBefore}, Liens: ${lBefore}, Foreclosures: ${fBefore}`);

  const t0 = Date.now();
  const result = await scrapeDuvalRecordings({ date, useProxy: false });
  console.log(`\nScrape took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`Date: ${result.date}`);
  console.log(`Recordings found: ${result.found}`);
  console.log(`  Mortgages persisted:   +${result.persistedMortgages}`);
  console.log(`  Liens persisted:       +${result.persistedLiens}`);
  console.log(`  Foreclosures persisted: +${result.persistedForeclosures}`);

  const [mAfter, lAfter, fAfter] = await Promise.all([
    prisma.mortgage.count({ where: { countyFips: "12031" } }),
    prisma.lien.count({ where: { countyFips: "12031" } }),
    prisma.foreclosure.count({ where: { countyFips: "12031" } }),
  ]);
  console.log(`\nAfter — Mortgages: ${mAfter} (+${mAfter - mBefore}), Liens: ${lAfter} (+${lAfter - lBefore}), Foreclosures: ${fAfter} (+${fAfter - fBefore})`);

  // Sample
  const mort = await prisma.mortgage.findFirst({ where: { countyFips: "12031" }, orderBy: { capturedAt: "desc" } });
  if (mort) console.log(`\nSample Mortgage: docNum=${mort.documentNumber} date=${mort.recordingDate.toISOString().slice(0, 10)} amount=$${mort.loanAmount?.toLocaleString() ?? "n/a"} type=${mort.mortgageType?.slice(0, 50)}`);
  const lien = await prisma.lien.findFirst({ where: { countyFips: "12031" }, orderBy: { capturedAt: "desc" } });
  if (lien) console.log(`Sample Lien: category=${lien.lienCategory} docNum=${lien.documentNumber} amount=$${lien.amount?.toLocaleString() ?? "n/a"} type=${lien.lienTypeCode?.slice(0, 50)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
