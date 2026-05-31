import { scrapeMiamiDadeTaxDelinquent } from "@/lib/scrapers/vendors/miami-dade-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: miami-dade-tax-delinquent
// Wraps lib/scrapers/vendors/miami-dade-tax-delinquent.ts.
//
// Strategy: head-check + full re-parse (registry strategy="head-check").
// Phase 4 will add an actual HEAD request on the PDF URL to skip the run
// if Last-Modified hasn't changed (the PDF is static between weekly
// publications during May). For Phase 2 we just run the scraper; the season
// filter already keeps this idle outside May-June.
//
// The adapter uses lastHighWaterMark to stamp the PDF URL it just processed
// (so a future head-check can skip if unchanged).
// ---------------------------------------------------------------------------

export const runMiamiDadeTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const result = await scrapeMiamiDadeTaxDelinquent();
    // Stamp the run date as the high-water mark — Phase 4 will switch to the
    // actual PDF Last-Modified header.
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: new Date().toISOString().slice(0, 10),
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
