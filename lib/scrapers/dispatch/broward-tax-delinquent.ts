import { scrapeBrowardTaxDelinquent } from "@/lib/scrapers/vendors/broward-tax-delinquent";
import { scrapeBrowardTaxDelinquentCsv } from "@/lib/scrapers/vendors/broward-tax-delinquent-csv";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: broward-tax-delinquent
//
// M1.4 fix (2026-06-09): the LienHub county-held certificates list is the
// post-cert-sale RESIDUE (1-100 records, near-empty ~11 months/year) — it was
// never the full delinquent universe, which is why Broward showed exactly
// 1 row vs ~26-39k for peer metros (AUDIT-A1).
//
// Primary source is now the TaxSys govhub CSV report
// "PUBLIC_BROWARD UNPAID REAL ESTATE" (broward-tax-delinquent-csv.ts):
// full universe, all roll years, with Balance Amount. The county-held scrape
// still runs as a supplement — it carries cert-level detail (face amount,
// certs outstanding, market value) for the highest-distress slice and
// balloons right after the June sale. Its failure must not sink the primary
// run, so it is wrapped in its own try/catch.
// ---------------------------------------------------------------------------

export const runBrowardTaxDelinquent: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();
  try {
    // Primary: full unpaid universe via the govhub CSV report.
    const csvResult = await scrapeBrowardTaxDelinquentCsv();

    // Supplement: LienHub county-held residue (best-effort).
    let countyHeldPersisted = 0;
    let countyHeldRejected = 0;
    try {
      const chResult = await scrapeBrowardTaxDelinquent();
      countyHeldPersisted = chResult.persisted;
      countyHeldRejected = chResult.skippedHallucinated;
    } catch (err) {
      console.warn(
        `[broward-tax-delinquent] county-held supplement failed (primary CSV run succeeded): ${(err as Error).message}`,
      );
      ctx.stats.recordError(err);
    }

    return {
      rowCount: csvResult.persisted + countyHeldPersisted,
      rejectCount: csvResult.skippedHallucinated + countyHeldRejected,
      newHighWaterMark: null, // full-snapshot strategy (no delta cursor)
      stats: ctx.stats.snapshot(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    ctx.stats.recordError(err);
    throw err;
  }
};
