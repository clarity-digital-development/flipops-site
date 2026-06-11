import {
  REALTAXDEED_COUNTIES,
  fetchTaxDeedSaleDates,
  scrapeRealTaxDeed,
  parseSaleDate,
} from "@/lib/scrapers/vendors/realtaxdeed";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: realtaxdeed-fl-tax-deeds (M2.2)
// Wraps lib/scrapers/vendors/realtaxdeed.ts across the 29 verified
// `*.realtaxdeed.com` counties.
//
// CALENDAR-FIRST enumeration (vs the foreclosure adapter's blind weekday
// iteration + consecutive-zero skip): tax-deed sales run roughly monthly per
// county, so blind date probes would either miss sale dates or burn the
// request budget. Instead we read each county's auction calendar (current +
// RTD_MONTHS_AHEAD months; days with sales carry a dayid attribute) and only
// XHR the dates that actually have sales.
//
// Budget per full run, worst case: 29 counties × 3 calendar GETs
// + (sale dates × 4 requests each: 1 splash + 3 areas, splash cookie cached
// per county). RTD_MAX_REQUESTS caps the total.
//
// Sequential per county with polite pacing — no internal parallelism, same
// posture as the foreclosure adapter. Direct egress (useProxy:false):
// RealAuction's WAF 403s the DataImpulse pool.
// ---------------------------------------------------------------------------

const DEFAULT_MONTHS_AHEAD = 2; // current month + 2
const DEFAULT_MAX_REQUESTS = 250;
const DEFAULT_MAX_DATES_PER_COUNTY = 8;
const LOOKBACK_DAYS = 7; // recent past sales (area C) still worth capturing
const PACING_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export const runRealTaxDeedFl: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  let totalFound = 0;
  let totalPersisted = 0;
  let totalIterations = 0;
  let totalRequests = 0;
  const iterErrors: Array<{ county: string; date: string; message: string }> = [];

  const maxRequests = Math.max(
    1,
    parseInt(process.env.RTD_MAX_REQUESTS ?? "", 10) || DEFAULT_MAX_REQUESTS,
  );
  const monthsAhead = Math.max(
    0,
    parseInt(process.env.RTD_MONTHS_AHEAD ?? "", 10) || DEFAULT_MONTHS_AHEAD,
  );
  const maxDatesPerCounty = Math.max(
    1,
    parseInt(process.env.RTD_MAX_DATES_PER_COUNTY ?? "", 10) || DEFAULT_MAX_DATES_PER_COUNTY,
  );

  const lookbackCutoff = Date.now() - LOOKBACK_DAYS * 86400000;

  outer: for (const county of REALTAXDEED_COUNTIES) {
    // (1) Calendar discovery — counts against the request budget too.
    let saleDates: string[] = [];
    totalRequests += monthsAhead + 1;
    try {
      saleDates = await fetchTaxDeedSaleDates({
        subdomain: county.subdomain,
        monthsAhead,
        useProxy: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[realtaxdeed-fl] calendar fetch failed county=${county.countyFips}: ${message}`);
      iterErrors.push({ county: county.countyFips, date: "(calendar)", message });
      ctx.stats.recordError(err);
      totalIterations++;
      continue;
    }

    // Drop dates older than the lookback window; cap per county.
    const dates = saleDates
      .filter((d) => {
        const t = parseSaleDate(d)?.getTime();
        return t !== undefined && t >= lookbackCutoff;
      })
      .slice(0, maxDatesPerCounty);

    if (dates.length === 0) {
      await sleep(PACING_MS);
      continue;
    }

    for (const saleDate of dates) {
      if (totalRequests >= maxRequests) {
        console.warn(`[realtaxdeed-fl] hit RTD_MAX_REQUESTS=${maxRequests}; stopping early`);
        break outer;
      }
      totalIterations++;
      totalRequests += 4; // splash (cookie-cached, amortized) + 3 areas
      try {
        const result = await scrapeRealTaxDeed({
          countyFips: county.countyFips,
          saleDate,
          useProxy: false,
        });
        if (result === null) break; // county not in registry — shouldn't happen
        totalFound += result.found;
        totalPersisted += result.persisted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[realtaxdeed-fl] iter failed county=${county.countyFips} date=${saleDate} err=${message}`,
        );
        iterErrors.push({ county: county.countyFips, date: saleDate, message });
        ctx.stats.recordError(err);
      }
      await sleep(PACING_MS);
    }
  }

  // Total-failure contract (mirrors realauction-fl-foreclosures): if every
  // iteration errored AND nothing persisted, throw so the audit row gets
  // status='failed' with a real errorMessage.
  if (totalPersisted === 0 && iterErrors.length === totalIterations && totalIterations > 0) {
    throw new Error(
      `All ${totalIterations} iterations failed; first error: ${iterErrors[0].message}`,
    );
  }

  return {
    rowCount: totalPersisted,
    rejectCount: Math.max(0, totalFound - totalPersisted),
    newHighWaterMark: new Date().toISOString().slice(0, 10),
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
