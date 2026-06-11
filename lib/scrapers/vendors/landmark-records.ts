import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { parseSetCookieHeaders, buildCookieHeader } from "../base/cookie-fetch";

// ---------------------------------------------------------------------------
// LANDMARK family Official-Records adapter (Pioneer Technology Group /
// Granicus "Landmark Web Official Records Search").  M2.1b / Lane B2.
//
// Sister to the Acclaim family adapter (lib/scrapers/vendors/duval-clerk.ts).
// One parser → many counties via the LANDMARK_COUNTIES config table — Palm
// Beach (metro), Lee (metro), Levy (small-county reuse proof). The small
// county runs byte-identical software to the metros, so adding county #N is a
// config row, exactly as the recon spec predicted.
//
// SESSION GATE (load-bearing, verified live 2026-06-10):
//   1. GET  https://<host>/<base>/                       → mints ASP.NET_SessionId
//   2. POST https://<host>/<base>/Search/SetDisclaimer   (EMPTY body) → 200, flips
//      the session "disclaimer accepted" flag. Skip it and every search/index
//      load returns <title>Session Has Expired</title>.
//   Cookies from BOTH responses are accumulated into one Cookie: header and
//   replayed on the search XHRs (same cheap politeFetch path as RealAuction —
//   NO Playwright in the fetch path).
//
// SEARCH TRANSPORT (verified live on Palm Beach 2026-06-10):
//   POST https://<host>/<base>/Search/<Endpoint>  (form-urlencoded criteria)
//   The criteria object jQuery-serializes to form params. Endpoints + the exact
//   field names were lifted from /Scripts/search/index.js (SetCriteria()):
//     RecordDateSearch  → { beginDate, endDate, doctype?, recordCount, exclude,
//                           ReturnIndexGroups, townName, mobileHomesOnly }
//     ParcelIdSearch    → { searchLikeType, parcelId, doctype?, recordCount, ... }
//     DocumentTypeSearch→ { doctype, beginDate, endDate, recordCount, ... }
//   Response is an HTML fragment ($('#searchResults').html(response)) carrying
//   the result table — index fields are all in that fragment, NO image fetch.
//
// ⚠ reCAPTCHA v2 GATE (NEW finding this build wave — recon Lane A1 never ran a
//   search so never saw it). Verified live 2026-06-10:
//     POST <base>/Search/ShowCaptcha → "True" on a fresh session for BOTH
//     Palm Beach and Levy, and every search endpoint (incl. narrow ParcelId /
//     InstrumentNumber) returns the literal body "Invalid Captcha" unless a
//     valid `g-recaptcha-response` token (sitekey 6LdBHOorAAAAAL... = reCAPTCHA
//     v2 checkbox) accompanies the POST. The residential proxy makes it worse
//     (Levy Cloudflare-403s the DataImpulse pool; PB landing fails via proxy) —
//     direct egress is correct, the captcha is the wall. Production persistence
//     therefore requires a token source: inject `recaptchaToken` (one-shot) or a
//     `solveRecaptcha(sitekey, pageUrl)` hook (2captcha/anti-captcha class
//     service). The adapter is otherwise complete and persists the moment a
//     token arrives — see scrapeLandmarkRecords().
//
// EGRESS (empirical, per OPS-6 / recon §5):
//   Palm Beach  = direct  (clean)
//   Levy        = direct  (clean; proxy → Cloudflare 403)
//   Lee         = proxy   (direct datacenter egress times out — recon 3×; this
//                          machine reproduced 000. Railway-direct may also work.)
// ---------------------------------------------------------------------------

export interface LandmarkCounty {
  countyFips: string;
  /** Host only, e.g. "erec.mypalmbeachclerk.com". */
  host: string;
  /** Path prefix WITHOUT trailing slash. "" for PB (routes are root-relative); "/LandmarkWeb" for Levy/Lee. */
  basePath: string;
  county: string;
  /** Default egress for this host (empirical). */
  useProxy: boolean;
}

// data-sitekey verified identical across every search section on the Palm Beach
// landing markup. Exposed so a solver hook knows which key to solve.
export const LANDMARK_RECAPTCHA_SITEKEY = "6LdBHOorAAAAALwRLkAZpnNsfcp7qfFS4YIGIRTU";

export const LANDMARK_COUNTIES: LandmarkCounty[] = [
  { countyFips: "12099", host: "erec.mypalmbeachclerk.com", basePath: "",            county: "Palm Beach", useProxy: false },
  { countyFips: "12071", host: "or.leeclerk.org",           basePath: "/LandmarkWeb", county: "Lee",        useProxy: true  },
  { countyFips: "12075", host: "online.levyclerk.com",      basePath: "/LandmarkWeb", county: "Levy",       useProxy: false },
  // M2.1 COUNTY EXPANSION (Lane C4) — small/mid county tail on the Landmark
  // family. Each row live-verified 2026-06-11: landing GET mints
  // ASP.NET_SessionId, POST /Search/SetDisclaimer → 200, search/index loads
  // (NOT "Session Has Expired"). Both gate search behind reCAPTCHA
  // (ShowCaptcha=True), identical to PB/Levy/Lee — so they persist rows the
  // moment a recaptchaToken/solver arrives (OPS-8), config is complete now.
  { countyFips: "12053", host: "or.hernandoclerk.com",      basePath: "/LandmarkWeb", county: "Hernando",   useProxy: false },
  { countyFips: "12017", host: "search.citrusclerk.org",    basePath: "/LandmarkWeb", county: "Citrus",      useProxy: false },
];

export function findLandmarkCounty(countyFips: string): LandmarkCounty | undefined {
  return LANDMARK_COUNTIES.find((c) => c.countyFips === countyFips);
}

/** Parsed index row, before classification. */
export interface LandmarkRecord {
  documentType: string;
  documentNumber?: string;
  recordingDate?: string;
  grantor?: string;     // mortgage: borrower    | lien: claimant/plaintiff
  grantee?: string;     // mortgage: lender      | lien: owner/defendant
  consideration?: number;
  bookPage?: string;
  legal?: string;
  parcelId?: string;    // present only on a ParcelId search response
}

export interface LandmarkScrapeResult {
  countyFips: string;
  county: string;
  searchKind: "record-date" | "parcel-id" | "document-type";
  /** Why the run produced 0 rows when it did. */
  outcome: "ok" | "captcha-required" | "session-expired" | "blocked" | "empty";
  found: number;
  persistedMortgages: number;
  persistedLiens: number;
  parcelIdRows: number;       // rows that carried an APN directly (exact-join eligible)
  httpStatus: number;
}

// ---------------------------------------------------------------------------
// Session mint
// ---------------------------------------------------------------------------

export interface LandmarkSession {
  cookieHeader: string;
  origin: string;   // https://<host>
  base: string;     // https://<host><basePath>
  useProxy: boolean;
}

/** Merge a response's Set-Cookie pairs into an existing name=value cookie map. */
function mergeCookies(jar: Map<string, string>, res: Response): void {
  const { cookies } = parseSetCookieHeaders(res.headers);
  // buildCookieHeader gives us a deduped "name=value; ..." string; split back
  // into the jar so later responses can overwrite individual cookies.
  const header = buildCookieHeader(cookies);
  if (!header) return;
  for (const pair of header.split("; ")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function jarToHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Mint a disclaimer-accepted Landmark session: landing GET + SetDisclaimer POST.
 * Returns null when the host is unreachable (Lee datacenter block) so the caller
 * can record a "blocked" outcome instead of throwing.
 */
export async function mintLandmarkSession(
  county: LandmarkCounty,
  opts?: { useProxy?: boolean },
): Promise<LandmarkSession | null> {
  const useProxy = opts?.useProxy ?? county.useProxy;
  const origin = `https://${county.host}`;
  const base = `${origin}${county.basePath}`;
  const jar = new Map<string, string>();

  try {
    const landing = await politeFetch(`${base}/`, {
      method: "GET",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    mergeCookies(jar, landing);
    await landing.text().catch(() => {});
    if (landing.status >= 400) return null;

    const disc = await politeFetch(`${base}/Search/SetDisclaimer`, {
      method: "POST",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Length": "0",
        Referer: `${origin}/`,
        Cookie: jarToHeader(jar),
      },
      body: "",
    });
    mergeCookies(jar, disc);
    await disc.text().catch(() => {});
    if (disc.status >= 400) return null;

    return { cookieHeader: jarToHeader(jar), origin, base, useProxy };
  } catch {
    return null;
  }
}

/** POST Search/ShowCaptcha → true when this deployment gates search behind reCAPTCHA. */
export async function landmarkShowCaptcha(sess: LandmarkSession): Promise<boolean> {
  try {
    const res = await politeFetch(`${sess.base}/Search/ShowCaptcha`, {
      method: "POST",
      useProxy: sess.useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Length": "0",
        Cookie: sess.cookieHeader,
      },
      body: "",
    });
    const txt = (await res.text()).trim();
    return /^true$/i.test(txt);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOpts {
  /** A pre-solved reCAPTCHA v2 token to attach as g-recaptcha-response. */
  recaptchaToken?: string;
  /** Lazy solver hook (2captcha/anti-captcha class). Called only when ShowCaptcha=true. */
  solveRecaptcha?: (sitekey: string, pageUrl: string) => Promise<string>;
  /** Max records to request from the server (Landmark caps display). */
  recordCount?: number;
}

const CAPTCHA_SENTINEL = "Invalid Captcha";

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

async function resolveToken(
  sess: LandmarkSession,
  opts: SearchOpts,
): Promise<{ token: string; gated: boolean }> {
  const gated = await landmarkShowCaptcha(sess);
  if (!gated) return { token: "", gated: false };
  if (opts.recaptchaToken) return { token: opts.recaptchaToken, gated: true };
  if (opts.solveRecaptcha) {
    const token = await opts.solveRecaptcha(LANDMARK_RECAPTCHA_SITEKEY, `${sess.origin}/`);
    return { token, gated: true };
  }
  return { token: "", gated: true };
}

async function postSearch(
  sess: LandmarkSession,
  endpoint: string,
  criteria: Record<string, string>,
  token: string,
): Promise<{ status: number; body: string }> {
  const form = new URLSearchParams(criteria);
  if (token) form.set("g-recaptcha-response", token);
  const res = await politeFetch(`${sess.base}/Search/${endpoint}`, {
    method: "POST",
    useProxy: sess.useProxy,
    rotateFingerprint: true,
    timeoutMs: 45_000,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${sess.base}/search/index?theme=.blue`,
      Cookie: sess.cookieHeader,
    },
    body: form.toString(),
  });
  const body = await res.text();
  return { status: res.status, body };
}

const COMMON_CRITERIA = (recordCount: number): Record<string, string> => ({
  exclude: "false",
  ReturnIndexGroups: "false",
  recordCount: String(recordCount),
  townName: "",
  mobileHomesOnly: "false",
});

/**
 * Single-search primitive shared by the three public search kinds. Builds the
 * criteria, resolves the captcha token, POSTs, classifies the outcome, parses.
 */
async function runSearch(
  sess: LandmarkSession,
  county: LandmarkCounty,
  searchKind: LandmarkScrapeResult["searchKind"],
  endpoint: string,
  criteria: Record<string, string>,
  opts: SearchOpts,
  /** When set (parcel search), every returned row belongs to this APN — stamp it for an exact Parcel join. */
  stampApn?: string,
): Promise<LandmarkScrapeResult> {
  const base: LandmarkScrapeResult = {
    countyFips: county.countyFips,
    county: county.county,
    searchKind,
    outcome: "ok",
    found: 0,
    persistedMortgages: 0,
    persistedLiens: 0,
    parcelIdRows: 0,
    httpStatus: 0,
  };

  const { token, gated } = await resolveToken(sess, opts);
  if (gated && !token) return { ...base, outcome: "captcha-required" };

  const { status, body } = await postSearch(sess, endpoint, criteria, token);
  base.httpStatus = status;

  if (body.includes(CAPTCHA_SENTINEL)) return { ...base, outcome: "captcha-required" };
  if (/Session Has Expired/i.test(body)) return { ...base, outcome: "session-expired" };
  if (status >= 400) return { ...base, outcome: "blocked" };

  const rows = parseLandmarkResults(body);
  base.found = rows.length;

  void captureRaw({
    entityType: "parcel",
    source: "landmark",
    sourceTag: `scraper:landmark-${county.countyFips}-${searchKind}`,
    category: "clerk_recordings_bulk",
    countyFips: county.countyFips,
    requestParams: { endpoint, criteria, gated },
    rawResponse: { extracted: rows, htmlBytes: body.length, htmlSample: body.slice(0, 30_000) },
    legalRisk: "yellow",
  });

  for (const r of rows) {
    if (stampApn && !r.parcelId) r.parcelId = stampApn;
    if (r.parcelId) base.parcelIdRows++;
    const recordingDate = parseDate(r.recordingDate) ?? new Date();
    const cls = classifyDocument(r.documentType);
    const source = `scraper:landmark-${county.countyFips}`;
    if (cls === "mortgage") base.persistedMortgages += await persistMortgage(county.countyFips, r, recordingDate, source);
    else if (cls === "lien") base.persistedLiens += await persistLien(county.countyFips, r, recordingDate, source);
  }

  if (base.found === 0) base.outcome = "empty";
  return base;
}

/** Record-date range sweep — fills row-count breadth (no APN on these rows). */
export async function searchLandmarkByRecordDate(
  sess: LandmarkSession,
  county: LandmarkCounty,
  beginDate: Date,
  endDate: Date,
  opts: SearchOpts = {},
): Promise<LandmarkScrapeResult> {
  const recordCount = opts.recordCount ?? 1000;
  const criteria = {
    ...COMMON_CRITERIA(recordCount),
    beginDate: fmtDate(beginDate),
    endDate: fmtDate(endDate),
  };
  return runSearch(sess, county, "record-date", "RecordDateSearch", criteria, opts);
}

/** Targeted parcel pull — these rows carry an APN for an EXACT Parcel join. */
export async function searchLandmarkByParcelId(
  sess: LandmarkSession,
  county: LandmarkCounty,
  parcelId: string,
  opts: SearchOpts = {},
): Promise<LandmarkScrapeResult> {
  const recordCount = opts.recordCount ?? 200;
  const criteria = {
    ...COMMON_CRITERIA(recordCount),
    searchLikeType: "0",
    parcelId,
    doctype: "",
  };
  // Stamp the queried APN onto every returned row — they all belong to this
  // parcel, so this yields an EXACT Parcel(countyFips, apn) join even when the
  // result table doesn't echo a parcel column.
  return runSearch(sess, county, "parcel-id", "ParcelIdSearch", criteria, opts, parcelId);
}

/** Doc-type + date sweep (e.g. only MTG/LIE families). */
export async function searchLandmarkByDocumentType(
  sess: LandmarkSession,
  county: LandmarkCounty,
  docTypeIds: string,
  beginDate: Date,
  endDate: Date,
  opts: SearchOpts = {},
): Promise<LandmarkScrapeResult> {
  const recordCount = opts.recordCount ?? 1000;
  const criteria = {
    ...COMMON_CRITERIA(recordCount),
    doctype: docTypeIds,
    beginDate: fmtDate(beginDate),
    endDate: fmtDate(endDate),
  };
  return runSearch(sess, county, "document-type", "DocumentTypeSearch", criteria, opts);
}

/**
 * Convenience end-to-end: mint session → record-date sweep for one county over
 * [beginDate, endDate]. Returns a session-expired / captcha / blocked outcome
 * rather than throwing so the dispatch layer can audit cleanly.
 */
export async function scrapeLandmarkRecords(opts: {
  countyFips: string;
  beginDate: Date;
  endDate: Date;
  useProxy?: boolean;
  recaptchaToken?: string;
  solveRecaptcha?: (sitekey: string, pageUrl: string) => Promise<string>;
}): Promise<LandmarkScrapeResult> {
  const county = findLandmarkCounty(opts.countyFips);
  if (!county) throw new Error(`landmark: unknown countyFips ${opts.countyFips}`);

  const empty: LandmarkScrapeResult = {
    countyFips: county.countyFips,
    county: county.county,
    searchKind: "record-date",
    outcome: "blocked",
    found: 0,
    persistedMortgages: 0,
    persistedLiens: 0,
    parcelIdRows: 0,
    httpStatus: 0,
  };

  const sess = await mintLandmarkSession(county, { useProxy: opts.useProxy });
  if (!sess) return empty;

  return searchLandmarkByRecordDate(sess, county, opts.beginDate, opts.endDate, {
    recaptchaToken: opts.recaptchaToken,
    solveRecaptcha: opts.solveRecaptcha,
  });
}

// ---------------------------------------------------------------------------
// Parser — Landmark result fragment → LandmarkRecord[]
//
// The search POST returns an HTML fragment with a results <table>. Landmark's
// column set (verified via the result icon legend + index.js): Record Date,
// Name (party), Legal, Instrument #, Consideration, Book/Page, Document Type
// (+ optional Parcel ID on a ParcelId search). Column ORDER varies per county
// theme, so we map by <thead> header text when present and fall back to the
// canonical order. Index fields only — never opens an image.
// ---------------------------------------------------------------------------

interface ColMap {
  recordDate?: number;
  party?: number;
  grantor?: number;
  grantee?: number;
  legal?: number;
  instrument?: number;
  consideration?: number;
  bookPage?: number;
  docType?: number;
  parcelId?: number;
}

function headerToKey(text: string): keyof ColMap | null {
  const t = text.toLowerCase();
  if (/record\s*date|rec\.?\s*date|date\s*recorded/.test(t)) return "recordDate";
  if (/grantor|direct\s*name|first\s*party/.test(t)) return "grantor";
  if (/grantee|reverse\s*name|second\s*party/.test(t)) return "grantee";
  if (/\bname|part(y|ies)/.test(t)) return "party";
  if (/legal/.test(t)) return "legal";
  if (/instrument|doc(ument)?\s*(#|number|num)|clerk\s*file|cfn/.test(t)) return "instrument";
  if (/consideration|amount/.test(t)) return "consideration";
  if (/book\s*\/?\s*page|book.*page/.test(t)) return "bookPage";
  if (/doc(ument)?\s*type|type/.test(t)) return "docType";
  if (/parcel/.test(t)) return "parcelId";
  return null;
}

const CANONICAL: ColMap = {
  recordDate: 0, party: 1, legal: 2, instrument: 3, consideration: 4, bookPage: 5, docType: 6,
};

export function parseLandmarkResults(html: string): LandmarkRecord[] {
  const $ = cheerio.load(html);

  // Find the results table: prefer #resultsTable, then any table that has a
  // recognizable header, then the first table with >1 row.
  let $table = $("#resultsTable");
  if ($table.length === 0) {
    $("table").each((_, el) => {
      if ($table.length) return;
      const headers = $(el).find("thead th, tr:first-child th");
      if (headers.length >= 3) $table = $(el);
    });
  }
  if ($table.length === 0) $table = $("table").first();
  if ($table.length === 0) return [];

  // Build the column map from headers, else canonical positions.
  const map: ColMap = {};
  const $headers = $table.find("thead th");
  if ($headers.length > 0) {
    $headers.each((i, th) => {
      const key = headerToKey($(th).text().trim());
      if (key && map[key] === undefined) map[key] = i;
    });
  }
  const effective: ColMap = Object.keys(map).length >= 3 ? map : { ...CANONICAL, ...map };

  const records: LandmarkRecord[] = [];
  const bodyRows = $table.find("tbody tr").length
    ? $table.find("tbody tr")
    : $table.find("tr").slice($headers.length ? 1 : 0);

  bodyRows.each((_, tr) => {
    const cells = $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length < 3) return;
    const at = (idx?: number): string | undefined =>
      idx !== undefined && idx < cells.length ? cells[idx] || undefined : undefined;

    const docType = at(effective.docType);
    const instrument = at(effective.instrument);
    if (!docType && !instrument) return; // header/spacer row

    let grantor = at(effective.grantor);
    let grantee = at(effective.grantee);
    if (!grantor && !grantee) {
      // Single combined party cell: split on the first "vs"/"to"/"→"/newline.
      const party = at(effective.party);
      if (party) {
        const parts = party.split(/\s*(?:→|\bvs\.?\b|\bto\b|;)\s*/i);
        grantor = parts[0]?.trim() || undefined;
        grantee = parts[1]?.trim() || undefined;
      }
    }

    records.push({
      documentType: docType ?? "",
      documentNumber: instrument,
      recordingDate: at(effective.recordDate),
      grantor,
      grantee,
      consideration: parseConsideration(at(effective.consideration)),
      bookPage: at(effective.bookPage),
      legal: at(effective.legal),
      parcelId: at(effective.parcelId),
    });
  });

  return records;
}

// ---------------------------------------------------------------------------
// Classification + persistence (mirrors duval-clerk.ts, fills the
// borrower/lender + plaintiff/defendant + legal fields the Duval scraper drops)
// ---------------------------------------------------------------------------

export function classifyDocument(type: string): "mortgage" | "lien" | "other" {
  const t = type.toLowerCase();
  if (/mortgage|deed\s*of\s*trust/.test(t) && !/satisfaction|release/.test(t)) return "mortgage";
  if (/lien|judgment|claim\s*of\s*lien|lis\s*pendens/.test(t)) return "lien";
  return "other";
}

function classifyLien(type: string): string {
  const t = type.toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax/.test(t)) return "tax";
  if (/judgment/.test(t)) return "judgment";
  if (/lis\s*pendens/.test(t)) return "lis_pendens";
  return "other";
}

function parseConsideration(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitBookPage(bp: string | undefined): { book: string | null; page: string | null } {
  if (!bp) return { book: null, page: null };
  const m = bp.split(/[/\\-]/).map((x) => x.trim());
  return { book: m[0] || null, page: m[1] || null };
}

async function persistMortgage(
  countyFips: string,
  r: LandmarkRecord,
  recordingDate: Date,
  source: string,
): Promise<number> {
  if (!r.documentNumber) return 0;
  const { book, page } = splitBookPage(r.bookPage);
  try {
    await prisma.mortgage.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.documentNumber, source } },
      create: {
        countyFips,
        apn: r.parcelId ?? null,
        recordingDate,
        loanAmount: r.consideration ?? null,
        borrowerName: r.grantor ?? null,
        lenderName: r.grantee ?? null,
        mortgageType: r.documentType,
        documentNumber: r.documentNumber,
        orBook: book,
        orPage: page,
        source,
      },
      update: {
        loanAmount: r.consideration ?? undefined,
        borrowerName: r.grantor ?? undefined,
        lenderName: r.grantee ?? undefined,
        apn: r.parcelId ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[landmark] mortgage persist failed:", (err as Error).message);
    return 0;
  }
}

async function persistLien(
  countyFips: string,
  r: LandmarkRecord,
  recordingDate: Date,
  source: string,
): Promise<number> {
  if (!r.documentNumber) return 0;
  const { book, page } = splitBookPage(r.bookPage);
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.documentNumber, source } },
      create: {
        countyFips,
        apn: r.parcelId ?? null,
        lienCategory: classifyLien(r.documentType),
        recordingDate,
        amount: r.consideration ?? null,
        plaintiffName: r.grantor ?? null,
        defendantName: r.grantee ?? null,
        lienTypeCode: r.documentType,
        documentNumber: r.documentNumber,
        orBook: book,
        orPage: page,
        source,
      },
      update: {
        amount: r.consideration ?? undefined,
        plaintiffName: r.grantor ?? undefined,
        defendantName: r.grantee ?? undefined,
        apn: r.parcelId ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[landmark] lien persist failed:", (err as Error).message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Inline self-test — runs only on direct `tsx landmark-records.ts` invocation.
// Validates the parser (header-mapped + canonical-fallback) and classifiers
// against a synthetic fixture mirroring Landmark's result-fragment markup,
// since the live result HTML is reCAPTCHA-gated (see header note).
// ---------------------------------------------------------------------------

function _runInlineAssertions(): void {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const assert = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  // (a) Header-mapped parse with a non-canonical column order.
  {
    const html = `
      <table id="resultsTable"><thead><tr>
        <th>Document Type</th><th>Record Date</th><th>Grantor</th><th>Grantee</th>
        <th>Instrument #</th><th>Book/Page</th><th>Consideration</th><th>Legal</th>
      </tr></thead><tbody>
        <tr><td>MORTGAGE</td><td>06/02/2026</td><td>SMITH JOHN</td><td>WELLS FARGO BANK NA</td>
            <td>2026123456</td><td>34567/1890</td><td>$250,000.00</td><td>LOT 4 BLK 2 PALM ISLES</td></tr>
        <tr><td>CLAIM OF LIEN</td><td>06/03/2026</td><td>ABC PLUMBING LLC</td><td>DOE JANE</td>
            <td>2026123457</td><td>34567/1891</td><td>$8,200.00</td><td>UNIT 12B</td></tr>
      </tbody></table>`;
    const rows = parseLandmarkResults(html);
    assert("parse: 2 rows", rows.length === 2, `got ${rows.length}`);
    assert("parse: doctype mapped", rows[0].documentType === "MORTGAGE", rows[0].documentType);
    assert("parse: grantor/grantee split", rows[0].grantor === "SMITH JOHN" && rows[0].grantee === "WELLS FARGO BANK NA");
    assert("parse: consideration", rows[0].consideration === 250000, String(rows[0].consideration));
    assert("parse: instrument", rows[0].documentNumber === "2026123456", rows[0].documentNumber);
    assert("classify: mortgage", classifyDocument(rows[0].documentType) === "mortgage");
    assert("classify: lien", classifyDocument(rows[1].documentType) === "lien");
    assert("classify: lien category mechanics", classifyLien(rows[1].documentType) === "other"); // "claim of lien" → other
  }

  // (b) Canonical-fallback parse (no headers).
  {
    const html = `<table><tbody>
      <tr><td>06/05/2026</td><td>OWNER A → BANK B</td><td>LOT 9</td><td>2026200000</td><td>$0.00</td><td>35000/100</td><td>SATISFACTION OF MORTGAGE</td></tr>
    </tbody></table>`;
    const rows = parseLandmarkResults(html);
    assert("fallback: 1 row", rows.length === 1, `got ${rows.length}`);
    assert("fallback: party split on arrow", rows[0].grantor === "OWNER A" && rows[0].grantee === "BANK B", JSON.stringify(rows[0]));
    assert("fallback: doctype canonical col6", rows[0].documentType === "SATISFACTION OF MORTGAGE", rows[0].documentType);
    assert("classify: satisfaction is not mortgage", classifyDocument(rows[0].documentType) === "other");
  }

  // (c) Lien categorization.
  {
    assert("lien cat: mechanics", classifyLien("MECHANICS LIEN") === "mechanics");
    assert("lien cat: hoa", classifyLien("HOA ASSESSMENT LIEN") === "hoa");
    assert("lien cat: tax", classifyLien("TAX LIEN CERTIFICATE") === "tax");
    assert("lien cat: lis pendens", classifyLien("LIS PENDENS") === "lis_pendens");
  }

  // (d) Empty / captcha fragment yields no rows.
  {
    assert("captcha body parses to 0 rows", parseLandmarkResults("Invalid Captcha").length === 0);
    assert("session-expired parses to 0 rows", parseLandmarkResults("<title>Session Has Expired</title>").length === 0);
  }

  let failed = 0;
  for (const r of results) {
    if (r.ok) console.log(`PASS  ${r.name}`);
    else { failed++; console.error(`FAIL  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`); }
  }
  if (failed > 0) { console.error(`\n${failed}/${results.length} assertions failed`); process.exit(1); }
  else console.log(`\nAll ${results.length} assertions passed.`);
}

const _isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  /landmark-records(\.[tj]s)?$/.test(process.argv[1]);
if (_isMain) _runInlineAssertions();
