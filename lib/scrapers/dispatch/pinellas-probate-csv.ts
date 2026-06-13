import { scrapePinellasProbateCsv } from "@/lib/scrapers/vendors/pinellas-probate-csv";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: pinellas-probate-csv  (M3.1 / OPS-8, GREEN)
//
// Captcha-free daily-CSV ingester for Pinellas (12103) new-estate probate
// filings. Strategy: incremental-date — cursor = last scraped ISO day. Bootstrap
// pulls the full ~90-day retained window; subsequent runs fetch from the cursor
// forward (idempotent upsert makes the small overlap harmless, which also
// catches files posted late on the next business day).
//
// Supersedes the Pinellas branch of the reCAPTCHA-gated `probate-official-records`
// adapter (probate-mvc.ts) — richer fields, $0, zero scraping risk.
// ---------------------------------------------------------------------------

export const runPinellasProbateCsv: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    const sinceDate = ctx.lastHighWaterMark ? new Date(ctx.lastHighWaterMark) : null;
    const result = await scrapePinellasProbateCsv({ sinceDate });

    if (result.outcome === "error" && result.persisted === 0) {
      // Surface fetch failures so the audit row reflects a real problem rather
      // than a silent zero-row "success".
      ctx.stats.recordError(new Error(result.errors.slice(0, 3).join(" | ") || "fetch failed"));
    }

    return {
      rowCount: result.persisted,
      rejectCount: 0,
      newHighWaterMark: result.newHighWaterMark,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
