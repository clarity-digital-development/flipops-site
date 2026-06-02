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
  let totalIterations = 0;
  const iterErrors: Array<{ county: string; track: string; message: string }> = [];

  for (const county of REALAUCTION_COUNTIES) {
    for (const track of county.tracks) {
      totalIterations++;
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
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack?.slice(0, 200) : undefined;
        // eslint-disable-next-line no-console
        console.warn(
          `[realauction-fl-foreclosures] iter failed county=${county.countyFips} track=${track} err=${message}${stack ? ` stack=${stack}` : ""}`,
        );
        iterErrors.push({ county: county.countyFips, track, message });
        ctx.stats.recordError(err);
        // continue — partial data is more useful than no data
      }
    }
  }

  const totalRowCount = totalForeclosures + totalLiens;

  // If every iteration errored AND we landed zero rows, the run was a
  // total failure — throw so processJob marks the audit row status='failed'
  // with a real errorMessage instead of silently logging status='succeeded'
  // + recordsFetched=0 + errorMessage=null. RunResult has no errorMessage
  // field, so the throw path is the only contract-clean way to surface this.
  if (totalRowCount === 0 && iterErrors.length === totalIterations && totalIterations > 0) {
    throw new Error(
      `All ${totalIterations} iterations failed; first error: ${iterErrors[0].message}`,
    );
  }

  return {
    rowCount: totalRowCount,
    rejectCount: Math.max(0, totalFound - totalForeclosures - totalLiens),
    newHighWaterMark: new Date().toISOString().slice(0, 10),
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
