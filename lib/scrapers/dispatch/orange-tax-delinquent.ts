import { scrapeOrangeTaxDelinquent } from "@/lib/scrapers/vendors/orange-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: orange-tax-delinquent
// Wraps lib/scrapers/vendors/orange-tax-delinquent.ts (LienHub advertised list).
//
// Strategy: full during the seasonal window (April-July per registry
// `seasonStart/End`). Outside the window the worker-bullmq runner skips
// scheduled ticks via the season filter before this adapter is even called,
// so no extra guard needed here.
//
// taxYear is derived inside the scraper from the auction title — we don't
// stamp a new high-water mark.
// ---------------------------------------------------------------------------

export const runOrangeTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeOrangeTaxDelinquent();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: String(result.taxYear), // useful for "have we seen this season?"
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
