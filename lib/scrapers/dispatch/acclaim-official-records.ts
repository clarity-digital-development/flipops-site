import {
  ACCLAIM_COUNTIES,
  scrapeAcclaimCounty,
} from "@/lib/scrapers/vendors/acclaim-records";
import type { RunContext, RunResult, ScraperAdapter } from "./types";

// ---------------------------------------------------------------------------
// Adapter: acclaim-official-records (M2.1a)
// Wraps lib/scrapers/vendors/acclaim-records.ts across the Acclaim family
// counties (Duval + Broward to start; new counties are config rows).
//
// Strategy: incremental-date over the RECORDING-date range.
//   - lastHighWaterMark = ISO date the window ran THROUGH (the `to` date)
//   - next run: from = lastHighWaterMark - OVERLAP_DAYS (clerks post with
//     lag and re-record corrections; the stable source key makes the
//     overlap re-upsert harmless), to = today
//   - first run: trailing 30 days (full backfill is a separate operator run
//     via scripts/run-acclaim-local.ts --days N)
//
// Egress: per-county config in ACCLAIM_COUNTIES (both DIRECT, verified
// 2026-06-10). Sequential counties with pacing — no internal parallelism.
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_DAYS = 30;
const OVERLAP_DAYS = 3;
const BETWEEN_COUNTIES_MS = 4000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export const runAcclaimOfficialRecords: ScraperAdapter = async (
  ctx: RunContext,
): Promise<RunResult> => {
  const start = Date.now();

  const to = new Date();
  let from: Date;
  if (ctx.lastHighWaterMark) {
    from = new Date(`${ctx.lastHighWaterMark}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - OVERLAP_DAYS);
  } else {
    from = new Date();
    from.setUTCDate(from.getUTCDate() - DEFAULT_WINDOW_DAYS);
  }

  let totalPersisted = 0;
  let totalRejected = 0;
  let counties = 0;
  const errors: Array<{ county: string; message: string }> = [];

  for (const county of ACCLAIM_COUNTIES) {
    counties++;
    try {
      const r = await scrapeAcclaimCounty({
        countyFips: county.countyFips,
        from,
        to,
      });
      totalPersisted +=
        r.persistedMortgages + r.persistedLiens + r.satisfactionsApplied;
      totalRejected += r.rejected;
      console.log(
        `[acclaim-ori] ${r.county} ${r.from}..${r.to}: found=${r.found} mtg=${r.persistedMortgages} lien=${r.persistedLiens} sat=${r.satisfactionsApplied} apn(direct=${r.apnJoin.direct} name=${r.apnJoin.uniqueName})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[acclaim-ori] county=${county.countyFips} failed: ${message}`);
      errors.push({ county: county.countyFips, message });
      ctx.stats.recordError(err);
    }
    await sleep(BETWEEN_COUNTIES_MS);
  }

  // Total-failure contract (mirrors realtaxdeed adapter): every county
  // errored AND nothing persisted → fail the audit row with a real message.
  if (totalPersisted === 0 && errors.length === counties && counties > 0) {
    throw new Error(
      `All ${counties} Acclaim counties failed; first error: ${errors[0].message}`,
    );
  }

  return {
    rowCount: totalPersisted,
    rejectCount: totalRejected,
    // Only advance the cursor when every county succeeded — a partial run
    // keeps the old HWM so the failed county's window is retried next run.
    newHighWaterMark: errors.length === 0 ? isoDate(to) : ctx.lastHighWaterMark,
    stats: ctx.stats.snapshot(),
    durationMs: Date.now() - start,
  };
};
