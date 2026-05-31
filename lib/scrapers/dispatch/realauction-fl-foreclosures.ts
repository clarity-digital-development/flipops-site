import { scrapeRealAuctionsPlaywright } from "@/lib/scrapers/vendors/realauction-playwright";
import { REALAUCTION_COUNTIES } from "@/lib/scrapers/vendors/realauction";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: realauction-fl-foreclosures
// Wraps lib/scrapers/vendors/realauction-playwright.ts across all 16 wired
// FL counties × their supported tracks (foreclosure / tax-deed / tax-lien).
//
// The vendor scraper takes a SINGLE (countyFips, track) combination. This
// adapter enumerates the combinations from the REALAUCTION_COUNTIES registry
// and aggregates results.
//
// Strategy: snapshot-diff (no historical archive — calendar is current-state
// only). Phase 4 will add DB-side delta filtering so we only persist changed
// auction status; for Phase 2 every run does the full enumeration.
//
// Stagger: the queue's `limiter` enforces an overall rate cap. Within the
// adapter we run sequentially per (county, track) — no internal parallelism
// — because each scrape spins up its own stealth-chromium browser and 16+
// concurrent browsers would OOM the worker.
// ---------------------------------------------------------------------------

export const runRealAuction: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  let totalFound = 0;
  let totalForeclosures = 0;
  let totalLiens = 0;

  for (const county of REALAUCTION_COUNTIES) {
    for (const track of county.tracks) {
      try {
        const result = await scrapeRealAuctionsPlaywright({
          countyFips: county.countyFips,
          track,
          useProxy: true,
        });
        if (result === null) continue; // county doesn't run this track
        totalFound += result.found;
        totalForeclosures += result.persistedForeclosures;
        totalLiens += result.persistedLiens;
      } catch (err) {
        ctx.stats.recordError(err);
        // continue — partial data is more useful than no data
      }
    }
  }

  return {
    rowCount: totalForeclosures + totalLiens,
    rejectCount: Math.max(0, totalFound - totalForeclosures - totalLiens),
    newHighWaterMark: new Date().toISOString().slice(0, 10),
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
