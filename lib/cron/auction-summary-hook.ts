import { refreshAuctionSummary } from "@/scripts/rescore-auction";
import { matchProbateCasesToParcels, refreshProbateSummary } from "@/scripts/rescore-probate";

// ---------------------------------------------------------------------------
// Post-scrape rescore hooks — pure logic separated from worker-bullmq's
// process-entry side effects so vitest can import without booting Redis.
//
// Triggered by every domain worker's `completed` event. Filters by sourceKey,
// dispatches the matching materialized-aggregate refresh, logs success/failure.
// Never throws — errors are logged so the worker stays healthy.
// ---------------------------------------------------------------------------

// Source keys whose successful completion should refresh the materialized
// AuctionSummary aggregate. Add new keys here when more sources feed
// Foreclosure rows that contribute to AuctionSummary scoring.
export const AUCTION_SUMMARY_REFRESH_SOURCE_KEYS = new Set<string>([
  "realauction-fl-foreclosures",
  "realtaxdeed-fl-tax-deeds", // M2.2 — tax-deed rows feed AuctionSummary too
]);

// M3.1 — probate sources → the counties whose ProbateSummary should be rebuilt
// after a successful run. Scoped per county because the matcher's owner-name
// normalization CTE is county-sized (~county parcel count); an un-scoped run
// would re-scan all 67 counties on every probate scrape. Each county runs both
// passes in sequence (decedent→owner match, then ProbateSummary materialize) —
// the same flow as the manual `scripts/rescore-probate.ts`.
export const PROBATE_REFRESH_COUNTIES: Record<string, string[]> = {
  "pinellas-probate-csv": ["12103"], // GREEN daily CSV
  "probate-official-records": ["12095", "12011"], // Orange, Broward (Pinellas now via CSV)
};

// Default probate rescore: per county, match then materialize. Returns a
// one-line summary for the worker log. Heavy (the match re-scans the county),
// but runs in the background `completed` handler so it never blocks the queue.
async function defaultRefreshProbate(counties: string[]): Promise<string> {
  const parts: string[] = [];
  for (const countyFips of counties) {
    const m = await matchProbateCasesToParcels({ countyFips });
    const s = await refreshProbateSummary({ countyFips });
    parts.push(
      `${countyFips}: match EXACT=${m.exact} STRONG=${m.strong} NONE=${m.none} → summary rows=${s.rowsAffected}`,
    );
  }
  return parts.join(" | ");
}

/**
 * Pure handler invoked by every domain worker's `completed` event.
 *
 * Exported with dependency injection so unit tests can supply mock refreshers
 * without needing a real Redis connection or BullMQ Worker. The auction and
 * probate paths are independent: a sourceKey can match either (or, in theory,
 * both) — each is guarded by its own try/catch so one failing never blocks the
 * other or escapes the handler.
 */
export async function handleScrapeCompleted(
  job: { data?: { sourceKey?: string } } | null | undefined,
  deps: {
    refresh: () => Promise<{ rowsAffected: number; durationMs: number }>;
    refreshProbate?: (counties: string[]) => Promise<string>;
    log?: (msg: string) => void;
    error?: (msg: string, err: unknown) => void;
  } = {
    refresh: refreshAuctionSummary,
    refreshProbate: defaultRefreshProbate,
    log: (msg) => console.log(msg),
    error: (msg, err) => console.error(msg, err),
  },
): Promise<void> {
  const sourceKey = job?.data?.sourceKey;
  if (!sourceKey) return;
  const log = deps.log ?? ((m: string) => console.log(m));
  const error = deps.error ?? ((m: string, e: unknown) => console.error(m, e));

  if (AUCTION_SUMMARY_REFRESH_SOURCE_KEYS.has(sourceKey)) {
    try {
      const result = await deps.refresh();
      log(
        `[worker-bullmq] AuctionSummary refreshed after ${sourceKey}: rows=${result.rowsAffected} duration=${result.durationMs}ms`,
      );
    } catch (err) {
      error(
        `[worker-bullmq] AuctionSummary refresh failed after ${sourceKey}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const probateCounties = PROBATE_REFRESH_COUNTIES[sourceKey];
  if (probateCounties) {
    const refreshProbate = deps.refreshProbate ?? defaultRefreshProbate;
    try {
      const summary = await refreshProbate(probateCounties);
      log(`[worker-bullmq] ProbateSummary refreshed after ${sourceKey}: ${summary}`);
    } catch (err) {
      error(
        `[worker-bullmq] Probate rescore failed after ${sourceKey}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
