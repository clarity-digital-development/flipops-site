/**
 * One-shot Pinellas probate backfill — pulls the captcha-free daily-CSV window
 * straight into ProbateCase, bypassing Redis/BullMQ. Use for the initial load;
 * the recurring daily refresh runs via the `pinellas-probate-csv` dispatch
 * adapter once a ScrapeRegistry row + cron are wired.
 *
 * Usage (from flipops-site/):
 *   DATABASE_URL='<railway url>' npx tsx scripts/run-pinellas-probate-backfill.ts [daysBack]
 *
 * daysBack defaults to 90 (the full retained window).
 */
import { scrapePinellasProbateCsv } from "@/lib/scrapers/vendors/pinellas-probate-csv";
import { prisma } from "@/lib/prisma";

async function main() {
  const daysBack = Number(process.argv[2] ?? 90);
  if (!Number.isFinite(daysBack) || daysBack <= 0) {
    console.error(`Invalid daysBack: ${process.argv[2]}`);
    process.exit(1);
  }
  console.log(`[pinellas-probate-backfill] starting — daysBack=${daysBack}`);
  const t0 = Date.now();
  const r = await scrapePinellasProbateCsv({ daysBack });
  console.log(JSON.stringify(r, null, 2));
  console.log(
    `[pinellas-probate-backfill] done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
      `${r.persisted} persisted from ${r.filesFound} daily files (${r.filesMissing} no-filing days, ${r.errors.length} errors)`,
  );
}

main()
  .catch((err) => {
    console.error("[pinellas-probate-backfill] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
