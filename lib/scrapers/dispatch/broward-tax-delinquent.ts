import { scrapeBrowardTaxDelinquent } from "@/lib/scrapers/vendors/broward-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: broward-tax-delinquent
// Wraps lib/scrapers/vendors/broward-tax-delinquent.ts (LienHub county-held
// certificates). Tiny dataset year-round, balloons after the June cert sale.
// ---------------------------------------------------------------------------

export const runBrowardTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeBrowardTaxDelinquent();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: null,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
