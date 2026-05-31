import { scrapeMiamiDadeTaxDelinquent } from "@/lib/scrapers/vendors/miami-dade-tax-delinquent";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: miami-dade-tax-delinquent
//
// Phase 4: HEAD-check the PDF URL before invoking the full ~28-min scrape.
// Miami-Dade publishes 3 weekly delinquent-tax PDFs per year (May 13/20/27 in
// 2026) and the file is static between publications. By comparing the PDF's
// Last-Modified to our lastHighWaterMark we skip redundant re-runs.
//
// Strategy ladder:
//   1. Get the URL the vendor scraper currently targets
//   2. HEAD request → Last-Modified
//   3. If it matches lastHighWaterMark, no-op (rowCount=0)
//   4. Otherwise call the existing scrapeMiamiDadeTaxDelinquent() and stamp
//      newHighWaterMark = received Last-Modified
//
// The PDF URL is currently hard-coded inside the vendor scraper to the
// 2026-05-27 publication. A future iteration should scrape the legal-ads
// index page to auto-discover the latest weekly URL — until then this
// HEAD-check still saves the ~28-min re-parse on every tick where the URL
// hasn't changed (which is most of the year, since the source only updates
// 3 days in May).
// ---------------------------------------------------------------------------

const NOTICE_URL =
  "https://www.miamidade.gov/resources/legal-ads/county/tax-collector/2026/2026-05-27-public-notice-delinquent-property-taxes.pdf";

export const runMiamiDadeTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  // HEAD check first
  let lastModified: string | null = null;
  try {
    const head = await fetch(NOTICE_URL, { method: "HEAD" });
    if (head.ok) {
      lastModified = head.headers.get("last-modified");
    } else {
      ctx.stats.recordError(new Error(`HEAD ${head.status} on ${NOTICE_URL}`));
    }
  } catch (err) {
    ctx.stats.recordError(err);
  }

  // Skip if Last-Modified matches our recorded high-water mark.
  if (lastModified && ctx.lastHighWaterMark === lastModified) {
    console.log(`[miami-dade-tax-delinquent] PDF unchanged (Last-Modified=${lastModified}); skipping full re-parse`);
    return {
      rowCount: 0,
      rejectCount: 0,
      newHighWaterMark: lastModified,
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  }

  console.log(`[miami-dade-tax-delinquent] PDF changed (was=${ctx.lastHighWaterMark ?? "null"}, now=${lastModified}); running full scrape`);

  try {
    const result = await scrapeMiamiDadeTaxDelinquent();
    return {
      rowCount: result.persisted,
      rejectCount: result.skippedHallucinated,
      newHighWaterMark: lastModified ?? new Date().toISOString().slice(0, 10),
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
