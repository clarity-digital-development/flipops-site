import { describe, it, expect, vi } from "vitest";
import {
  handleScrapeCompleted,
  AUCTION_SUMMARY_REFRESH_SOURCE_KEYS,
} from "@/lib/cron/auction-summary-hook";

// ---------------------------------------------------------------------------
// T4 — Unit tests for the BullMQ `completed` hook.
//
// Protects the D2 (plan-eng-review) sourceKey filter from silent regression:
//   1. Filter PASS  — 'realauction-fl-foreclosures' triggers refresh
//   2. Filter BLOCK — other source keys do NOT trigger refresh
//   3. Error handling — refresh failure is logged but does NOT propagate
//      out of the handler (worker stays healthy).
// ---------------------------------------------------------------------------

describe("handleScrapeCompleted", () => {
  it("calls refresh when sourceKey is in AUCTION_SUMMARY_REFRESH_SOURCE_KEYS", async () => {
    const refresh = vi.fn().mockResolvedValue({ rowsAffected: 246, durationMs: 50 });
    const log = vi.fn();

    await handleScrapeCompleted(
      { data: { sourceKey: "realauction-fl-foreclosures" } },
      { refresh, log, error: vi.fn() },
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("AuctionSummary refreshed after realauction-fl-foreclosures"),
    );
  });

  it("calls refresh for realtaxdeed-fl-tax-deeds (M2.2 — tax-deed rows feed AuctionSummary)", async () => {
    const refresh = vi.fn().mockResolvedValue({ rowsAffected: 89, durationMs: 40 });
    const log = vi.fn();

    await handleScrapeCompleted(
      { data: { sourceKey: "realtaxdeed-fl-tax-deeds" } },
      { refresh, log, error: vi.fn() },
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("AuctionSummary refreshed after realtaxdeed-fl-tax-deeds"),
    );
  });

  it("does NOT call refresh when sourceKey is NOT in the allow-set", async () => {
    const refresh = vi.fn();
    const log = vi.fn();
    const error = vi.fn();

    // Try several non-allowed sourceKeys to lock the filter behavior.
    await handleScrapeCompleted({ data: { sourceKey: "jaxdailyrecord-foreclosures" } }, { refresh, log, error });
    await handleScrapeCompleted({ data: { sourceKey: "lienhub-fl-tax-liens" } }, { refresh, log, error });
    await handleScrapeCompleted({ data: { sourceKey: "miamidade-property-search" } }, { refresh, log, error });
    await handleScrapeCompleted({ data: { sourceKey: undefined } }, { refresh, log, error });
    await handleScrapeCompleted(null, { refresh, log, error });
    await handleScrapeCompleted(undefined, { refresh, log, error });

    expect(refresh).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("logs but does NOT propagate when refresh throws", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    const error = vi.fn();

    // Must NOT throw — worker stays healthy.
    await expect(
      handleScrapeCompleted(
        { data: { sourceKey: "realauction-fl-foreclosures" } },
        { refresh, log: vi.fn(), error },
      ),
    ).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("AuctionSummary refresh failed after realauction-fl-foreclosures"),
      "DB connection lost",
    );
  });

  it("sanity: the allow-set currently contains exactly the realauction + realtaxdeed keys (regression guard)", () => {
    // If this fails, somebody added a new source key without writing tests
    // for its expected behavior. Update the set AND extend the filter-PASS
    // test above to cover the new key, then update this assertion.
    expect(AUCTION_SUMMARY_REFRESH_SOURCE_KEYS.size).toBe(2);
    expect(AUCTION_SUMMARY_REFRESH_SOURCE_KEYS.has("realauction-fl-foreclosures")).toBe(true);
    expect(AUCTION_SUMMARY_REFRESH_SOURCE_KEYS.has("realtaxdeed-fl-tax-deeds")).toBe(true);
  });
});
