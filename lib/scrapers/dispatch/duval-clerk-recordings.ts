import { scrapeDuvalRecordings } from "@/lib/scrapers/vendors/duval-clerk";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: duval-clerk-recordings
// Wraps lib/scrapers/vendors/duval-clerk.ts → scrapeDuvalRecordings({date}).
//
// Strategy: incremental-date. The vendor scraper already accepts a `date`
// param — this adapter just walks the cursor forward one day at a time.
//
// Cursor protocol:
//   - lastHighWaterMark = ISO date of the last successfully scraped day
//   - next run: scrape lastHighWaterMark + 1 day
//   - first run: scrape (today - 5 days) to catch any backfill posted late
//   - newHighWaterMark = the date just scraped (only on success)
//
// If we fall further behind than 1 day per run, the scheduler eventually
// catches up — but for Duval clerk (1,078/day, 3 min per run, daily cron)
// the steady state is "one day per run."
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextDateAfter(iso: string): Date {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const runDuvalClerk: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  // Compute target date.
  let target: Date;
  if (ctx.lastHighWaterMark) {
    target = nextDateAfter(ctx.lastHighWaterMark);
  } else {
    // First run: 5 days back to catch late-posted recordings.
    target = new Date();
    target.setUTCDate(target.getUTCDate() - 5);
  }

  // Don't scrape "today" (Duval clerk posts with up to a 24h lag).
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (target > yesterday) {
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: ctx.lastHighWaterMark, // no advance
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  try {
    const result = await scrapeDuvalRecordings({ date: target, useProxy: true });
    const total =
      (result.persistedMortgages ?? 0) +
      (result.persistedLiens ?? 0) +
      (result.persistedForeclosures ?? 0);
    return {
      rowCount: total,
      rejectCount: result.rejectedHallucinated ?? 0,
      newHighWaterMark: isoDate(target),
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
