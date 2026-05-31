import { scrapeHillsboroughTaxDelinquent } from "@/lib/scrapers/vendors/hillsborough-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: hillsborough-tax-delinquent
// Wraps lib/scrapers/vendors/hillsborough-tax-delinquent.ts.
//
// Phase 2: HTML-walk strategy (29 paginated pages, ~26 min). Phase 4 swaps
// this for the TaxSys CSV-export flow discovered in the Phase 0 probe
// (3-step XHR → 28.7k rows in ~30s, full Public-Delinquent Report).
//
// scrapeHillsboroughTaxDelinquent() result fields:
//   - persisted          → rowCount
//   - skippedHallucinated → rejectCount
//   - apnResolved        → noted as info; doesn't change rowCount (already counted)
// ---------------------------------------------------------------------------

export const runHillsboroughTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeHillsboroughTaxDelinquent();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: null, // snapshot-diff in Phase 4 will surface delta tokens
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
