// ---------------------------------------------------------------------------
// Polite HTTP client for scrapers.
// - Per-host rate limiting (one in-flight request per host at a time, with a
//   minimum gap defined by the scraper config)
// - Residential proxy support via undici ProxyAgent (Bright Data /
//   Smartproxy / Oxylabs). Activated by passing `useProxy: true` (callers
//   in yellow-zone scrapers MUST opt in; green-zone callers go direct).
// - Retry with exponential backoff for transient failures (429, 503, 502, 504)
// - Jittered timing per §5.1 of [docs/development/FL-COVERAGE-PLAN.md]
//   (truncated-normal, σ ≈ 30% of mean) so we don't look like a bot pacing
//   on a fixed metronome.
// - User-Agent rotation pool for yellow-zone calls (real Chrome
//   fingerprints, not the bot UA). Green-zone calls keep the polite UA.
// ---------------------------------------------------------------------------

import { ProxyAgent, type Dispatcher } from "undici";

const POLITE_USER_AGENT =
  "FlipOps-PublicRecordsBot/1.0 (+https://flipops.io/scraping; ops@flipops.io)";

// Realistic Chrome fingerprints — used when useProxy is true (yellow zone).
// Update annually; rotate per request.
const CHROME_UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Lazily-built proxy dispatcher; reused across calls to avoid agent churn.
 *
 *  Provider precedence (2026-05-31): PROXY_URL (provider-agnostic — currently
 *  DataImpulse) → BRIGHT_DATA_PROXY_URL (legacy, blocked by KYC gate on
 *  POST; see project_bright_data_402.md memory) → HTTPS_PROXY / HTTP_PROXY
 *  fallthroughs. PROXY_URL ships first so production cuts over to DataImpulse
 *  without touching call sites; BD stays defined as a documented fallback.
 *
 *  TLS posture is tight by default and ONLY relaxes the target-TLS branch
 *  that the proxy's edge actively MITMs by design:
 *
 *    • `proxyTls` (connection us → proxy edge)  → strict verification.
 *      The proxy has a valid public cert for its gateway domain; any cert
 *      mismatch here indicates a real on-path attacker between Railway and
 *      the proxy edge, and MUST fail. This is where our credentials transit
 *      in the Proxy-Authorization header.
 *    • `requestTls` (connection proxy → public site, that we see as the
 *      tunnel's TLS to the target) → cert verification skipped. Both BD's
 *      Web Unlocker and DataImpulse's residential gateway MITM this branch
 *      so they can inject JS rendering / fingerprint emulation / sticky
 *      sessions. The cert we see in this branch is the proxy's MITM cert,
 *      not the target's. The proper alternative would be pinning each
 *      provider's MITM CA in `requestTls.ca` — captured as TODO. For now
 *      this matches the `-k` flag the providers themselves recommend and
 *      confines the exposure to the MITM-as-a-service surface we already
 *      chose to use.
 *
 *  Direct (green-zone) fetches never go through this agent and keep full
 *  end-to-end strict TLS.
 */
let cachedProxyAgent: ProxyAgent | null = null;
function getProxyAgent(): Dispatcher | null {
  const url =
    process.env.PROXY_URL ??
    process.env.BRIGHT_DATA_PROXY_URL ??
    process.env.HTTPS_PROXY ??
    process.env.HTTP_PROXY;
  if (!url) return null;
  if (!cachedProxyAgent) {
    cachedProxyAgent = new ProxyAgent({
      uri: url,
      requestTls: { rejectUnauthorized: false },
      proxyTls: { rejectUnauthorized: true },
    });
  }
  return cachedProxyAgent;
}

/** Truncated-normal jitter, centered on `meanMs`, σ ≈ 30% of mean, clamped to [0.5×, 2×]. */
function jitter(meanMs: number): number {
  // Box-Muller for one normal sample, then clamp.
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sample = meanMs + z * meanMs * 0.3;
  return Math.max(meanMs * 0.5, Math.min(meanMs * 2, sample));
}

interface FetchOptions extends RequestInit {
  /** Min ms to wait after the previous request to this host */
  rateLimitMs?: number;
  /** Set true to route through the residential proxy (yellow-zone scrapers MUST set this). */
  useProxy?: boolean;
  /** Override of the proxy URL (defaults to BRIGHT_DATA_PROXY_URL env). */
  proxyUrl?: string;
  /** Number of retries on transient failure */
  maxRetries?: number;
  /** Total timeout for one attempt */
  timeoutMs?: number;
  /** Set true for yellow-zone calls: rotates UA fingerprint per request. */
  rotateFingerprint?: boolean;
}

// Per-host queue: tracks the next allowed request time so we never burst
// against a single county's site.
const nextAllowedAt = new Map<string, number>();

function getHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function waitForSlot(host: string, rateLimitMs: number, jittered: boolean): Promise<void> {
  const wait = jittered ? jitter(rateLimitMs) : rateLimitMs;
  const earliest = nextAllowedAt.get(host) ?? 0;
  const now = Date.now();
  if (now < earliest) {
    await new Promise((r) => setTimeout(r, earliest - now));
  }
  nextAllowedAt.set(host, Math.max(now, earliest) + wait);
}

export async function politeFetch(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const {
    rateLimitMs = 1500,
    maxRetries = 3,
    timeoutMs = 20_000,
    headers: incomingHeaders,
    useProxy = false,
    rotateFingerprint = false,
    proxyUrl,
    ...rest
  } = opts;

  const host = getHost(url);
  // Yellow-zone calls (useProxy or rotateFingerprint) get jittered pacing.
  await waitForSlot(host, rateLimitMs, useProxy || rotateFingerprint);

  // Compose headers — UA fingerprint depends on zone.
  const headers = new Headers(incomingHeaders);
  if (!headers.has("user-agent")) {
    headers.set(
      "user-agent",
      rotateFingerprint
        ? CHROME_UA_POOL[Math.floor(Math.random() * CHROME_UA_POOL.length)]
        : POLITE_USER_AGENT,
    );
  }
  if (!headers.has("accept-language"))
    headers.set("accept-language", "en-US,en;q=0.9");

  // Resolve dispatcher: opt-in proxy via undici ProxyAgent.
  let dispatcher: Dispatcher | undefined;
  if (useProxy) {
    if (proxyUrl) {
      dispatcher = new ProxyAgent(proxyUrl);
    } else {
      const agent = getProxyAgent();
      if (agent) dispatcher = agent;
      else if (process.env.NODE_ENV === "production") {
        throw new Error(
          "useProxy=true but no proxy is configured. Set PROXY_URL (or BRIGHT_DATA_PROXY_URL / HTTPS_PROXY as fallbacks). Yellow-zone fetches require residential proxy in production.",
        );
      }
      // In dev with no proxy configured we fall through to direct fetch — useful for offline testing.
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Undici ProxyAgent must be passed via the `dispatcher` option, which
      // isn't on the standard fetch RequestInit type — cast through unknown.
      const res = await fetch(url, {
        ...rest,
        headers,
        signal: controller.signal,
        ...(dispatcher ? ({ dispatcher } as unknown as RequestInit) : {}),
      });
      clearTimeout(timer);

      if (TRANSIENT_STATUSES.has(res.status) && attempt < maxRetries) {
        const backoff = jitter(Math.min(2 ** attempt * 1000, 16_000));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxRetries) {
        const backoff = jitter(Math.min(2 ** attempt * 1000, 16_000));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }
  }
  throw lastError ?? new Error(`fetch failed after ${maxRetries} retries: ${url}`);
}

/** Convenience: fetch and return text body, throwing on non-2xx. */
export async function fetchText(
  url: string,
  opts: FetchOptions = {},
): Promise<string> {
  const res = await politeFetch(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

/** Convenience: fetch and parse JSON body, throwing on non-2xx. */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await politeFetch(url, opts);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}
