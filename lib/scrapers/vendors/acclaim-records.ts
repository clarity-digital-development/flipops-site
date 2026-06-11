import type { Page } from "playwright-chromium";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { parseSetCookieHeaders } from "../base/cookie-fetch";
import { PlaywrightSession } from "../base/playwright-session";

// ---------------------------------------------------------------------------
// Acclaim / AcclaimWeb official-records FAMILY adapter — M2.1a (Family A per
// .gstack/qa-reports/CIVITEK-BUILD-SPEC.md).
//
// Generalizes the prod-verified Duval pattern (lib/scrapers/vendors/
// duval-clerk.ts) into a config-driven, Playwright-FREE cookie+XHR client.
// Live-verified 2026-06-10 against BOTH counties from direct egress:
//
//   1. GET  {base}/Search/SearchTypeDocType        → 302 to Disclaimer; the
//      302 hop carries ASP.NET_SessionId (+ __cf_bm / ns_bc on hosted
//      Broward) — so redirects are followed MANUALLY with a cookie jar.
//   2. POST {base}/Search/Disclaimer?st={path}     body `disclaimer=true`
//      → 302 back to the search page (session disclaimer flag set).
//   3. GET  search page → parse the DocTypes combobox init JSON
//      (`{"Text":"MORTGAGE (MTG)","Value":"110"}`) and select the doc-type
//      IDs matching our distress families at RUNTIME — IDs are per-county
//      DB keys and not config-stable.
//   4. POST {base}/Search/SearchTypeDocType?Length=6 with
//      DocTypes=<ids>, RecordDateFrom/To (M/D/YYYY). Criteria are stored
//      server-side in the session. Broward carries a hidden reCAPTCHA v3
//      `captcha` field — the server accepts it EMPTY (verified live).
//   5. POST {base}/Search/GridResults?Length=6 with the UNION of old-Telerik
//      (page,size,orderBy,groupBy,filter) and Kendo-aspnetmvc
//      (page,pageSize,sort,group) paging params — both render modes accept
//      the superset (verified live on both counties). Envelope is
//      {data,total} on hosted Broward (Telerik 2012) and {Data,Total} on
//      self-host Duval (newer Kendo) — parser handles both.
//
// Egress (per-county, empirical — CIVITEK spec §5):
//   - Duval  or.duvalclerk.com: DIRECT. The "filters non-stealth Playwright
//     to 0 rows" landmine applies to the BROWSER path only — plain HTTP
//     cookie+XHR with a Chrome UA returns full JSON (verified 2026-06-10).
//   - Broward officialrecords.broward.org: DIRECT (Cloudflare __cf_bm minted
//     on the splash hop and replayed; not interactive at landing).
//   One fixed Chrome UA per session — __cf_bm is UA-bound, so per-request
//   rotation would invalidate the Cloudflare cookie.
//
// Persistence → Mortgage + Lien (NO schema changes):
//   - mortgage family   → Mortgage (borrower=DirectName, lender=IndirectName)
//   - assignment family → Mortgage (mortgageType keeps the ASSIGNMENT label;
//     lenderName=assignee=IndirectName; borrowerName=null — an assignment
//     transfers a loan between lenders, there is no borrower party)
//   - lis_pendens / judgment / lien families → Lien
//     (plaintiff=DirectName=claimant, defendant=IndirectName=owner, per the
//     spec §4 field map)
//   - satisfaction family → NOT persisted as rows; applied as releases
//     (releasedAt/releaseDocNum) onto the unique matching open Mortgage or
//     Lien by exact party-name match. Ambiguous matches are skipped.
//   - upsert on @@unique([countyFips, documentNumber, source]) with the
//     STABLE source "scraper:acclaim-ori" so re-runs update, never dup.
//
// APN join (spec §4 strategy): bulk date sweeps return rows mostly without
// parcel IDs. Two-tier join, conservative writes only:
//   - direct  (confidence 1.0): row.ParcelNumber normalized per county and
//     verified to exist in Parcel(countyFips, apn).
//   - unique-name (confidence 0.85): owner-side party name compressed
//     ([^A-Z0-9] stripped) matches exactly ONE distinct Parcel.ownerName in
//     the county. >1 distinct parcel = ambiguous = no write.
//   Mortgage/Lien carry no metadata/notes column, so per-row confidence is
//   persisted in the bronze captureRaw payload (`apnJoins`), and the DB apn
//   is only written at confidence >= 0.85 (i.e. the two tiers above).
// ---------------------------------------------------------------------------

const SOURCE = "scraper:acclaim-ori";
const PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 60; // 60 × 500 = 30k rows per (county, window) cap

export interface AcclaimCountyConfig {
  countyFips: string;
  county: string;
  /** App base URL, no trailing slash. Hosted builds include the /AcclaimWeb path. */
  baseUrl: string;
  /** Per-county empirical egress (spec §5). Both verified DIRECT 2026-06-10. */
  useProxy: boolean;
  /**
   * Network transport (per-county quirk):
   *  - "http"    : undici cookie+XHR via politeFetch. Cheapest; verified on
   *                self-host Duval (no Cloudflare).
   *  - "browser" : stealth-chromium + in-page fetch. REQUIRED for hosts whose
   *                Cloudflare edge JA3-blocks Node undici (verified: Broward
   *                officialrecords.broward.org 403s undici GET+POST even with
   *                __cf_bm replayed, but a real browser passes). The browser's
   *                TLS + same-origin cookies satisfy Cloudflare; we still hit
   *                the exact same /Search/* JSON endpoints via in-page fetch.
   */
  transport: "http" | "browser";
  /** Broward's search form carries a hidden reCAPTCHA v3 field; send it empty. */
  sendCaptchaField: boolean;
  /** Normalize a portal ParcelNumber into candidate Parcel.apn values. */
  apnCandidates: (raw: string) => string[];
  notes: string;
}

/** Strip non-alphanumerics + uppercase (matches broward-tax-delinquent-csv). */
function normAlnum(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export const ACCLAIM_COUNTIES: AcclaimCountyConfig[] = [
  {
    countyFips: "12031",
    county: "Duval",
    baseUrl: "https://or.duvalclerk.com",
    useProxy: false, // direct verified 2026-06-10 (HTTP path; no stealth-chromium needed)
    transport: "http",
    sendCaptchaField: false,
    // Duval RE# "160677-6310" → DOR Parcel.apn "1606776310R" (R suffix on roll).
    apnCandidates: (raw) => {
      const n = normAlnum(raw);
      return n.endsWith("R") ? [n] : [n, `${n}R`];
    },
    notes: "Self-host Acclaim (Azure ARR). Kendo render: {Data,Total}.",
  },
  {
    countyFips: "12011",
    county: "Broward",
    baseUrl: "https://officialrecords.broward.org/AcclaimWeb",
    // Cloudflare blocks BOTH Node undici (403, JA3) AND direct chromium
    // (ERR_TIMED_OUT — datacenter-IP ClientHello dropped). Verified working
    // 2026-06-10: stealth-chromium + DataImpulse RESIDENTIAL proxy → 200.
    // So Broward = browser transport over residential proxy (the only combo
    // that passes); applies on Railway datacenter egress too.
    useProxy: true,
    transport: "browser",
    sendCaptchaField: true, // reCAPTCHA v3 hidden field — server accepts empty
    // BCPA folio "474126-00-7000" → "474126007000" (12 alnum; condos have letters).
    apnCandidates: (raw) => [normAlnum(raw)],
    notes: "Hosted Acclaim (Cloudflare + NetScaler). Telerik 2012 render: {data,total}.",
  },
  // -------------------------------------------------------------------------
  // M2.1 COUNTY EXPANSION (Lane C4) — small-county + mid-size tail on the
  // already-built Acclaim family. Each row below was live-fingerprinted
  // 2026-06-11 by its 302 → /search/Disclaimer?st=… disclaimer-flow signature
  // (the exact Acclaim handshake) and ASP.NET_SessionId + Kendo doc-type
  // combobox. APN candidates use normAlnum (strip non-alnum + uppercase) —
  // verified safe against the live DOR Parcel.apn formats for each county
  // (which carry spaces/dashes/letter-suffixes that the strip collapses).
  // -------------------------------------------------------------------------
  {
    countyFips: "12009",
    county: "Brevard",
    baseUrl: "https://vaclmweb1.brevardclerk.us/AcclaimWeb",
    // Plain ASP.NET (X-Powered-By: ASP.NET), NO CDN/Cloudflare. Direct egress
    // answered 200 + minted ASP.NET_SessionId on the splash GET (2026-06-11).
    useProxy: false,
    transport: "http",
    sendCaptchaField: false,
    // Brevard PIN e.g. "24 3522-26-*-29" (spaces/dashes/literal *) → strip to alnum.
    apnCandidates: (raw) => [normAlnum(raw)],
    notes: "Self-host Acclaim (/AcclaimWeb path). No CDN; cheap http cookie+XHR.",
  },
  {
    countyFips: "12113",
    county: "Santa Rosa",
    baseUrl: "https://acclaim.srccol.com/AcclaimWeb",
    // Plain ASP.NET, NO CDN. Direct GET 200 + ASP.NET_SessionId (2026-06-11).
    useProxy: false,
    transport: "http",
    sendCaptchaField: false,
    // SR PIN e.g. "43-1N-28-3170-00A00-0010 M" (trailing " M" condo suffix) →
    // normAlnum collapses to "431N28317000A000010M".
    apnCandidates: (raw) => [normAlnum(raw)],
    notes: "Self-host Acclaim (/AcclaimWeb path). No CDN; http cookie+XHR.",
  },
  {
    countyFips: "12103",
    county: "Pinellas",
    // Self-host build serves the Search routes at ROOT (not /AcclaimWeb): the
    // 302 lands on /search/Disclaimer?st=/Search/SearchTypeDocType, while
    // /AcclaimWeb/Search/* 302s to ViewNotFound. Base = bare origin (Duval-like).
    baseUrl: "https://officialrecords.mypinellasclerk.gov",
    // Fronted by Cloudflare. The splash GET passes (302), but the disclaimer
    // POST is JA3-blocked → HTTP 403 on the undici cookie+XHR path (verified
    // live 2026-06-11). Same wall as Broward: Cloudflare lets a plain GET
    // through but drops the Node-TLS POST. Fix is identical — browser
    // transport over residential proxy (the browser's TLS + same-origin
    // cookies satisfy Cloudflare; the __cf_bm is minted on page.goto and
    // replayed on the in-page fetch POSTs).
    useProxy: true,
    transport: "browser",
    sendCaptchaField: false, // no reCAPTCHA field on Pinellas's search form
    // Pinellas PIN e.g. "16 32 09 43259 000 3100" (space-delimited) → strip.
    apnCandidates: (raw) => [normAlnum(raw)],
    notes: "Self-host Acclaim at ROOT path; Cloudflare JA3-blocks undici POST → browser+proxy (like Broward).",
  },
];

// ---------------------------------------------------------------------------
// Doc-type families. Matched at runtime against the county's own doc-type
// list (Text labels), so per-county numeric IDs never live in config.
// Order matters — classification takes the FIRST match.
// ---------------------------------------------------------------------------

export type AcclaimDocFamily =
  | "lis_pendens"
  | "satisfaction"
  | "assignment"
  | "mortgage"
  | "judgment"
  | "lien";

const DOC_FAMILIES: Array<{
  family: AcclaimDocFamily;
  match: RegExp;
  exclude?: RegExp;
}> = [
  { family: "lis_pendens", match: /LIS\s*PENDENS/i },
  {
    family: "satisfaction",
    match: /SATISF|RELEASE/i,
    exclude: /NOTICE|PRESERVATION/i,
  },
  { family: "assignment", match: /ASSIGNMENT/i },
  {
    family: "mortgage",
    match: /MORTGAGE/i,
    exclude: /SATISF|RELEASE|ASSIGNMENT/i,
  },
  {
    family: "judgment",
    match: /JUDGMENT/i,
    // RPO = risk-protection order; DV/juvenile = privacy-sensitive non-property.
    exclude: /HIDDEN FROM WEB|DOMESTIC VIOLENCE|JUVENILE|RPO|SATISF|RELEASE/i,
  },
  {
    family: "lien",
    match: /\bLIEN\b|CLAIM OF LIEN/i,
    exclude: /HIDDEN FROM WEB|CANCEL|RELEASE|SATISF|TRANSFER LIEN|CONTEST|JUVENILE/i,
  },
];

/** Classify a doc-type label (or row DocTypeDescription) into a family. */
export function classifyAcclaimDocType(text: string): AcclaimDocFamily | null {
  for (const f of DOC_FAMILIES) {
    if (f.match.test(text) && !(f.exclude && f.exclude.test(text))) {
      return f.family;
    }
  }
  return null;
}

/** Lien sub-category, mirroring duval-clerk.ts classifyLien conventions. */
function classifyLienCategory(family: AcclaimDocFamily, docType: string): string {
  if (family === "lis_pendens") return "lis_pendens";
  if (family === "judgment") return "judgment";
  const t = docType.toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax/.test(t)) return "tax";
  if (/judgment/.test(t)) return "judgment";
  return "other";
}

// ---------------------------------------------------------------------------
// Cookie jar + manual-redirect fetch (Set-Cookie on 302 hops is load-bearing).
// ---------------------------------------------------------------------------

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

class CookieJar {
  private map = new Map<string, string>();
  absorb(headers: Headers): void {
    const { cookies } = parseSetCookieHeaders(headers);
    for (const raw of cookies) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }
  }
  header(): string {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get size(): number {
    return this.map.size;
  }
}

interface JarFetchInit {
  method?: "GET" | "POST";
  body?: string;
  xhr?: boolean;
  referer?: string;
}

async function jarFetch(
  jar: CookieJar,
  url: string,
  init: JarFetchInit,
  cfg: AcclaimCountyConfig,
): Promise<Response> {
  let current = url;
  let method = init.method ?? "GET";
  let body = init.body;
  for (let hop = 0; hop < 5; hop++) {
    const headers: Record<string, string> = {
      "User-Agent": CHROME_UA, // fixed per session — __cf_bm is UA-bound
      Accept:
        method === "GET"
          ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          : "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (jar.size > 0) headers.Cookie = jar.header();
    if (init.xhr) headers["X-Requested-With"] = "XMLHttpRequest";
    if (init.referer) headers.Referer = init.referer;
    if (method === "POST")
      headers["Content-Type"] = "application/x-www-form-urlencoded";

    const res = await politeFetch(current, {
      method,
      body: method === "POST" ? body : undefined,
      headers,
      redirect: "manual",
      useProxy: cfg.useProxy,
      rateLimitMs: 2000,
      timeoutMs: 45_000,
    });
    jar.absorb(res.headers);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.text().catch(() => {}); // drain socket
      if (!loc) return res;
      current = new URL(loc, current).toString();
      method = "GET"; // 302 after POST follows as GET
      body = undefined;
      continue;
    }
    return res;
  }
  throw new Error(`[acclaim] redirect loop (>5 hops) at ${current}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs);
}

// ---------------------------------------------------------------------------
// Transport — per-county network strategy (config-driven quirk).
//
// Both transports drive the SAME 3 Acclaim endpoints; only the TLS/cookie
// mechanics differ:
//   openSearch()    accept disclaimer → return the search-page HTML (for
//                   runtime doc-type discovery).
//   submitSearch()  POST doc-type + date-range criteria (server stores them
//                   in the session — the grid reads them back).
//   fetchGrid()     POST one GridResults page → raw JSON text.
// ---------------------------------------------------------------------------

interface AcclaimTransport {
  openSearch(): Promise<string>;
  /** Returns the search-POST response body (used to detect tiny session-stale
   *  rejections — a healthy search returns the full ~50KB results page). */
  submitSearch(body: string): Promise<string>;
  fetchGrid(body: string): Promise<string>;
  close(): Promise<void>;
}

/**
 * A healthy Acclaim search POST returns the full results page (~40-50KB). An
 * over-cap search returns a tiny `ShowError('...exceeded the maximum
 * limit...')` stub (~100 bytes, verified live 2026-06-10). Below this byte
 * threshold — or on the explicit error text — we bisect the date window.
 */
const HEALTHY_SEARCH_MIN_BYTES = 1000;
const OVER_LIMIT_RE = /ShowError\s*\(|exceeded the maximum|maximum (?:limit|number)/i;

/** undici cookie+XHR transport (self-host Duval — no Cloudflare). */
class HttpTransport implements AcclaimTransport {
  private jar = new CookieJar();
  private basePath: string;
  constructor(private cfg: AcclaimCountyConfig) {
    this.basePath = new URL(cfg.baseUrl).pathname.replace(/\/$/, "");
  }
  async openSearch(): Promise<string> {
    const splash = await jarFetch(
      this.jar,
      `${this.cfg.baseUrl}/Search/SearchTypeDocType`,
      { method: "GET" },
      this.cfg,
    );
    await splash.text().catch(() => {});
    await sleep(jitter(800));
    const afterDisclaimer = await jarFetch(
      this.jar,
      `${this.cfg.baseUrl}/Search/Disclaimer?st=${this.basePath}/Search/SearchTypeDocType`,
      { method: "POST", body: "disclaimer=true" },
      this.cfg,
    );
    const html = await afterDisclaimer.text();
    if (!afterDisclaimer.ok) {
      throw new Error(`[acclaim:${this.cfg.county}] disclaimer flow HTTP ${afterDisclaimer.status}`);
    }
    return html;
  }
  async submitSearch(body: string): Promise<string> {
    const res = await jarFetch(
      this.jar,
      `${this.cfg.baseUrl}/Search/SearchTypeDocType?Length=6`,
      { method: "POST", body, xhr: true, referer: `${this.cfg.baseUrl}/Search/SearchTypeDocType` },
      this.cfg,
    );
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`[acclaim:${this.cfg.county}] search POST HTTP ${res.status}`);
    return text;
  }
  async fetchGrid(body: string): Promise<string> {
    const res = await jarFetch(
      this.jar,
      `${this.cfg.baseUrl}/Search/GridResults?Length=6`,
      { method: "POST", body, xhr: true, referer: `${this.cfg.baseUrl}/Search/SearchTypeDocType` },
      this.cfg,
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`[acclaim:${this.cfg.county}] GridResults HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      throw new Error(`[acclaim:${this.cfg.county}] GridResults non-JSON (${ct}): ${text.slice(0, 200)}`);
    }
    return text;
  }
  async close(): Promise<void> {
    /* stateless */
  }
}

/**
 * stealth-chromium transport (hosted Broward — Cloudflare JA3-blocks undici).
 * All network goes through the browser via in-page fetch(): the browser's TLS
 * + same-origin cookie jar satisfy Cloudflare, and we hit the identical JSON
 * endpoints. page.goto(base) once primes the CF clearance cookie.
 */
class BrowserTransport implements AcclaimTransport {
  private sess: PlaywrightSession;
  private page: Page | null = null;
  private basePath: string;
  constructor(private cfg: AcclaimCountyConfig) {
    this.basePath = new URL(cfg.baseUrl).pathname.replace(/\/$/, "");
    this.sess = new PlaywrightSession({
      useProxy: cfg.useProxy,
      headless: true,
      engine: "stealth-chromium",
      navTimeoutMs: 90_000,
    });
  }
  /** In-page fetch — uses the browser's TLS + cookie jar (passes Cloudflare). */
  private async pageFetch(
    path: string,
    init: { method: "GET" | "POST"; body?: string; xhr?: boolean },
  ): Promise<{ status: number; ok: boolean; contentType: string; body: string }> {
    const page = this.page!;
    return page.evaluate(
      async (args) => {
        const headers: Record<string, string> = {};
        if (args.xhr) headers["X-Requested-With"] = "XMLHttpRequest";
        if (args.method === "POST")
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        const res = await fetch(args.url, {
          method: args.method,
          headers,
          body: args.method === "POST" ? args.body : undefined,
          credentials: "include",
        });
        const body = await res.text();
        return {
          status: res.status,
          ok: res.ok,
          contentType: res.headers.get("content-type") ?? "",
          body,
        };
      },
      { url: `${this.cfg.baseUrl}${path}`, method: init.method, body: init.body, xhr: init.xhr },
    );
  }
  async openSearch(): Promise<string> {
    // Re-open path: drop the prior page so we don't leak browser tabs.
    if (this.page) await this.page.close().catch(() => {});
    this.page = await this.sess.newPage();
    // Prime Cloudflare clearance + ASP.NET session by loading the real page.
    await this.page.goto(`${this.cfg.baseUrl}/Search/SearchTypeDocType`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await sleep(jitter(1200));
    // Accept the disclaimer by CLICKING the accept button — a real form
    // navigation. An in-page fetch POST to /Disclaimer instead trips
    // Cloudflare's "Just a moment" interstitial (403), but a genuine button
    // click clears it and lands on the search page (verified live 2026-06-10).
    // If the session already accepted the disclaimer, the button is absent and
    // goto lands directly on the search page.
    const btn = await this.page.$("#btnButton");
    if (btn) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => null),
        btn.click(),
      ]);
      await sleep(jitter(800));
    }
    // Read the search page HTML (raw server markup, incl. the doc-type
    // combobox init script) via in-page GET — works now that we're cleared.
    const searchPage = await this.pageFetch(`/Search/SearchTypeDocType`, { method: "GET" });
    if (searchPage.status >= 400) {
      throw new Error(`[acclaim:${this.cfg.county}] search-page load HTTP ${searchPage.status}`);
    }
    return searchPage.body;
  }
  async submitSearch(body: string): Promise<string> {
    const res = await this.pageFetch(`/Search/SearchTypeDocType?Length=6`, {
      method: "POST",
      body,
      xhr: true,
    });
    if (!res.ok) throw new Error(`[acclaim:${this.cfg.county}] search POST HTTP ${res.status}`);
    return res.body;
  }
  async fetchGrid(body: string): Promise<string> {
    const res = await this.pageFetch(`/Search/GridResults?Length=6`, {
      method: "POST",
      body,
      xhr: true,
    });
    if (!res.ok) throw new Error(`[acclaim:${this.cfg.county}] GridResults HTTP ${res.status}`);
    if (!res.contentType.includes("json")) {
      throw new Error(
        `[acclaim:${this.cfg.county}] GridResults non-JSON (${res.contentType}): ${res.body.slice(0, 200)}`,
      );
    }
    return res.body;
  }
  async close(): Promise<void> {
    await this.sess.close();
  }
}

function makeTransport(cfg: AcclaimCountyConfig): AcclaimTransport {
  return cfg.transport === "browser" ? new BrowserTransport(cfg) : new HttpTransport(cfg);
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/** Doc-type combobox init pairs: {"Text":"MORTGAGE (MTG)","Value":"110"} */
export function discoverDocTypes(
  html: string,
): Array<{ text: string; value: string }> {
  const out: Array<{ text: string; value: string }> = [];
  const seen = new Set<string>();
  const re = /"Text":"((?:[^"\\]|\\.)*)","Value":"(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = m[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"');
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ text, value: m[2] });
  }
  return out;
}

/** Grid row shape — union of both render modes' columns. */
export interface AcclaimGridRow {
  DirectName?: string | null;
  IndirectName?: string | null;
  RecordDate?: string | null;
  DocTypeDescription?: string | null;
  BookType?: string | null;
  BookPage?: string | null;
  InstrumentNumber?: string | null;
  Consideration?: number | null;
  ParcelNumber?: string | null;
  CaseNumber?: string | null;
  DocLegalDescription?: string | null;
}

/** Both envelope casings: hosted {data,total} / self-host {Data,Total}. */
export function parseGridEnvelope(json: unknown): {
  rows: AcclaimGridRow[];
  total: number;
} {
  const o = (json ?? {}) as Record<string, unknown>;
  const rows = (o.data ?? o.Data ?? []) as AcclaimGridRow[];
  const totalRaw = o.total ?? o.Total ?? 0;
  const total = typeof totalRaw === "number" ? totalRaw : parseInt(String(totalRaw), 10) || 0;
  return { rows: Array.isArray(rows) ? rows : [], total };
}

/** "/Date(1780490076000)/" (Telerik) or "2026/06/03" (Kendo) → Date|null. */
export function parseAcclaimDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const ms = /\/Date\((-?\d+)\)\//.exec(s);
  if (ms) {
    const d = new Date(parseInt(ms[1], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function splitBookPage(bookPage: string | null | undefined): {
  orBook: string | null;
  orPage: string | null;
} {
  if (!bookPage || !bookPage.includes("/")) return { orBook: null, orPage: null };
  const [orBook, orPage] = bookPage.split("/");
  return { orBook: orBook?.trim() || null, orPage: orPage?.trim() || null };
}

// ---------------------------------------------------------------------------
// APN join (two-tier, conservative)
// ---------------------------------------------------------------------------

type ApnJoinTier = "direct" | "unique-name" | "ambiguous" | "none";

interface ClassifiedRow {
  row: AcclaimGridRow;
  family: AcclaimDocFamily;
  recordingDate: Date;
  /** Owner-side party name for the name-join fallback (spec §4). */
  ownerName: string | null;
  apn: string | null;
  apnTier: ApnJoinTier;
}

/**
 * Resolve APNs for a batch of classified rows IN PLACE.
 * Tier 1: portal ParcelNumber verified against Parcel(countyFips, apn).
 * Tier 2: compressed owner-name → exactly ONE distinct parcel in county.
 */
async function resolveApns(
  cfg: AcclaimCountyConfig,
  rows: ClassifiedRow[],
): Promise<void> {
  // ---- Tier 1: direct ParcelNumber verification (batched IN query) ----
  const candidateMap = new Map<string, string[]>(); // rowKey-less: candidate→[]; we re-walk rows
  for (const r of rows) {
    const pn = r.row.ParcelNumber?.trim();
    if (!pn) continue;
    for (const cand of cfg.apnCandidates(pn)) {
      if (cand.length >= 6) candidateMap.set(cand, []);
    }
  }
  const verified = new Set<string>();
  const allCandidates = [...candidateMap.keys()];
  for (let i = 0; i < allCandidates.length; i += 500) {
    const chunk = allCandidates.slice(i, i + 500);
    const hits = await prisma.parcel.findMany({
      where: { countyFips: cfg.countyFips, apn: { in: chunk } },
      select: { apn: true },
    });
    for (const h of hits) verified.add(h.apn);
  }
  for (const r of rows) {
    const pn = r.row.ParcelNumber?.trim();
    if (!pn) continue;
    const hit = cfg.apnCandidates(pn).find((c) => verified.has(c));
    if (hit) {
      r.apn = hit;
      r.apnTier = "direct";
    }
  }

  // ---- Tier 2: unique compressed owner-name join ----
  const nameKeys = new Set<string>();
  for (const r of rows) {
    if (r.apn || !r.ownerName) continue;
    const key = normAlnum(r.ownerName);
    if (key.length >= 5) nameKeys.add(key); // short keys = junk matches
  }
  if (nameKeys.size === 0) return;

  // Single statement per county (a county-scoped seq scan, NOT a multi-100K
  // UPDATE — read-only and bounded, so the Railway-proxy chunking landmine
  // doesn't apply; verified ~1-2s on Broward's 750K parcels).
  const keys = [...nameKeys];
  const hits = await prisma.$queryRaw<
    Array<{ key: string; apn: string; n: number }>
  >`
    SELECT t.key, MIN(t.apn) AS apn, COUNT(DISTINCT t.apn)::int AS n
    FROM (
      SELECT regexp_replace(upper("ownerName"), '[^A-Z0-9]', '', 'g') AS key, apn
      FROM flipops."Parcel"
      WHERE "countyFips" = ${cfg.countyFips} AND "ownerName" IS NOT NULL
    ) t
    WHERE t.key = ANY(${keys})
    GROUP BY t.key`;

  const byKey = new Map(hits.map((h) => [h.key, h]));
  for (const r of rows) {
    if (r.apn || !r.ownerName) continue;
    const hit = byKey.get(normAlnum(r.ownerName));
    if (!hit) continue;
    if (hit.n === 1) {
      r.apn = hit.apn;
      r.apnTier = "unique-name";
    } else {
      r.apnTier = "ambiguous";
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistMortgage(
  cfg: AcclaimCountyConfig,
  r: ClassifiedRow,
): Promise<boolean> {
  const doc = r.row.InstrumentNumber!;
  const { orBook, orPage } = splitBookPage(r.row.BookPage);
  const isAssignment = r.family === "assignment";
  try {
    await prisma.mortgage.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: cfg.countyFips,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: cfg.countyFips,
        apn: r.apn,
        recordingDate: r.recordingDate,
        loanAmount: r.row.Consideration ?? null,
        // Assignment: Direct=assignor, Indirect=assignee — no borrower party.
        lenderName: r.row.IndirectName?.trim() || null,
        borrowerName: isAssignment ? null : r.row.DirectName?.trim() || null,
        mortgageType: r.row.DocTypeDescription ?? null,
        documentNumber: doc,
        orBook,
        orPage,
        source: SOURCE,
      },
      update: {
        loanAmount: r.row.Consideration ?? undefined,
        lenderName: r.row.IndirectName?.trim() || undefined,
        borrowerName: isAssignment ? undefined : r.row.DirectName?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[acclaim:${cfg.county}] mortgage persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

async function persistLien(
  cfg: AcclaimCountyConfig,
  r: ClassifiedRow,
): Promise<boolean> {
  const doc = r.row.InstrumentNumber!;
  const { orBook, orPage } = splitBookPage(r.row.BookPage);
  const docType = r.row.DocTypeDescription ?? "";
  try {
    await prisma.lien.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: cfg.countyFips,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: cfg.countyFips,
        apn: r.apn,
        lienCategory: classifyLienCategory(r.family, docType),
        recordingDate: r.recordingDate,
        amount: r.row.Consideration ?? null,
        plaintiffName: r.row.DirectName?.trim() || null, // claimant (spec §4)
        defendantName: r.row.IndirectName?.trim() || null, // owner (spec §4)
        lienTypeCode: docType || null,
        documentNumber: doc,
        orBook,
        orPage,
        source: SOURCE,
      },
      update: {
        amount: r.row.Consideration ?? undefined,
        plaintiffName: r.row.DirectName?.trim() || undefined,
        defendantName: r.row.IndirectName?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[acclaim:${cfg.county}] lien persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

/**
 * Apply a satisfaction/release: find the UNIQUE open Mortgage (then Lien)
 * whose owner-side name exactly matches the satisfaction's grantee
 * (Direct=releasor/lender, Indirect=borrower/owner) and was recorded before
 * the satisfaction. Ambiguous (0 or 2+) → skip; bronze keeps the raw row.
 */
async function applySatisfaction(
  cfg: AcclaimCountyConfig,
  r: ClassifiedRow,
): Promise<boolean> {
  const owner = r.row.IndirectName?.trim();
  if (!owner) return false;
  const releaseDocNum = r.row.InstrumentNumber ?? null;

  const mortgages = await prisma.mortgage.findMany({
    where: {
      countyFips: cfg.countyFips,
      releasedAt: null,
      borrowerName: { equals: owner, mode: "insensitive" },
      recordingDate: { lt: r.recordingDate },
    },
    select: { id: true },
    take: 2,
  });
  if (mortgages.length === 1) {
    await prisma.mortgage.update({
      where: { id: mortgages[0].id },
      data: { releasedAt: r.recordingDate, releaseDocNum },
    });
    return true;
  }
  if (mortgages.length > 1) return false; // ambiguous — never guess

  const liens = await prisma.lien.findMany({
    where: {
      countyFips: cfg.countyFips,
      releasedAt: null,
      defendantName: { equals: owner, mode: "insensitive" },
      recordingDate: { lt: r.recordingDate },
    },
    select: { id: true },
    take: 2,
  });
  if (liens.length === 1) {
    await prisma.lien.update({
      where: { id: liens[0].id },
      data: { releasedAt: r.recordingDate, releaseDocNum },
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main entry — one (county, date-range) sweep.
// ---------------------------------------------------------------------------

export interface AcclaimScrapeResult {
  countyFips: string;
  county: string;
  from: string;
  to: string;
  /** Index rows returned by the portal for the selected doc types. */
  found: number;
  /** Rows per doc family. */
  byFamily: Record<string, number>;
  persistedMortgages: number;
  persistedLiens: number;
  satisfactionsApplied: number;
  satisfactionsSkipped: number;
  rejected: number; // rows missing InstrumentNumber/DocType/date
  pages: number;
  requests: number;
  apnJoin: { direct: number; uniqueName: number; ambiguous: number; none: number };
  docTypeIdsSelected: number;
}

export async function scrapeAcclaimCounty(opts: {
  countyFips: string;
  /** Recording-date window, inclusive. */
  from: Date;
  to: Date;
  useProxy?: boolean;
  maxPages?: number;
}): Promise<AcclaimScrapeResult> {
  const cfg = ACCLAIM_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!cfg) {
    throw new Error(`[acclaim] county ${opts.countyFips} not in ACCLAIM_COUNTIES`);
  }
  const effective: AcclaimCountyConfig =
    opts.useProxy === undefined ? cfg : { ...cfg, useProxy: opts.useProxy };

  const fromStr = fmtDate(opts.from);
  const toStr = fmtDate(opts.to);
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const sourceTag = `scraper:acclaim-ori-${cfg.countyFips}-${opts.from.toISOString().slice(0, 10)}..${opts.to.toISOString().slice(0, 10)}`;

  const transport = makeTransport(effective);
  let requests = 0;

  const rawRows: AcclaimGridRow[] = [];
  const seenDocs = new Set<string>();
  let total = 0; // accumulates per-window grid totals across the bisected sweep
  let pages = 0;
  let selectedDocTypes: Array<{ text: string; value: string }> = [];

  try {
    // (1)+(2) accept disclaimer → search-page HTML.
    requests++;
    const searchPageHtml = await transport.openSearch();

    // (3) runtime doc-type discovery.
    const docTypes = discoverDocTypes(searchPageHtml);
    const selected = docTypes.filter((d) => classifyAcclaimDocType(d.text) !== null);
    if (selected.length === 0) {
      throw new Error(
        `[acclaim:${cfg.county}] doc-type discovery found 0 distress types (page parse drift? got ${docTypes.length} total types)`,
      );
    }
    selectedDocTypes = selected;
    await sleep(jitter(800));

    // (4)+(5) doc-type + date-range search → grid, with ADAPTIVE date-window
    // bisection. Acclaim caps a single search at ~3000 results and rejects an
    // over-cap search with `ShowError('...exceeded the maximum limit...')`
    // (verified live: Duval 6/3..6/9 = 2844 OK; 6/3..6/10 = 3244 rejected).
    // A 30-day distress sweep blows past the cap, so we split the window in
    // half on the limit error and recurse down to single days.
    const docTypeParam = selected.map((d) => d.value).join(",");
    const gridBody = (page: number): string =>
      new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE), // old-Telerik (hosted Broward)
        pageSize: String(PAGE_SIZE), // Kendo aspnetmvc (self-host Duval)
        orderBy: "",
        groupBy: "",
        sort: "",
        filter: "",
        group: "",
      }).toString();

    const absorbRows = (rows: AcclaimGridRow[]): number => {
      let added = 0;
      for (const row of rows) {
        const key = row.InstrumentNumber ?? "";
        if (key && seenDocs.has(key)) continue;
        if (key) seenDocs.add(key);
        rawRows.push(row);
        added++;
      }
      return added;
    };

    // Collect one date window; returns false if the window was over-cap and
    // should be split by the caller.
    const collectWindow = async (winFrom: Date, winTo: Date): Promise<boolean> => {
      const body = new URLSearchParams({
        DocTypes: docTypeParam,
        RecordDateFrom: fmtDate(winFrom),
        RecordDateTo: fmtDate(winTo),
        ...(effective.sendCaptchaField ? { captcha: "" } : {}),
      }).toString();
      requests++;
      const resp = await transport.submitSearch(body);
      // Over-cap rejection: tiny `ShowError(...)` stub instead of the ~50KB
      // results page. Detect by the error text OR a suspiciously tiny body.
      if (OVER_LIMIT_RE.test(resp) || resp.length < HEALTHY_SEARCH_MIN_BYTES) {
        return false;
      }
      await sleep(jitter(900));
      // Page this window's grid. `total` accumulates the per-window totals
      // (bisected windows are disjoint date ranges, so this sums to the
      // distinct count across the whole sweep).
      for (let page = 1; page <= maxPages; page++) {
        requests++;
        const { rows, total: t } = parseGridEnvelope(JSON.parse(await transport.fetchGrid(gridBody(page))));
        pages++;
        if (page === 1) total += t;
        absorbRows(rows);
        if (rows.length < PAGE_SIZE) break; // last page of this window
        await sleep(jitter(1100));
      }
      return true;
    };

    // Recursive bisection on the limit error (down to single-day granularity).
    // Work on local-midnight day boundaries so fmtDate (local) splits cleanly.
    const dayFloor = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const sweep = async (winFrom: Date, winTo: Date): Promise<void> => {
      const ok = await collectWindow(winFrom, winTo);
      if (ok) return;
      if (fmtDate(winFrom) === fmtDate(winTo)) {
        // Single day still over the cap (>~3000 distress recordings/day in one
        // county — very rare). The overflow isn't captured; log it so an
        // operator can narrow by doc-type if it ever fires.
        console.warn(
          `[acclaim:${cfg.county}] single day ${fmtDate(winFrom)} exceeds result cap; overflow not captured`,
        );
        return;
      }
      const fromD = dayFloor(winFrom);
      const toD = dayFloor(winTo);
      const midMs = fromD.getTime() + Math.floor((toD.getTime() - fromD.getTime()) / 2);
      const midDay = dayFloor(new Date(midMs));
      const nextDay = new Date(midDay.getFullYear(), midDay.getMonth(), midDay.getDate() + 1);
      await sleep(jitter(700));
      await sweep(winFrom, midDay);
      await sleep(jitter(700));
      await sweep(nextDay, winTo);
    };

    await sweep(opts.from, opts.to);
  } finally {
    await transport.close();
  }

  // Classify + reject.
  const byFamily: Record<string, number> = {};
  const classified: ClassifiedRow[] = [];
  let rejected = 0;
  for (const row of rawRows) {
    const docType = row.DocTypeDescription ?? "";
    const recordingDate = parseAcclaimDate(row.RecordDate);
    const family = classifyAcclaimDocType(docType);
    if (!row.InstrumentNumber || !docType || !recordingDate || !family) {
      rejected++;
      continue;
    }
    byFamily[family] = (byFamily[family] ?? 0) + 1;
    // Owner-side party for the name-join (spec §4): mortgage → grantor
    // (borrower owns); lien/LP/judgment → grantee (defendant owns);
    // assignment/satisfaction → no owner party in the index row.
    const ownerName =
      family === "mortgage"
        ? row.DirectName?.trim() || null
        : family === "lien" || family === "judgment" || family === "lis_pendens"
          ? row.IndirectName?.trim() || null
          : null;
    classified.push({ row, family, recordingDate, ownerName, apn: null, apnTier: "none" });
  }

  // APN join, then persist.
  const joinable = classified.filter((c) => c.family !== "satisfaction");
  await resolveApns(effective, joinable);

  const result: AcclaimScrapeResult = {
    countyFips: cfg.countyFips,
    county: cfg.county,
    from: fromStr,
    to: toStr,
    found: rawRows.length,
    byFamily,
    persistedMortgages: 0,
    persistedLiens: 0,
    satisfactionsApplied: 0,
    satisfactionsSkipped: 0,
    rejected,
    pages,
    requests,
    apnJoin: { direct: 0, uniqueName: 0, ambiguous: 0, none: 0 },
    docTypeIdsSelected: selectedDocTypes.length,
  };

  for (const c of joinable) {
    if (c.apnTier === "direct") result.apnJoin.direct++;
    else if (c.apnTier === "unique-name") result.apnJoin.uniqueName++;
    else if (c.apnTier === "ambiguous") result.apnJoin.ambiguous++;
    else result.apnJoin.none++;

    if (c.family === "mortgage" || c.family === "assignment") {
      if (await persistMortgage(effective, c)) result.persistedMortgages++;
    } else {
      if (await persistLien(effective, c)) result.persistedLiens++;
    }
  }

  // Satisfactions LAST so same-window originals are already persisted.
  for (const c of classified) {
    if (c.family !== "satisfaction") continue;
    if (await applySatisfaction(effective, c)) result.satisfactionsApplied++;
    else result.satisfactionsSkipped++;
  }

  // Bronze: full extracted payload + per-row APN join confidence (the
  // Mortgage/Lien tables have no metadata column — confidence lives here).
  void captureRaw({
    entityType: "parcel",
    source: "acclaim-ori",
    sourceTag,
    category: "clerk_recordings_bulk",
    countyFips: cfg.countyFips,
    requestParams: {
      baseUrl: cfg.baseUrl,
      from: fromStr,
      to: toStr,
      docTypeIds: selectedDocTypes.map((d) => `${d.value}:${d.text}`),
      useProxy: effective.useProxy,
    },
    rawResponse: {
      total,
      rows: rawRows,
      apnJoins: joinable.map((c) => ({
        documentNumber: c.row.InstrumentNumber,
        family: c.family,
        apn: c.apn,
        tier: c.apnTier,
        confidence: c.apnTier === "direct" ? 1.0 : c.apnTier === "unique-name" ? 0.85 : 0,
      })),
    },
    legalRisk: "yellow",
  });

  return result;
}
