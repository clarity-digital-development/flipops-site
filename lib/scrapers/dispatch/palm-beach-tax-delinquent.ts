import { scrapePalmBeachTaxDelinquent } from "@/lib/scrapers/vendors/palm-beach-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: palm-beach-tax-delinquent
// Wraps lib/scrapers/vendors/palm-beach-tax-delinquent.ts.
//
// Strategy: incremental-date — uses the FPN dateFrom/dateTo filter we
// discovered in the Phase 0 probe. The scraper's optional opts include
// `dateFrom` / `dateTo` (ISO YYYY-MM-DD, inclusive) that translate to the
// FPN API params `date-range--start-date` / `date-range--end-date`.
//
// Cursor protocol:
//   - lastHighWaterMark = ISO date of the most recent notice we ingested
//   - on next run: dateFrom = lastHighWaterMark, dateTo = today
//   - first run: no filter; scrape the full available window (last 35 days)
//   - newHighWaterMark = today (after run completes)
// ---------------------------------------------------------------------------

export const runPalmBeachTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Build incremental window from lastHighWaterMark. First run = no filter.
  const opts: { dateFrom?: string; dateTo?: string } = {};
  if (ctx.lastHighWaterMark) {
    opts.dateFrom = ctx.lastHighWaterMark;
    opts.dateTo = today;
  }

  try {
    const result = await scrapePalmBeachTaxDelinquent(opts);
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: today,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
