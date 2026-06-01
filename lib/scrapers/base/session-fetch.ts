import { CookieJar } from "tough-cookie";
import { ProxyAgent, type Dispatcher } from "undici";

// ---------------------------------------------------------------------------
// Session-aware fetch wrapper. Handles the cookie-jar plumbing that vanilla
// `fetch` doesn't do — required for ASP.NET WebForms / disclaimer-gated clerk
// sites that track session state via cookies between requests.
//
// Uses the BD Web Unlocker proxy (via the same env var as http-client.ts)
// when constructed with `useProxy: true`. The TLS posture is identical:
// strict to BD's edge, relaxed only on the target branch BD MITMs by design.
//
// Architecture rationale: Firecrawl's `actions` chain works for static or
// simple pages but doesn't reliably preserve cookies between actions for
// ASP.NET WebForms apps that use session+ViewState validation. Direct HTTP
// with proper cookie management is more reliable AND substantially cheaper.
// ---------------------------------------------------------------------------

const CHROME_UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

export interface SessionFetchOptions {
  /** Route through the residential proxy (env-resolved: PROXY_URL →
   *  BRIGHT_DATA_PROXY_URL → HTTPS_PROXY). Yellow-zone calls. */
  useProxy?: boolean;
  /** Pick a real-browser fingerprint per session. Defaults to true. */
  rotateFingerprint?: boolean;
  /** Per-request timeout (ms). Default 30s. */
  timeoutMs?: number;
}

export class ClerkSession {
  private jar = new CookieJar();
  private dispatcher: Dispatcher | undefined;
  private ua: string;
  private timeoutMs: number;

  constructor(private opts: SessionFetchOptions = {}) {
    this.ua = opts.rotateFingerprint !== false
      ? CHROME_UA_POOL[Math.floor(Math.random() * CHROME_UA_POOL.length)]
      : CHROME_UA_POOL[0];
    this.timeoutMs = opts.timeoutMs ?? 30_000;

    if (opts.useProxy) {
      // Provider-agnostic precedence: PROXY_URL → BRIGHT_DATA_PROXY_URL →
      // HTTPS_PROXY. Mirrors lib/scrapers/base/http-client.ts so a single
      // env-var change rotates EVERY proxy code path in lock-step.
      const url =
        process.env.PROXY_URL ??
        process.env.BRIGHT_DATA_PROXY_URL ??
        process.env.HTTPS_PROXY;
      if (!url) throw new Error("ClerkSession: useProxy=true but no proxy is configured (set PROXY_URL, BRIGHT_DATA_PROXY_URL, or HTTPS_PROXY)");
      // TLS posture identical to http-client.ts (security-reviewed):
      //   proxyTls (us → brd.superproxy.io) → STRICT — BD has a valid public
      //     cert; any MITM here indicates a real on-path attacker and MUST
      //     fail. This is where our Proxy-Authorization header transits.
      //   requestTls (BD → target, tunnel's TLS) → relaxed because BD's
      //     Web Unlocker intentionally MITMs the target connection to inject
      //     JS rendering + captcha solving + fingerprint emulation. The cert
      //     we see here is BD's MITM cert, not the target's; verification
      //     against the target's CA chain cannot succeed by design. TODO:
      //     pin BD's MITM CA in requestTls.ca for full strict TLS.
      this.dispatcher = new ProxyAgent({
        uri: url,
        requestTls: { rejectUnauthorized: false },
        proxyTls: { rejectUnauthorized: true },
      });
    }
  }

  /** GET request with session-managed cookies. */
  async get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; html: string; finalUrl: string }> {
    return this.request("GET", url, undefined, headers);
  }

  /**
   * POST a form. `body` is form-data; will be URL-encoded with
   * application/x-www-form-urlencoded as ASP.NET WebForms expects.
   */
  async postForm(url: string, body: Record<string, string>, extraHeaders: Record<string, string> = {}): Promise<{ status: number; html: string; finalUrl: string }> {
    const formBody = new URLSearchParams(body).toString();
    return this.request("POST", url, formBody, {
      "Content-Type": "application/x-www-form-urlencoded",
      ...extraHeaders,
    });
  }

  private async request(
    method: "GET" | "POST",
    url: string,
    body: string | undefined,
    extraHeaders: Record<string, string>,
  ): Promise<{ status: number; html: string; finalUrl: string }> {
    const cookieHeader = await this.jar.getCookieString(url);
    const headers: Record<string, string> = {
      "User-Agent": this.ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...extraHeaders,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        redirect: "manual", // we'll follow manually to capture Set-Cookie from redirects
        signal: controller.signal,
        ...(this.dispatcher ? ({ dispatcher: this.dispatcher } as unknown as RequestInit) : {}),
      });

      // Capture any Set-Cookie headers
      const setCookies = res.headers.getSetCookie?.() ?? [];
      for (const c of setCookies) {
        await this.jar.setCookie(c, url).catch(() => { /* tolerate parse errors */ });
      }

      // Follow redirects manually (max 5) so we can stash cookies at each hop
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc) {
          const next = new URL(loc, url).toString();
          return this.request("GET", next, undefined, {});
        }
      }

      const html = await res.text();
      return { status: res.status, html, finalUrl: url };
    } finally {
      clearTimeout(timer);
    }
  }

  /** For debugging — dump current cookie set. */
  async dumpCookies(url: string): Promise<string> {
    return this.jar.getCookieString(url);
  }
}
