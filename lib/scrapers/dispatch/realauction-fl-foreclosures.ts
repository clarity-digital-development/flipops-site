import { scrapeRealAuctionsPlaywright } from "@/lib/scrapers/vendors/realauction-playwright";
import { REALAUCTION_COUNTIES } from "@/lib/scrapers/vendors/realauction";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: realauction-fl-foreclosures
// Wraps lib/scrapers/vendors/realauction-playwright.ts across all 16 wired
// FL counties × their supported tracks (foreclosure / tax-deed / tax-lien).
//
// The vendor scraper takes a SINGLE (countyFips, track, auctionDate) combo.
// This adapter enumerates the combinations from the REALAUCTION_COUNTIES
// registry × the next ~14 weekdays (auctions don't run weekends), and
// aggregates results.
//
// Backfill rationale: a single-day calendar view often returns 0 rows
// because the targeted date has no scheduled auctions. Iterating the next
// N weekdays per (county, track) catches anything on the calendar within
// the lookahead window. The consecutive-zero-skip short-circuits counties
// that have no upcoming auctions at all, keeping the run within the
// MAX_RA_REQUESTS budget.
//
// Stagger: the queue's `limiter` enforces an overall rate cap. Within the
// adapter we run sequentially per (county, track, date) — no internal
// parallelism — because each scrape spins up its own stealth-chromium
// browser and 16+ concurrent browsers would OOM the worker. A 1.2s pause
// between dates keeps per-county pacing polite.
// ---------------------------------------------------------------------------

const DEFAULT_LOOKAHEAD_DAYS = 14;
const DEFAULT_MAX_REQUESTS = 200;
const CONSECUTIVE_ZERO_LIMIT = 2;
const PACING_MS = 1200;

function formatDateMDY(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Generate the next N weekdays (UTC) starting from today (inclusive).
 * Skips Saturday (6) and Sunday (0) — auctions don't run on weekends.
 */
function nextWeekdays(count: number, from: Date = new Date()): string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (dates.length < count) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(formatDateMDY(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export const runRealAuction: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  let totalFound = 0;
  let totalForeclosures = 0;
  let totalLiens = 0;
  let totalIterations = 0;
  let totalRequests = 0;
  const iterErrors: Array<{ county: string; track: string; date: string; message: string }> = [];

  const maxRequests = Math.max(
    1,
    parseInt(process.env.MAX_RA_REQUESTS ?? "", 10) || DEFAULT_MAX_REQUESTS,
  );
  const lookaheadDays = Math.max(
    1,
    parseInt(process.env.RA_LOOKAHEAD_DAYS ?? "", 10) || DEFAULT_LOOKAHEAD_DAYS,
  );
  const dates = nextWeekdays(lookaheadDays);

  outer: for (const county of REALAUCTION_COUNTIES) {
    for (const track of county.tracks) {
      let consecutiveZero = 0;
      for (const auctionDate of dates) {
        if (totalRequests >= maxRequests) {
          // eslint-disable-next-line no-console
          console.warn(
            `[realauction-fl-foreclosures] hit MAX_RA_REQUESTS=${maxRequests}; stopping early`,
          );
          break outer;
        }
        totalIterations++;
        totalRequests++;
        try {
          const result = await scrapeRealAuctionsPlaywright({
            countyFips: county.countyFips,
            track,
            // useProxy=false: RealAuction's WAF 403s the DataImpulse
            // residential pool (L0 probe 2026-06-02). The new XHR path runs
            // direct from Railway. See vendor file header for fallback plan.
            useProxy: false,
            auctionDate,
          });
          if (result === null) {
            // county doesn't run this track — bail the whole track loop
            break;
          }
          totalFound += result.found;
          totalForeclosures += result.persistedForeclosures;
          totalLiens += result.persistedLiens;

          if (result.found === 0) {
            consecutiveZero++;
            if (consecutiveZero >= CONSECUTIVE_ZERO_LIMIT) {
              // eslint-disable-next-line no-console
              console.info(
                `[realauction-fl-foreclosures] ${county.countyFips}/${track}: ${consecutiveZero} consecutive zero-row dates, skipping remaining ${dates.length - dates.indexOf(auctionDate) - 1} dates`,
              );
              break;
            }
          } else {
            consecutiveZero = 0;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack?.slice(0, 200) : undefined;
          // eslint-disable-next-line no-console
          console.warn(
            `[realauction-fl-foreclosures] iter failed county=${county.countyFips} track=${track} date=${auctionDate} err=${message}${stack ? ` stack=${stack}` : ""}`,
          );
          iterErrors.push({ county: county.countyFips, track, date: auctionDate, message });
          ctx.stats.recordError(err);
          // count an error as a zero so persistent failures don't burn the
          // whole lookahead window on a single broken (county, track).
          consecutiveZero++;
          if (consecutiveZero >= CONSECUTIVE_ZERO_LIMIT) break;
        }

        // polite pause between requests for the same county
        await sleep(PACING_MS);
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
