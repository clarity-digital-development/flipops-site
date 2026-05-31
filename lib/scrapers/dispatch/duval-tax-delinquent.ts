import { scrapeDuvalTaxDelinquent } from "@/lib/scrapers/vendors/duval-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: duval-tax-delinquent
// Wraps lib/scrapers/vendors/duval-tax-delinquent.ts → scrapeDuvalTaxDelinquent()
//
// Strategy: full (snapshot-diff promoted in Phase 4). Source publishes the
// current state of the delinquent universe — no incremental cursor. The
// existing scraper paginates ~54 pages × 500 records (~19 min) and persists
// to Lien table; the adapter just projects the result.
// ---------------------------------------------------------------------------

export const runDuvalTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeDuvalTaxDelinquent();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: null, // no incremental cursor — full scan each run
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
