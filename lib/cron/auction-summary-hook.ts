import { refreshAuctionSummary } from "@/scripts/rescore-auction";

// ---------------------------------------------------------------------------
// Auction-summary refresh hook — pure logic separated from worker-bullmq's
// process-entry side effects so vitest can import without booting Redis.
//
// Triggered by every domain worker's `completed` event. Filters by sourceKey,
// calls refreshAuctionSummary, logs success/failure. Never throws — errors
// are logged so the worker stays healthy.
// ---------------------------------------------------------------------------

// Source keys whose successful completion should refresh the materialized
// AuctionSummary aggregate. Add new keys here when more sources feed
// Foreclosure rows that contribute to AuctionSummary scoring.
export const AUCTION_SUMMARY_REFRESH_SOURCE_KEYS = new Set<string>([
  "realauction-fl-foreclosures",
  "realtaxdeed-fl-tax-deeds", // M2.2 — tax-deed rows feed AuctionSummary too
]);

/**
 * Pure handler invoked by every domain worker's `completed` event.
 *
 * Exported with dependency injection so unit tests can supply a mock
 * `refresh` without needing a real Redis connection or BullMQ Worker.
 */
export async function handleScrapeCompleted(
  job: { data?: { sourceKey?: string } } | null | undefined,
  deps: {
    refresh: () => Promise<{ rowsAffected: number; durationMs: number }>;
    log?: (msg: string) => void;
    error?: (msg: string, err: unknown) => void;
  } = {
    refresh: refreshAuctionSummary,
    log: (msg) => console.log(msg),
    error: (msg, err) => console.error(msg, err),
  },
): Promise<void> {
  const sourceKey = job?.data?.sourceKey;
  if (!sourceKey || !AUCTION_SUMMARY_REFRESH_SOURCE_KEYS.has(sourceKey)) return;
  const log = deps.log ?? ((m: string) => console.log(m));
  const error = deps.error ?? ((m: string, e: unknown) => console.error(m, e));
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
