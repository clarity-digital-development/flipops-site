import { chromium as vanillaChromium, type Browser, type Page, type BrowserContext } from "playwright-chromium";
import { chromium as stealthChromium, firefox as stealthFirefox } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Register stealth on both engines lazily (idempotent).
let stealthRegistered = false;
function ensureStealthRegistered() {
  if (stealthRegistered) return;
  stealthChromium.use(StealthPlugin());
  stealthFirefox.use(StealthPlugin());
  stealthRegistered = true;
}

// ---------------------------------------------------------------------------
// PlaywrightSession — real-browser scraping with optional Bright Data proxy.
//
// Why this exists (when ClerkSession + direct HTTP isn't enough):
//   ASP.NET MVC AsyncForm + Kendo grid clerks (Acclaim, Granicus, custom)
//   load search results via JS-driven AJAX with multi-step request chains
//   that are county-specific and brittle to reverse-engineer. Playwright
//   just IS a browser — the JS executes naturally, AJAX results render
//   into the DOM, we read the DOM.
//
// Trade-offs vs ClerkSession:
//   + Handles arbitrary JS/AJAX flows out-of-the-box
//   + Real fingerprint (Chromium itself)
//   + Easy form-driving (fill, click, waitForResponse)
//   - ~300-500ms per page (vs 50-100ms for direct fetch)
//   - Per-page memory cost (~50-100MB browser process)
//   - Heavier dependency
//
// Use Playwright for: complex clerk search forms, login-walled auction
// sites where we need to drive a UI to capture cookies, anything that
// breaks direct-HTTP because of JS execution dependencies.
//
// Use ClerkSession for: simple cookie-walled pages, direct POST flows
// where the AJAX endpoint is known and the auth model is just a cookie.
//
// BD proxy integration: Chromium accepts proxy via the launch option.
// The TLS posture differs from undici — chromium handles cert validation
// via its own bundled CA + chrome's logic. For BD MITM we use the
// --ignore-certificate-errors-spki-list or ignoreHTTPSErrors at the
// context level, scoped to this single browser context.
// ---------------------------------------------------------------------------

export interface PlaywrightSessionOptions {
  /** Route all browser traffic through the residential proxy (env-resolved:
   *  PROXY_URL → BRIGHT_DATA_PROXY_URL → HTTPS_PROXY).
   *  false explicitly DISABLES Chromium proxy via direct:// override
   *  (otherwise env HTTPS_PROXY/HTTP_PROXY would leak in). */
  useProxy?: boolean;
  /** Headless (true) or headful for debugging. Default true. */
  headless?: boolean;
  /** Per-page navigation timeout in ms. Default 30s. */
  navTimeoutMs?: number;
  /**
   * Engine selection. "chromium" (default) is fastest. "stealth-chromium"
   * patches automation tells (navigator.webdriver, plugin spoofing, WebGL
   * fingerprint, etc.) and DEFEATS clerk bot detection — required for sites
   * like or.duvalclerk.com that return empty results to vanilla Playwright.
   * "stealth-firefox" is a fallback when stealth Chromium gets blocked.
   */
  engine?: "chromium" | "stealth-chromium" | "stealth-firefox";
}

export class PlaywrightSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private opts: PlaywrightSessionOptions = {}) {}

  /** Lazily launch the browser; reused across pages within the session. */
  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    const launchOpts: Parameters<typeof vanillaChromium.launch>[0] = {
      headless: this.opts.headless !== false,
    };

    if (this.opts.useProxy) {
      // Provider-agnostic precedence: PROXY_URL → BRIGHT_DATA_PROXY_URL →
      // HTTPS_PROXY. Mirrors lib/scrapers/base/http-client.ts so a single
      // env-var change rotates BOTH fetch-path and Playwright-path scrapers.
      const url =
        process.env.PROXY_URL ??
        process.env.BRIGHT_DATA_PROXY_URL ??
        process.env.HTTPS_PROXY;
      if (!url) throw new Error("PlaywrightSession: useProxy=true but no proxy is configured (set PROXY_URL, BRIGHT_DATA_PROXY_URL, or HTTPS_PROXY)");
      const parsed = new URL(url);
      launchOpts.proxy = {
        server: `${parsed.protocol}//${parsed.host}`,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      };
    } else if (this.opts.useProxy === false) {
      // Explicit opt-out: force Chromium to bypass the OS-level HTTPS_PROXY/
      // HTTP_PROXY env vars. Without this, Chromium auto-discovers those env
      // vars and tunnels through whatever proxy the container has set, even
      // when our code intent is "go direct." 'direct://' is the documented
      // Playwright bypass (see playwright.dev BrowserType.launch proxy option).
      launchOpts.proxy = { server: "direct://" };
    }

    const engine = this.opts.engine ?? "chromium";
    if (engine === "stealth-chromium") {
      ensureStealthRegistered();
      this.browser = await stealthChromium.launch(launchOpts) as unknown as Browser;
    } else if (engine === "stealth-firefox") {
      ensureStealthRegistered();
      this.browser = await stealthFirefox.launch(launchOpts) as unknown as Browser;
    } else {
      this.browser = await vanillaChromium.launch(launchOpts);
    }
    return this.browser;
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const browser = await this.ensureBrowser();
    this.context = await browser.newContext({
      // BD's Web Unlocker MITMs HTTPS — same posture as our undici client.
      ignoreHTTPSErrors: this.opts.useProxy === true,
      viewport: { width: 1366, height: 768 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    return this.context;
  }

  async newPage(): Promise<Page> {
    const ctx = await this.ensureContext();
    const page = await ctx.newPage();
    if (this.opts.navTimeoutMs) page.setDefaultNavigationTimeout(this.opts.navTimeoutMs);
    return page;
  }

  /** Dump current cookies as JSON for save/restore patterns. */
  async cookies(): Promise<string> {
    const ctx = await this.ensureContext();
    return JSON.stringify(await ctx.cookies(), null, 2);
  }

  /** Restore cookies from a JSON dump (for "log in once, reuse session" workflows). */
  async restoreCookies(json: string): Promise<void> {
    const ctx = await this.ensureContext();
    const cookies = JSON.parse(json);
    await ctx.addCookies(cookies);
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
  }
}
