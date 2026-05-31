import type { Redis } from "ioredis";

// ---------------------------------------------------------------------------
// Atomic Redis-backed politeness semaphore.
//
// Replaces the in-process `nextAllowedAt` Map at http-client.ts:106-114, which
// breaks at worker replicas > 1 (each replica has its own Map → double-hits
// host → yellow-zone ban risk).
//
// The atomic primitive is `SET key value PX ttl NX`: only sets if the key
// doesn't exist. Returns "OK" on success, null if key exists. No race window
// between check-and-set.
//
// See docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Politeness".
// ---------------------------------------------------------------------------

interface PolitenessOptions {
  /** Per-host minimum gap in milliseconds. */
  rateLimitMs: number;
  /** Total time budget for waiting before fail-open. Default 10s. */
  timeoutMs?: number;
  /** Per-iteration sleep cap (avoid one big sleep blocking shutdown). Default 5s. */
  maxSleepMs?: number;
}

/**
 * Wait until this caller can issue a request to `host` without violating the
 * per-host rate limit. Atomic across worker replicas via Redis.
 *
 * Fail-open semantics: if Redis is unreachable or the timeout is exceeded,
 * the function returns (does NOT throw). Better to over-request than to
 * deadlock the scraper. Track these events in run-stats.
 *
 * Returns true if the slot was claimed atomically, false if fail-open fired.
 */
export async function waitPoliteSlot(
  redis: Redis,
  host: string,
  opts: PolitenessOptions,
): Promise<boolean> {
  const { rateLimitMs, timeoutMs = 10_000, maxSleepMs = 5_000 } = opts;
  const key = `next-allowed:${host}`;
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      // Fail-open: caller proceeds without throttle. Surfaces as a stat.
      return false;
    }
    const now = Date.now();
    const target = now + rateLimitMs;
    // SET key value PX <ttl> NX — atomic. Returns "OK" if set, null if existed.
    // TTL is 2x the rate limit so we self-heal if a worker dies mid-burst.
    const ok = await redis
      .set(key, String(target), "PX", rateLimitMs * 2, "NX")
      .catch(() => null);
    if (ok === "OK") return true;

    // Slot held by another worker. Read their target, sleep until then.
    const existing = await redis.get(key).catch(() => null);
    const wait = existing
      ? Math.max(0, parseInt(existing, 10) - now)
      : rateLimitMs;
    await sleep(Math.min(wait, maxSleepMs));
  }
}

/** Force-release a politeness slot (e.g., on graceful shutdown). */
export async function releasePoliteSlot(redis: Redis, host: string): Promise<void> {
  await redis.del(`next-allowed:${host}`).catch(() => {});
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
