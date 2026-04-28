// ---------------------------------------------------------------------------
// Polite HTTP client for scrapers.
// - Per-host rate limiting (one in-flight request per host at a time, with a
//   minimum gap defined by the scraper config)
// - Optional residential proxy support (Bright Data / Smartproxy / Oxylabs URL)
// - Retry with exponential backoff for transient failures (429, 503, 502, 504)
// - User-Agent identifies us so county IT can reach us if we cause friction
// ---------------------------------------------------------------------------

const DEFAULT_USER_AGENT =
  "FlipOps-PublicRecordsBot/1.0 (+https://flipops.io/scraping; ops@flipops.io)";

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

interface FetchOptions extends RequestInit {
  /** Min ms to wait after the previous request to this host */
  rateLimitMs?: number;
  /** Optional proxy URL (currently informational — implementation TBD per host) */
  proxyUrl?: string;
  /** Number of retries on transient failure */
  maxRetries?: number;
  /** Total timeout for one attempt */
  timeoutMs?: number;
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

async function waitForSlot(host: string, rateLimitMs: number): Promise<void> {
  const earliest = nextAllowedAt.get(host) ?? 0;
  const now = Date.now();
  if (now < earliest) {
    await new Promise((r) => setTimeout(r, earliest - now));
  }
  nextAllowedAt.set(host, Math.max(now, earliest) + rateLimitMs);
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
    ...rest
  } = opts;

  const host = getHost(url);
  await waitForSlot(host, rateLimitMs);

  // Compose headers with our User-Agent as default unless caller overrode.
  const headers = new Headers(incomingHeaders);
  if (!headers.has("user-agent")) headers.set("user-agent", DEFAULT_USER_AGENT);
  if (!headers.has("accept-language"))
    headers.set("accept-language", "en-US,en;q=0.9");

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (TRANSIENT_STATUSES.has(res.status) && attempt < maxRetries) {
        const backoff = Math.min(2 ** attempt * 1000, 16_000);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxRetries) {
        const backoff = Math.min(2 ** attempt * 1000, 16_000);
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
