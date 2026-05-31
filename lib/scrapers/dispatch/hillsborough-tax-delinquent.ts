import { scrapeHillsboroughTaxDelinquentCsv } from "@/lib/scrapers/vendors/hillsborough-tax-delinquent-csv";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: hillsborough-tax-delinquent
//
// Phase 4: switched to CSV download flow (`hillsborough-tax-delinquent-csv.ts`)
// — drops scrape time from ~26 min (29-page HTML walk) to ~1 min (single
// 3.5MB CSV download). Probe-verified in Phase 0.
//
// Result fields:
//   - persisted          → rowCount
//   - skippedHallucinated → rejectCount
//   - apnResolved        → reported via durationMs side-channel; doesn't
//     change rowCount (already counted via persisted).
//
// Fallback: if the CSV flow ever breaks, swap import back to
// `scrapeHillsboroughTaxDelinquent` from `../vendors/hillsborough-tax-delinquent`
// (the HTML pagination path is preserved).
// ---------------------------------------------------------------------------

export const runHillsboroughTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeHillsboroughTaxDelinquentCsv();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: null, // full-snapshot strategy (no delta cursor)
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
