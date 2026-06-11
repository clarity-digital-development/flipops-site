import type { Page } from "playwright-chromium";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { parseSetCookieHeaders } from "../base/cookie-fetch";
import { PlaywrightSession } from "../base/playwright-session";

// ---------------------------------------------------------------------------
// Miami-Dade Official-Records adapter — M2.1d (Family D "Custom metro portal"
// per .gstack/qa-reports/CIVITEK-BUILD-SPEC.md §1).
//
// ⚠ SPEC CORRECTION (verified live 2026-06-11): the build spec describes
// `StandardSearch.aspx` as "custom IIS/ASP.NET WebForms (__VIEWSTATE/
// __EVENTVALIDATION)". THAT IS NO LONGER TRUE. The portal was rebuilt as a
// Vite-bundled REACT SPA (bundle index-DKMOHwuw.js) served from
// onlineservices.miamidadeclerk.gov/officialrecords/. `StandardSearch.aspx` is
// now a STATIC redirect stub (Last-Modified 2025-08; the probe-miamidade.html
// fixture IS that stub) — there is NO __VIEWSTATE/__EVENTVALIDATION flow. Data
// is served by a JSON API at /officialrecords/api/*. Still: HTTP 200, IIS 10,
// Citrix NetScaler NSC_* cookies, no Cloudflare — direct curl egress works.
//
// LIVE-CHARACTERIZED API FLOW (2026-06-11):
//   1. GET  /officialrecords/                          → SPA shell; mints
//      NetScaler NSC_ESNS + NSC_JO* session cookies (Set-Cookie).
//   2. GET  /officialrecords/api/home/documentTypes    → JSON string array
//      ["MORTGAGE - MOR","LIEN - LIE",...] (label - CODE). Doc-type CODES are
//      stable strings, not per-county DB ids (unlike Acclaim).
//   3. GET  /officialrecords/api/home/GetDate          → server "today".
//   4. POST /officialrecords/api/home/standardsearch
//        ?partyName=&dateRangeFrom=MM/DD/YYYY&dateRangeTo=MM/DD/YYYY
//        &documentType=<CODE>&searchT=<CODE>&firstQuery=true&searchtype=standard
//      header `x-recaptcha-token: <reCAPTCHA v3 token>` (sitekey
//      6LfI8ikaAAAAAH0qlQMApskMGd1U6EqDyniH5t0x, action "submit"). Empty body
//      but Content-Length REQUIRED (IIS 411 otherwise). Returns
//      {isValidSearch, qs}. A MISSING/INVALID token returns
//      {isValidSearch:false, qs:null} — the token is the load-bearing gate.
//   5. GET  /officialrecords/api/SearchResults/getStandardRecords?qs=<qs>
//      → the result records JSON (one row per recording: cfn, folio, book,
//      page, bookType, recordDate, documentType, firstParty, secondParty,
//      legal, consideration). NO per-document image fetch needed.
//
// reCAPTCHA v3 BLOCKER (the wall — same class as the Landmark family):
//   standardsearch validates `x-recaptcha-token` server-side. We cannot forge
//   it; it must come from a real grecaptcha.execute() in a loaded page (browser
//   path) or an external solver/injection (token path). The adapter supports
//   BOTH and persists the moment a valid token yields a `qs`.
//
// EGRESS (empirical, this dev machine, 2026-06-11 — per OPS-6 §5):
//   - curl DIRECT          : 200 on all GETs + the search POST handshake.
//   - headless chromium DIRECT (vanilla AND stealth): ERR_TIMED_OUT — the
//     NetScaler edge drops the headless-Chromium TLS ClientHello from
//     datacenter egress (identical fingerprint to the Acclaim-Broward landmine).
//   - DataImpulse residential proxy (curl OR chromium): host UNREACHABLE
//     (curl http=000 / chromium ERR_TUNNEL_CONNECTION_FAILED) — NetScaler
//     blocks the proxy pool outright.
//   ⇒ From this dev egress NO combo mints a token (browser can't load the SPA
//     to run grecaptcha; curl can load it but can't run JS). Railway egress is
//     a DIFFERENT IP class and MAY load the SPA in chromium — the browser path
//     is wired and ready to verify there. Until a token source exists the
//     handshake is proven complete (correct endpoint/params/cookies; only the
//     token gates it) but 0 rows persist.
//
// Persistence → Mortgage + Lien (NO schema changes; mirrors acclaim-records.ts):
//   - mortgage family   → Mortgage (borrower=firstParty, lender=secondParty)
//   - assignment family → Mortgage (no borrower; lender=assignee=secondParty)
//   - lis_pendens / judgment / lien families → Lien
//     (plaintiff=firstParty=claimant, defendant=secondParty=owner)
//   - satisfaction family → applied as releases onto the unique matching open
//     Mortgage/Lien by exact owner-name match; ambiguous → skipped.
//   - upsert on @@unique([countyFips, documentNumber, source]) with stable
//     source "scraper:miamidade-ori" so re-runs update, never dup.
//
// APN/FOLIO join (the EASY part for Miami-Dade): the result row carries `folio`
// directly. Miami-Dade folio = 13 digits, no dashes (verified vs 933,532
// Parcel(12086) rows, e.g. "0101050801070"). Parcel.apn IS the 13-digit folio
// → DIRECT exact join, confidence 1.0. Name-join is the conservative fallback
// only when folio is absent. Mortgage/Lien have no metadata column, so per-row
// match confidence is persisted in the bronze captureRaw payload (`apnJoins`).
// ---------------------------------------------------------------------------

const SOURCE = "scraper:miamidade-ori";
const COUNTY_FIPS = "12086";
const COUNTY = "Miami-Dade";
const ORIGIN = "https://onlineservices.miamidadeclerk.gov";
const BASE = `${ORIGIN}/officialrecords`;
export const MIAMIDADE_RECAPTCHA_SITEKEY = "6LfI8ikaAAAAAH0qlQMApskMGd1U6EqDyniH5t0x";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Doc-type families. Miami-Dade emits stable string CODES (from
// /api/home/documentTypes). Order matters — classification takes FIRST match.
// ---------------------------------------------------------------------------

export type MdDocFamily =
  | "lis_pendens"
  | "satisfaction"
  | "assignment"
  | "mortgage"
  | "judgment"
  | "lien";

interface MdDocType {
  family: MdDocFamily;
  /** Portal documentType CODE(s) to search (suffix after " - " in documentTypes). */
  codes: string[];
}

// Codes verified live in /api/home/documentTypes 2026-06-11.
//   MOR=Mortgage, AMO=Assignment of Mortgage, ASG=Assignment, LIS=Lis Pendens,
//   CLP=Cancellation of Lis Pendens, LIE=Lien, LNJUD=Any Lien Judgment,
//   FTL=Federal Tax Lien, NTL=Notice of Tax Lien, JUD=Judgement,
//   SMO=Satisfaction of Mortgage, SJU=Satisfaction of Judgment, REL=Release.
export const MD_DOC_TYPES: MdDocType[] = [
  { family: "lis_pendens", codes: ["LIS"] },
  { family: "satisfaction", codes: ["SMO", "SJU", "REL"] },
  { family: "assignment", codes: ["AMO", "ASG"] },
  { family: "mortgage", codes: ["MOR"] },
  { family: "judgment", codes: ["JUD", "LNJUD"] },
  { family: "lien", codes: ["LIE", "FTL", "NTL"] },
];

/** Map a portal documentType CODE (or label) back to a family. */
export function classifyMdDocType(codeOrLabel: string): MdDocFamily | null {
  const upper = (codeOrLabel || "").toUpperCase();
  // Exact code match first (result rows carry the code or "LABEL - CODE").
  const codeMatch = upper.match(/-\s*([A-Z]{2,6})\s*$/);
  const code = codeMatch ? codeMatch[1] : upper.trim();
  for (const dt of MD_DOC_TYPES) {
    if (dt.codes.includes(code)) return dt.family;
  }
  // Label fallback for result rows that spell the type out.
  if (/LIS\s*PENDENS/i.test(upper)) return upper.includes("CANCEL") ? null : "lis_pendens";
  if (/SATISFACTION|RELEASE/i.test(upper)) return "satisfaction";
  if (/ASSIGNMENT/i.test(upper)) return "assignment";
  if (/MORTGAGE/i.test(upper)) return "mortgage";
  if (/JUDG/i.test(upper)) return "judgment";
  if (/\bLIEN\b/i.test(upper)) return "lien";
  return null;
}

function classifyLienCategory(family: MdDocFamily, docType: string): string {
  if (family === "lis_pendens") return "lis_pendens";
  if (family === "judgment") return "judgment";
  const t = docType.toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax|ftl|ntl/.test(t)) return "tax";
  if (/judg/.test(t)) return "judgment";
  return "other";
}

// ---------------------------------------------------------------------------
// Cookie jar + manual-redirect fetch (NetScaler Set-Cookie is load-bearing).
// ---------------------------------------------------------------------------

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

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs);
}
function fmtDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

/** A folio is 13 digits no-dashes; strip everything non-numeric. */
function normFolio(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.replace(/\D/g, "");
  return n.length >= 10 ? n : null;
}

function normAlnum(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// ---------------------------------------------------------------------------
// Transport — drives the SAME 3 API endpoints two ways:
//   - "http"    : curl-equivalent undici via politeFetch. Works DIRECT for the
//                 handshake but cannot run grecaptcha → needs an injected token
//                 (recaptchaToken / solveRecaptcha hook).
//   - "browser" : stealth-chromium loads the SPA and mints a v3 token in-page
//                 via grecaptcha.execute, then drives the API via in-page fetch
//                 (the browser TLS + cookies satisfy NetScaler). The path that
//                 yields rows with NO external solver — IF the egress can load
//                 the SPA (Railway egress is the place to verify).
// ---------------------------------------------------------------------------

export interface MdTokenSource {
  /** A pre-minted reCAPTCHA v3 token (one-shot — tokens expire ~2 min). */
  recaptchaToken?: string;
  /** Async solver: (sitekey, pageUrl) => token. e.g. 2captcha/anti-captcha. */
  solveRecaptcha?: (sitekey: string, pageUrl: string) => Promise<string>;
}

interface MdTransport {
  /** Mint session cookies + return the doc-types list (label - CODE strings). */
  init(): Promise<string[]>;
  /** Run one standardsearch → returns the `qs` token, or null if gated/empty. */
  search(params: {
    documentType: string;
    from: string;
    to: string;
  }): Promise<{ qs: string | null; status: number; raw: string }>;
  /** Fetch the records grid for a qs. */
  records(qs: string): Promise<{ rows: MdGridRow[]; status: number; raw: string }>;
  close(): Promise<void>;
}

/** undici (curl-equivalent) transport — DIRECT egress; needs injected token. */
class HttpTransport implements MdTransport {
  private jar = new CookieJar();
  private token: string | null = null;
  constructor(
    private useProxy: boolean,
    private tokenSource: MdTokenSource,
  ) {}

  private async raw(
    url: string,
    init: { method: "GET" | "POST"; token?: string },
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "User-Agent": CHROME_UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: `${BASE}/`,
    };
    if (this.jar.size > 0) headers.Cookie = this.jar.header();
    if (init.method === "POST") headers["Content-Type"] = "application/json";
    if (init.token !== undefined) headers["x-recaptcha-token"] = init.token;
    const res = await politeFetch(url, {
      method: init.method,
      // IIS demands a Content-Length on the POST (411 otherwise) — empty string body.
      body: init.method === "POST" ? "" : undefined,
      headers,
      useProxy: this.useProxy,
      rateLimitMs: 2000,
      timeoutMs: 45_000,
    });
    this.jar.absorb(res.headers);
    return res;
  }

  async init(): Promise<string[]> {
    // Mint NetScaler session cookies.
    const shell = await this.raw(`${BASE}/`, { method: "GET" });
    await shell.text().catch(() => {});
    await sleep(jitter(600));
    const dt = await this.raw(`${BASE}/api/home/documentTypes`, { method: "GET" });
    const body = await dt.text();
    if (!dt.ok) throw new Error(`[miamidade] documentTypes HTTP ${dt.status}`);
    let list: string[] = [];
    try {
      list = JSON.parse(body) as string[];
    } catch {
      throw new Error(`[miamidade] documentTypes not JSON: ${body.slice(0, 120)}`);
    }
    // Resolve a token up-front (one-shot tokens are minted per search below if
    // a solver is provided; a static recaptchaToken is reused as best-effort).
    if (this.tokenSource.recaptchaToken) this.token = this.tokenSource.recaptchaToken;
    return list;
  }

  private async ensureToken(): Promise<string> {
    if (this.tokenSource.solveRecaptcha) {
      return this.tokenSource.solveRecaptcha(MIAMIDADE_RECAPTCHA_SITEKEY, `${BASE}/`);
    }
    if (this.token) return this.token;
    // No token source: send empty — the server will reject (qs:null). We keep
    // going so the handshake is exercised and the precise gate is observable.
    return "";
  }

  async search(params: {
    documentType: string;
    from: string;
    to: string;
  }): Promise<{ qs: string | null; status: number; raw: string }> {
    const token = await this.ensureToken();
    const qsParams = new URLSearchParams({
      partyName: "",
      dateRangeFrom: params.from,
      dateRangeTo: params.to,
      documentType: params.documentType,
      searchT: params.documentType,
      firstQuery: "true",
      searchtype: "standard",
    });
    const res = await this.raw(`${BASE}/api/home/standardsearch?${qsParams.toString()}`, {
      method: "POST",
      token,
    });
    const raw = await res.text();
    let qs: string | null = null;
    try {
      qs = (JSON.parse(raw) as { qs?: string | null }).qs ?? null;
    } catch {
      /* non-JSON → qs stays null */
    }
    return { qs, status: res.status, raw };
  }

  async records(qs: string): Promise<{ rows: MdGridRow[]; status: number; raw: string }> {
    const res = await this.raw(
      `${BASE}/api/SearchResults/getStandardRecords?qs=${encodeURIComponent(qs)}`,
      { method: "GET" },
    );
    const raw = await res.text();
    return { rows: parseRecords(raw), status: res.status, raw };
  }

  async close(): Promise<void> {
    /* stateless */
  }
}

/** stealth-chromium transport — loads the SPA, mints a v3 token in-page. */
class BrowserTransport implements MdTransport {
  private sess: PlaywrightSession;
  private page: Page | null = null;
  constructor(private useProxy: boolean) {
    this.sess = new PlaywrightSession({
      useProxy,
      headless: true,
      engine: "stealth-chromium",
      navTimeoutMs: 90_000,
    });
  }

  async init(): Promise<string[]> {
    this.page = await this.sess.newPage();
    await this.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await sleep(jitter(3000)); // let the SPA boot + grecaptcha load
    const list = await this.page.evaluate(async () => {
      const res = await fetch(`/officialrecords/api/home/documentTypes`, {
        headers: { Accept: "application/json" },
      });
      return (await res.json()) as string[];
    });
    return Array.isArray(list) ? list : [];
  }

  private async mintToken(): Promise<string> {
    const page = this.page!;
    return page.evaluate(async (sitekey) => {
      const g = (
        window as unknown as {
          grecaptcha?: {
            ready?: (cb: () => void) => void;
            execute?: (k: string, o: { action: string }) => Promise<string>;
          };
        }
      ).grecaptcha;
      if (!g || !g.execute) return "";
      await new Promise<void>((res) => (g.ready ? g.ready(() => res()) : res()));
      try {
        return await g.execute(sitekey, { action: "submit" });
      } catch {
        return "";
      }
    }, MIAMIDADE_RECAPTCHA_SITEKEY);
  }

  async search(params: {
    documentType: string;
    from: string;
    to: string;
  }): Promise<{ qs: string | null; status: number; raw: string }> {
    const page = this.page!;
    const token = await this.mintToken();
    const result = await page.evaluate(
      async (args) => {
        const qsParams = new URLSearchParams({
          partyName: "",
          dateRangeFrom: args.from,
          dateRangeTo: args.to,
          documentType: args.documentType,
          searchT: args.documentType,
          firstQuery: "true",
          searchtype: "standard",
        });
        const res = await fetch(`/officialrecords/api/home/standardsearch?${qsParams.toString()}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "x-recaptcha-token": args.token,
            "content-type": "application/json",
          },
          body: "",
        });
        return { status: res.status, body: await res.text() };
      },
      { ...params, token },
    );
    let qs: string | null = null;
    try {
      qs = (JSON.parse(result.body) as { qs?: string | null }).qs ?? null;
    } catch {
      /* ignore */
    }
    return { qs, status: result.status, raw: result.body };
  }

  async records(qs: string): Promise<{ rows: MdGridRow[]; status: number; raw: string }> {
    const page = this.page!;
    const result = await page.evaluate(async (qsArg) => {
      const res = await fetch(
        `/officialrecords/api/SearchResults/getStandardRecords?qs=${encodeURIComponent(qsArg)}`,
        { headers: { Accept: "application/json" } },
      );
      return { status: res.status, body: await res.text() };
    }, qs);
    return { rows: parseRecords(result.body), status: result.status, raw: result.body };
  }

  async close(): Promise<void> {
    await this.sess.close();
  }
}

function makeTransport(useProxy: boolean, tokenSource: MdTokenSource, forceBrowser: boolean): MdTransport {
  // Browser path is required to self-mint a token; http path needs an injected
  // token. Prefer browser when no static/solver token is available.
  const hasInjected = !!(tokenSource.recaptchaToken || tokenSource.solveRecaptcha);
  return forceBrowser || !hasInjected
    ? new BrowserTransport(useProxy)
    : new HttpTransport(useProxy, tokenSource);
}

// ---------------------------------------------------------------------------
// Record parsing — the getStandardRecords payload. The server returns SQL-ish
// camel/upper aliases; we read keys case-insensitively to be drift-tolerant.
// ---------------------------------------------------------------------------

export interface MdGridRow {
  cfn?: string | null;
  recordDate?: string | null;
  documentType?: string | null;
  bookType?: string | null;
  book?: string | null;
  page?: string | null;
  firstParty?: string | null;
  secondParty?: string | null;
  folio?: string | null;
  legal?: string | null;
  consideration?: number | null;
}

/** Case-insensitive key pick across a raw record object. */
function pick(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase() === k.toLowerCase()) {
        const v = obj[actual];
        if (v === null || v === undefined) continue;
        return String(v);
      }
    }
  }
  return null;
}

function pickNum(obj: Record<string, unknown>, ...keys: string[]): number | null {
  const s = pick(obj, ...keys);
  if (s === null) return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse the getStandardRecords JSON envelope into normalized rows. */
export function parseRecords(raw: string): MdGridRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  // The payload may be a bare array, or {records:[...]} / {data:[...]} /
  // {results:[...]} — handle all.
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    arr =
      (o.records as unknown[]) ??
      (o.data as unknown[]) ??
      (o.results as unknown[]) ??
      (o.standardRecords as unknown[]) ??
      [];
  }
  if (!Array.isArray(arr)) return [];
  const out: MdGridRow[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push({
      cfn: pick(o, "cfn", "cfnNumber", "cfn_number", "instrumentNumber"),
      recordDate: pick(o, "recordDate", "recordDateTime", "record_date", "recordingDate"),
      documentType: pick(o, "documentType", "docType", "doc_type", "documentTypeDescription"),
      bookType: pick(o, "bookType", "book_type"),
      book: pick(o, "book", "bookNumber", "rec_book"),
      page: pick(o, "page", "pageNumber", "rec_page"),
      firstParty: pick(o, "firstParty", "first_party", "directName", "grantor"),
      secondParty: pick(o, "secondParty", "second_party", "indirectName", "grantee"),
      folio: pick(o, "folio", "folioNumber", "folio_number", "folioNo"),
      legal: pick(o, "legal", "legalDescription", "legal_description"),
      consideration: pickNum(o, "consideration", "amount", "considerationAmount"),
    });
  }
  return out;
}

export function parseMdDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const ms = /\/Date\((-?\d+)\)\//.exec(s);
  if (ms) {
    const d = new Date(parseInt(ms[1], 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// APN/folio join (folio is direct; name-join is the conservative fallback).
// ---------------------------------------------------------------------------

type ApnJoinTier = "direct-folio" | "unique-name" | "ambiguous" | "none";

interface ClassifiedRow {
  row: MdGridRow;
  family: MdDocFamily;
  recordingDate: Date;
  ownerName: string | null;
  apn: string | null;
  apnTier: ApnJoinTier;
}

async function resolveApns(rows: ClassifiedRow[]): Promise<void> {
  // ---- Tier 1: direct folio verification against Parcel(12086, apn) ----
  const folioSet = new Set<string>();
  for (const r of rows) {
    const f = normFolio(r.row.folio);
    if (f) folioSet.add(f);
  }
  const verified = new Set<string>();
  const folios = [...folioSet];
  for (let i = 0; i < folios.length; i += 500) {
    const chunk = folios.slice(i, i + 500);
    if (chunk.length === 0) continue;
    const hits = await prisma.parcel.findMany({
      where: { countyFips: COUNTY_FIPS, apn: { in: chunk } },
      select: { apn: true },
    });
    for (const h of hits) verified.add(h.apn);
  }
  for (const r of rows) {
    const f = normFolio(r.row.folio);
    if (f && verified.has(f)) {
      r.apn = f;
      r.apnTier = "direct-folio";
    }
  }

  // ---- Tier 2: unique compressed owner-name join (fallback only) ----
  const nameKeys = new Set<string>();
  for (const r of rows) {
    if (r.apn || !r.ownerName) continue;
    const key = normAlnum(r.ownerName);
    if (key.length >= 5) nameKeys.add(key);
  }
  if (nameKeys.size === 0) return;
  const keys = [...nameKeys];
  const hits = await prisma.$queryRaw<Array<{ key: string; apn: string; n: number }>>`
    SELECT t.key, MIN(t.apn) AS apn, COUNT(DISTINCT t.apn)::int AS n
    FROM (
      SELECT regexp_replace(upper("ownerName"), '[^A-Z0-9]', '', 'g') AS key, apn
      FROM flipops."Parcel"
      WHERE "countyFips" = ${COUNTY_FIPS} AND "ownerName" IS NOT NULL
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

async function persistMortgage(r: ClassifiedRow): Promise<boolean> {
  const doc = r.row.cfn!;
  const isAssignment = r.family === "assignment";
  try {
    await prisma.mortgage.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: COUNTY_FIPS,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: COUNTY_FIPS,
        apn: r.apn,
        recordingDate: r.recordingDate,
        loanAmount: r.row.consideration ?? null,
        lenderName: r.row.secondParty?.trim() || null,
        borrowerName: isAssignment ? null : r.row.firstParty?.trim() || null,
        mortgageType: r.row.documentType ?? null,
        documentNumber: doc,
        orBook: r.row.book?.trim() || null,
        orPage: r.row.page?.trim() || null,
        source: SOURCE,
      },
      update: {
        loanAmount: r.row.consideration ?? undefined,
        lenderName: r.row.secondParty?.trim() || undefined,
        borrowerName: isAssignment ? undefined : r.row.firstParty?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[miamidade] mortgage persist failed cfn=${doc}:`, (err as Error).message);
    return false;
  }
}

async function persistLien(r: ClassifiedRow): Promise<boolean> {
  const doc = r.row.cfn!;
  const docType = r.row.documentType ?? "";
  try {
    await prisma.lien.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: COUNTY_FIPS,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: COUNTY_FIPS,
        apn: r.apn,
        lienCategory: classifyLienCategory(r.family, docType),
        recordingDate: r.recordingDate,
        amount: r.row.consideration ?? null,
        plaintiffName: r.row.firstParty?.trim() || null,
        defendantName: r.row.secondParty?.trim() || null,
        lienTypeCode: docType || null,
        documentNumber: doc,
        orBook: r.row.book?.trim() || null,
        orPage: r.row.page?.trim() || null,
        source: SOURCE,
      },
      update: {
        amount: r.row.consideration ?? undefined,
        plaintiffName: r.row.firstParty?.trim() || undefined,
        defendantName: r.row.secondParty?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[miamidade] lien persist failed cfn=${doc}:`, (err as Error).message);
    return false;
  }
}

async function applySatisfaction(r: ClassifiedRow): Promise<boolean> {
  const owner = r.row.secondParty?.trim();
  if (!owner) return false;
  const releaseDocNum = r.row.cfn ?? null;
  const mortgages = await prisma.mortgage.findMany({
    where: {
      countyFips: COUNTY_FIPS,
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
  if (mortgages.length > 1) return false;
  const liens = await prisma.lien.findMany({
    where: {
      countyFips: COUNTY_FIPS,
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
// Main entry — one (county, date-range) sweep across all distress doc types.
// ---------------------------------------------------------------------------

export interface MdScrapeResult {
  countyFips: string;
  county: string;
  from: string;
  to: string;
  found: number;
  byFamily: Record<string, number>;
  persistedMortgages: number;
  persistedLiens: number;
  satisfactionsApplied: number;
  satisfactionsSkipped: number;
  rejected: number;
  requests: number;
  /** Set when 0 rows: precise reason for an operator. */
  outcome: "ok" | "captcha-required" | "blocked" | "empty";
  apnJoin: { directFolio: number; uniqueName: number; ambiguous: number; none: number };
  docTypesSearched: number;
}

export async function scrapeMiamiDadeCounty(opts: {
  from: Date;
  to: Date;
  useProxy?: boolean;
  /** Force the stealth-chromium path even if a token source is present. */
  forceBrowser?: boolean;
  tokenSource?: MdTokenSource;
  /** Cap doc types searched (testing). */
  families?: MdDocFamily[];
}): Promise<MdScrapeResult> {
  const useProxy = opts.useProxy ?? false; // direct verified for the handshake
  const tokenSource = opts.tokenSource ?? {};
  const fromStr = fmtDate(opts.from);
  const toStr = fmtDate(opts.to);
  const sourceTag = `${SOURCE}-${opts.from.toISOString().slice(0, 10)}..${opts.to.toISOString().slice(0, 10)}`;

  const transport = makeTransport(useProxy, tokenSource, opts.forceBrowser ?? false);
  let requests = 0;
  const rawRows: MdGridRow[] = [];
  const seenCfn = new Set<string>();
  let outcome: MdScrapeResult["outcome"] = "empty";

  const families = opts.families ?? MD_DOC_TYPES.map((d) => d.family);
  const docTypeSearches = MD_DOC_TYPES.filter((d) => families.includes(d.family)).flatMap((d) =>
    d.codes.map((code) => code),
  );

  try {
    requests++;
    await transport.init();

    for (const code of docTypeSearches) {
      requests++;
      const { qs, status, raw } = await transport.search({
        documentType: code,
        from: fromStr,
        to: toStr,
      });
      if (status >= 400) {
        outcome = "blocked";
        continue;
      }
      if (!qs) {
        // {isValidSearch:false, qs:null} — the reCAPTCHA gate (no valid token)
        // or a genuinely empty window. Distinguish by the literal flag.
        if (/isValidSearch"?\s*:\s*false/i.test(raw)) {
          outcome = outcome === "empty" ? "captcha-required" : outcome;
        }
        await sleep(jitter(1500));
        continue;
      }
      await sleep(jitter(900));
      requests++;
      const recs = await transport.records(qs);
      let added = 0;
      for (const row of recs.rows) {
        const key = row.cfn ?? "";
        if (key && seenCfn.has(key)) continue;
        if (key) seenCfn.add(key);
        rawRows.push(row);
        added++;
      }
      if (added > 0) outcome = "ok";
      await sleep(jitter(1500));
    }
  } finally {
    await transport.close();
  }

  // Classify + reject.
  const byFamily: Record<string, number> = {};
  const classified: ClassifiedRow[] = [];
  let rejected = 0;
  for (const row of rawRows) {
    const docType = row.documentType ?? "";
    const recordingDate = parseMdDate(row.recordDate);
    const family = classifyMdDocType(docType);
    if (!row.cfn || !docType || !recordingDate || !family) {
      rejected++;
      continue;
    }
    byFamily[family] = (byFamily[family] ?? 0) + 1;
    const ownerName =
      family === "mortgage"
        ? row.firstParty?.trim() || null
        : family === "lien" || family === "judgment" || family === "lis_pendens"
          ? row.secondParty?.trim() || null
          : null;
    classified.push({ row, family, recordingDate, ownerName, apn: null, apnTier: "none" });
  }

  const joinable = classified.filter((c) => c.family !== "satisfaction");
  await resolveApns(joinable);

  const result: MdScrapeResult = {
    countyFips: COUNTY_FIPS,
    county: COUNTY,
    from: fromStr,
    to: toStr,
    found: rawRows.length,
    byFamily,
    persistedMortgages: 0,
    persistedLiens: 0,
    satisfactionsApplied: 0,
    satisfactionsSkipped: 0,
    rejected,
    requests,
    outcome,
    apnJoin: { directFolio: 0, uniqueName: 0, ambiguous: 0, none: 0 },
    docTypesSearched: docTypeSearches.length,
  };

  for (const c of joinable) {
    if (c.apnTier === "direct-folio") result.apnJoin.directFolio++;
    else if (c.apnTier === "unique-name") result.apnJoin.uniqueName++;
    else if (c.apnTier === "ambiguous") result.apnJoin.ambiguous++;
    else result.apnJoin.none++;

    if (c.family === "mortgage" || c.family === "assignment") {
      if (await persistMortgage(c)) result.persistedMortgages++;
    } else {
      if (await persistLien(c)) result.persistedLiens++;
    }
  }

  for (const c of classified) {
    if (c.family !== "satisfaction") continue;
    if (await applySatisfaction(c)) result.satisfactionsApplied++;
    else result.satisfactionsSkipped++;
  }

  // Bronze: full payload + per-row folio/name join confidence (Mortgage/Lien
  // have no metadata column — match confidence lives here).
  void captureRaw({
    entityType: "parcel",
    source: "miamidade-ori",
    sourceTag,
    category: "clerk_recordings_bulk",
    countyFips: COUNTY_FIPS,
    requestParams: {
      baseUrl: BASE,
      from: fromStr,
      to: toStr,
      docTypeCodes: docTypeSearches,
      useProxy,
      outcome,
    },
    rawResponse: {
      rows: rawRows,
      apnJoins: joinable.map((c) => ({
        cfn: c.row.cfn,
        family: c.family,
        folio: c.row.folio,
        apn: c.apn,
        tier: c.apnTier,
        confidence:
          c.apnTier === "direct-folio" ? 1.0 : c.apnTier === "unique-name" ? 0.85 : 0,
      })),
    },
    legalRisk: "yellow",
  });

  return result;
}
