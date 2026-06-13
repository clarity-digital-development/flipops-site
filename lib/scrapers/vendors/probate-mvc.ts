import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { parseSetCookieHeaders, buildCookieHeader } from "../base/cookie-fetch";

// ---------------------------------------------------------------------------
// P-MVC family PROBATE court-case adapter (ASP.NET-MVC "Records Search /
// Inquiry"). M3.1 / Lane D2c.
//
// One config-driven parser → THREE metros: Orange (myeclerk), Pinellas (MyCr),
// Broward (Web2). All three are ASP.NET MVC, mint ASP.NET_SessionId +
// __RequestVerificationToken (anti-CSRF), expose a case-type filter + a
// recording/filing DATE-range, and GATE RESULTS behind a reCAPTCHA v2 on the
// SUBMIT (the form / case-type INDEX is fully listable without solving — only
// the search POST needs a token). This is the highest-leverage probate build:
// 3 of 6 metros, one parser. See .gstack/qa-reports/PROBATE-BUILD-SPEC.md §2.
//
// LEGAL (spec §1): FL probate is governed by Fla. R. Jud. Admin. 2.420 + the
// Probate Rules. The docket INDEX (case #, decedent/estate party, PR/petitioner,
// case type, filing date, status) is PUBLIC and listable. The confidential bits
// are filings WITHIN a case (inventory/assets, certain medical/financial
// attachments). We scrape ONLY the index — never the inventory document — so the
// P-MVC path stays green. Every persisted ProbateCase carries legalRisk:"green".
//
// SESSION GATE (mirrors the Landmark records family):
//   1. GET  https://<host>/<base>/<searchPath>  → mints ASP.NET_SessionId +
//      surfaces the hidden __RequestVerificationToken in the form markup.
//   2. The RVT + cookies travel on the search POST.
//
// SEARCH TRANSPORT (per-portal — the only thing that differs across the family):
//   POST https://<host>/<base>/<searchPostPath>  (form-urlencoded criteria)
//   with the per-portal case-type field + date-range fields + the RVT +
//   g-recaptcha-response token. The response is either an HTML result table
//   (cheerio) or a DataTables JSON envelope; parseProbateResults() handles both,
//   mapping columns by header text with a canonical fallback (same robustness
//   strategy as parseLandmarkResults).
//
// reCAPTCHA v2 GATE: each portal carries a distinct sitekey (see config). When
// no token source is configured (no recaptchaToken + no solveRecaptcha hook) the
// adapter persists 0 and reports outcome="captcha-required" — exactly the
// Landmark situation. It persists the moment a token arrives.
//
// EGRESS: all three are clean direct egress (spec §2). useProxy:false.
// ---------------------------------------------------------------------------

export interface ProbateMvcCounty {
  countyFips: string;
  county: string;
  /** Host only, e.g. "myeclerk.myorangeclerk.com". */
  host: string;
  /** Path prefix WITHOUT trailing slash. "" for Orange; "/MyCr" Pinellas; "/Web2" Broward. */
  basePath: string;
  /** GET path (under base) that mints the session + carries the RVT in markup. */
  searchPath: string;
  /** POST path (under base) the search form submits to. */
  searchPostPath: string;
  /** reCAPTCHA v2 sitekey gating the search submit. */
  recaptchaSitekey: string;
  /** Default egress (all P-MVC are clean direct). */
  useProxy: boolean;
  /**
   * Build the portal-specific search criteria for an estate-admin date-range
   * query. Returns the form params MINUS the RVT + captcha token (those are
   * attached generically by postProbateSearch).
   */
  buildCriteria: (beginDate: Date, endDate: Date) => Record<string, string>;
}

// Estate-admin case types that imply the decedent owned real property (spec §2a
// "acquisition-relevant set"). Orange numeric ids: 10 Formal Administration,
// 22 Summary Admin >$1000, 23 Summary Admin <$1000, 6 Disposition of Personal
// Property w/o Admin, 20 Probate Other. Guardianship/trust are fast-follow.
export const ORANGE_ESTATE_CASE_TYPE_IDS = ["10", "22", "23", "6", "20"];

function mdy(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export const PROBATE_MVC_COUNTIES: ProbateMvcCounty[] = [
  {
    countyFips: "12095",
    county: "Orange",
    host: "myeclerk.myorangeclerk.com",
    basePath: "",
    searchPath: "/Cases/Search",
    searchPostPath: "/Cases/Search",
    recaptchaSitekey: "6LdtOBETAAAAABvi0Md4UUqb7GKfkRiUR6AsrFX-",
    useProxy: false,
    buildCriteria: (begin, end) => ({
      // Orange CaseTypes is a multi-select; serialize one param per id.
      // (URLSearchParams append is done in buildForm — here we collapse to a
      // comma list which the helper expands.)
      CaseTypes: ORANGE_ESTATE_CASE_TYPE_IDS.join(","),
      DateFrom: mdy(begin),
      DateTo: mdy(end),
      CaseNumber: "",
      LastName: "",
      FirstName: "",
      MiddleName: "",
      BusinessName: "",
      WebRequest: "true",
    }),
  },
  // Pinellas (12103) intentionally REMOVED from the captcha adapter — it is now
  // served by the free, captcha-free `pinellas-probate-csv` source (M3.1 / OPS-8,
  // the publicfiles daily-CSV index). Running it through this reCAPTCHA-gated
  // P-MVC path would waste 2captcha solver credits on data we already get for $0.
  {
    countyFips: "12011",
    county: "Broward",
    host: "www.browardclerk.org",
    basePath: "/Web2",
    searchPath: "/CaseSearchECA/Index",
    searchPostPath: "/CaseSearchECA/Search",
    recaptchaSitekey: "6LeomjoqAAAAANqUs56ZxerFIcoUS1qL14rTH4aF",
    useProxy: false,
    buildCriteria: (begin, end) => ({
      // Broward uses probate-specific filing-date fields + a CaseCategoryKeys
      // value of "PR" (=<option value="PR">Probate from the live form).
      CaseCategoryKeys: "PR",
      filingDateOnOrAfterP: mdy(begin),
      filingDateOnOrBeforeP: mdy(end),
      lastName: "",
      firstName: "",
      middleName: "",
      CaseNumber: "",
      BusiName: "",
    }),
  },
];

export function findProbateMvcCounty(countyFips: string): ProbateMvcCounty | undefined {
  return PROBATE_MVC_COUNTIES.find((c) => c.countyFips === countyFips);
}

// ---------------------------------------------------------------------------
// Case-type normalization (raw portal label → caseTypeCode enum string).
// Spec §2: caseTypeCode ∈ FORMAL_ADMIN|SUMMARY_ADMIN|GUARDIANSHIP|
//          DISPOSITION_NO_ADMIN|TRUST|CAVEAT|OTHER
// ---------------------------------------------------------------------------
export function normalizeCaseType(raw: string | undefined): string {
  const t = (raw ?? "").toLowerCase();
  if (/formal\s*admin/.test(t)) return "FORMAL_ADMIN";
  if (/summary\s*admin/.test(t)) return "SUMMARY_ADMIN";
  if (/disposition.*(w\/?o|without)\s*admin|disposition\s*of\s*personal/.test(t)) return "DISPOSITION_NO_ADMIN";
  if (/guardian|conservator|curator/.test(t)) return "GUARDIANSHIP";
  if (/trust/.test(t)) return "TRUST";
  if (/caveat/.test(t)) return "CAVEAT";
  if (/probate|estate|administration/.test(t)) return "FORMAL_ADMIN";
  return "OTHER";
}

/** An estate-administration code implies the decedent likely owned real property. */
export function isEstateAdminCode(code: string | undefined): boolean {
  return code === "FORMAL_ADMIN" || code === "SUMMARY_ADMIN" || code === "DISPOSITION_NO_ADMIN";
}

// ---------------------------------------------------------------------------
// Parsed index row (the public docket index — NOT the confidential inventory).
// ---------------------------------------------------------------------------
export interface ProbateRecord {
  caseNumber: string;
  decedentName: string;
  personalRepresentative?: string;
  caseTypeRaw?: string;
  filedAt?: string;
  status?: string;
}

export interface ProbateScrapeResult {
  countyFips: string;
  county: string;
  /** Why the run produced 0 rows when it did. */
  outcome: "ok" | "captcha-required" | "session-expired" | "blocked" | "empty";
  found: number;
  persisted: number;
  httpStatus: number;
}

// ---------------------------------------------------------------------------
// Session mint (landing GET → ASP.NET_SessionId + __RequestVerificationToken)
// ---------------------------------------------------------------------------

export interface ProbateSession {
  cookieHeader: string;
  /** Hidden anti-CSRF token lifted from the search-form markup. */
  rvt: string;
  origin: string; // https://<host>
  base: string;   // https://<host><basePath>
  useProxy: boolean;
}

function mergeCookies(jar: Map<string, string>, res: Response): void {
  const { cookies } = parseSetCookieHeaders(res.headers);
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
 * Extract the hidden __RequestVerificationToken from the search-form markup.
 * Exported for testing against the saved recon fixtures.
 */
export function extractRvt(html: string): string {
  const m = html.match(
    /name="__RequestVerificationToken"[^>]*\bvalue="([^"]+)"/i,
  ) || html.match(/\bvalue="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
  return m ? m[1] : "";
}

/**
 * Mint a P-MVC session: GET the search page → mint ASP.NET_SessionId + read the
 * RVT. Returns null when the host is unreachable so the caller can record a
 * "blocked" outcome instead of throwing.
 */
export async function mintProbateSession(
  county: ProbateMvcCounty,
  opts?: { useProxy?: boolean },
): Promise<ProbateSession | null> {
  const useProxy = opts?.useProxy ?? county.useProxy;
  const origin = `https://${county.host}`;
  const base = `${origin}${county.basePath}`;
  const jar = new Map<string, string>();

  try {
    const landing = await politeFetch(`${base}${county.searchPath}`, {
      method: "GET",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    mergeCookies(jar, landing);
    const html = await landing.text().catch(() => "");
    if (landing.status >= 400) return null;

    const rvt = extractRvt(html);
    return { cookieHeader: jarToHeader(jar), rvt, origin, base, useProxy };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface ProbateSearchOpts {
  /** A pre-solved reCAPTCHA v2 token to attach as g-recaptcha-response. */
  recaptchaToken?: string;
  /** Lazy solver hook (2captcha/anti-captcha class). Called when no token given. */
  solveRecaptcha?: (sitekey: string, pageUrl: string) => Promise<string>;
}

const CAPTCHA_SENTINEL = /invalid\s*captcha|recaptcha.*(required|failed|verify)/i;
const SESSION_EXPIRED = /session\s*(has\s*)?expired/i;

/** Expand a comma-collapsed multi-select value into repeated params. */
function buildForm(criteria: Record<string, string>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(criteria)) {
    // CaseTypes (Orange) is a multi-select → emit one param per id.
    if (k === "CaseTypes" && v.includes(",")) {
      for (const id of v.split(",")) form.append(k, id);
    } else {
      form.append(k, v);
    }
  }
  return form;
}

async function resolveToken(
  county: ProbateMvcCounty,
  origin: string,
  opts: ProbateSearchOpts,
): Promise<string> {
  if (opts.recaptchaToken) return opts.recaptchaToken;
  if (opts.solveRecaptcha) return opts.solveRecaptcha(county.recaptchaSitekey, `${origin}/`);
  return "";
}

async function postProbateSearch(
  sess: ProbateSession,
  county: ProbateMvcCounty,
  criteria: Record<string, string>,
  token: string,
): Promise<{ status: number; body: string }> {
  const form = buildForm(criteria);
  if (sess.rvt) form.set("__RequestVerificationToken", sess.rvt);
  if (token) form.set("g-recaptcha-response", token);

  const res = await politeFetch(`${sess.base}${county.searchPostPath}`, {
    method: "POST",
    useProxy: sess.useProxy,
    rotateFingerprint: true,
    timeoutMs: 45_000,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/html, */*; q=0.01",
      Referer: `${sess.base}${county.searchPath}`,
      Cookie: sess.cookieHeader,
    },
    body: form.toString(),
  });
  const body = await res.text();
  return { status: res.status, body };
}

/**
 * Estate-admin date-range search for one county. Mirrors searchLandmarkByRecordDate.
 * Returns a captcha/session/blocked outcome rather than throwing so the dispatch
 * layer can audit cleanly.
 */
export async function searchProbateByDateRange(
  sess: ProbateSession,
  county: ProbateMvcCounty,
  beginDate: Date,
  endDate: Date,
  opts: ProbateSearchOpts = {},
): Promise<ProbateScrapeResult> {
  const result: ProbateScrapeResult = {
    countyFips: county.countyFips,
    county: county.county,
    outcome: "ok",
    found: 0,
    persisted: 0,
    httpStatus: 0,
  };

  const token = await resolveToken(county, sess.origin, opts);
  // The portals all gate the submit behind reCAPTCHA. Without a token the POST
  // returns "Invalid Captcha" — short-circuit so the audit is honest.
  if (!token) return { ...result, outcome: "captcha-required" };

  const criteria = county.buildCriteria(beginDate, endDate);
  const { status, body } = await postProbateSearch(sess, county, criteria, token);
  result.httpStatus = status;

  if (CAPTCHA_SENTINEL.test(body)) return { ...result, outcome: "captcha-required" };
  if (SESSION_EXPIRED.test(body)) return { ...result, outcome: "session-expired" };
  if (status >= 400) return { ...result, outcome: "blocked" };

  const rows = parseProbateResults(body);
  result.found = rows.length;

  void captureRaw({
    entityType: "owner",
    source: "probate",
    sourceTag: `scraper:probate-mvc-${county.countyFips}`,
    category: "probate_court_index",
    countyFips: county.countyFips,
    requestParams: { criteria, postPath: county.searchPostPath },
    rawResponse: { extracted: rows, bodyBytes: body.length, bodySample: body.slice(0, 30_000) },
    legalRisk: "green", // index-only path — spec §1
  });

  for (const r of rows) {
    result.persisted += await persistProbateCase(county, r);
  }

  if (result.found === 0) result.outcome = "empty";
  return result;
}

/**
 * Convenience end-to-end: mint session → estate-admin date-range search for one
 * county. Returns session-expired / captcha / blocked outcome rather than
 * throwing so the dispatch layer can audit cleanly.
 */
export async function scrapeProbateRecords(opts: {
  countyFips: string;
  beginDate: Date;
  endDate: Date;
  useProxy?: boolean;
  recaptchaToken?: string;
  solveRecaptcha?: (sitekey: string, pageUrl: string) => Promise<string>;
}): Promise<ProbateScrapeResult> {
  const county = findProbateMvcCounty(opts.countyFips);
  if (!county) throw new Error(`probate-mvc: unknown countyFips ${opts.countyFips}`);

  const blocked: ProbateScrapeResult = {
    countyFips: county.countyFips,
    county: county.county,
    outcome: "blocked",
    found: 0,
    persisted: 0,
    httpStatus: 0,
  };

  const sess = await mintProbateSession(county, { useProxy: opts.useProxy });
  if (!sess) return blocked;

  return searchProbateByDateRange(sess, county, opts.beginDate, opts.endDate, {
    recaptchaToken: opts.recaptchaToken,
    solveRecaptcha: opts.solveRecaptcha,
  });
}

// ---------------------------------------------------------------------------
// Parser — P-MVC result fragment/JSON → ProbateRecord[]
//
// The search POST returns EITHER an HTML result <table> (cheerio path) OR a
// DataTables JSON envelope ({ data: [...] } / { aaData: [...] }). We handle both
// and map columns by <thead> header text with a canonical fallback — same
// robustness strategy as parseLandmarkResults, because the column ORDER varies
// per portal theme. Index fields only — case #, decedent/party, PR, case type,
// filing date, status. Never the confidential inventory.
// ---------------------------------------------------------------------------

interface ColMap {
  caseNumber?: number;
  decedent?: number;
  party?: number;
  pr?: number;
  caseType?: number;
  filedAt?: number;
  status?: number;
}

function headerToKey(text: string): keyof ColMap | null {
  const t = text.toLowerCase();
  if (/case\s*(number|no|#)|uniform\s*case/.test(t)) return "caseNumber";
  if (/decedent|deceased|estate\s*of/.test(t)) return "decedent";
  if (/personal\s*rep|petitioner|executor|administrator|guardian|\bpr\b/.test(t)) return "pr";
  if (/party|name|defendant|respondent/.test(t)) return "party";
  if (/case\s*type|type|description|charge/.test(t)) return "caseType";
  if (/file\s*date|filed|date\s*filed|filing\s*date|open\s*date/.test(t)) return "filedAt";
  if (/status|disposition/.test(t)) return "status";
  return null;
}

const CANONICAL: ColMap = {
  caseNumber: 0, decedent: 1, caseType: 2, filedAt: 3, status: 4, pr: 5,
};

/** Map a DataTables JSON row object's keys → ProbateRecord. */
function jsonRowToRecord(row: Record<string, unknown>): ProbateRecord | null {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of Object.keys(row)) {
      const lk = k.toLowerCase();
      if (keys.some((want) => lk.includes(want))) {
        const v = row[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
    return undefined;
  };
  const caseNumber = pick("casenumber", "caseno", "uniformcase", "case");
  if (!caseNumber) return null;
  const decedent =
    pick("decedent", "deceased", "estateof", "style", "partyname", "name") ?? "";
  return {
    caseNumber,
    decedentName: decedent,
    personalRepresentative: pick("personalrep", "petitioner", "executor", "administrator", "guardian", "pr"),
    caseTypeRaw: pick("casetype", "type", "description"),
    filedAt: pick("filedate", "filed", "filingdate", "opendate", "datefiled"),
    status: pick("status", "disposition"),
  };
}

export function parseProbateResults(body: string): ProbateRecord[] {
  const trimmed = body.trim();

  // (1) DataTables JSON envelope.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const arr: unknown[] = Array.isArray(parsed)
        ? parsed
        : ((parsed as { data?: unknown[]; aaData?: unknown[]; Results?: unknown[]; results?: unknown[] }).data ??
           (parsed as { aaData?: unknown[] }).aaData ??
           (parsed as { Results?: unknown[] }).Results ??
           (parsed as { results?: unknown[] }).results ??
           []);
      const out: ProbateRecord[] = [];
      for (const row of arr) {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          const rec = jsonRowToRecord(row as Record<string, unknown>);
          if (rec) out.push(rec);
        }
      }
      if (out.length) return out;
    } catch {
      // fall through to HTML path
    }
  }

  // (2) HTML result table.
  const $ = cheerio.load(body);

  // Map a table's header cells (thead th, else first-row th) → ColMap.
  // Takes the cheerio-wrapped <table> selection (avoids naming the DOM element
  // type, which cheerio doesn't re-export in this version).
  const mapHeaders = ($t: ReturnType<typeof $>): ColMap => {
    const m: ColMap = {};
    let $h = $t.find("thead th");
    if ($h.length === 0) $h = $t.find("tr").first().find("th");
    $h.each((i, th) => {
      const key = headerToKey($(th).text().trim());
      if (key && m[key] === undefined) m[key] = i;
    });
    return m;
  };

  let $table = $("#searchResultsGrid, #resultsTable, #CaseSearchResults, table.dataTable").first();
  let map: ColMap = $table.length ? mapHeaders($table) : {};

  // Header-bearing generic finder: only accept a table whose header row maps a
  // CASE-NUMBER column — the non-negotiable anchor of a docket result grid. This
  // stops an incidental legend table (Broward's "Case Prefix / Court Type /
  // Example" reference grid in the recon fixtures, whose "Court Type" header
  // loosely matches the case-type pattern but has NO case-number column) from
  // being mistaken for a result grid and fabricating rows.
  if ($table.length === 0) {
    $("table").each((_, el) => {
      if ($table.length) return;
      const $el = $(el);
      const m = mapHeaders($el);
      if (m.caseNumber !== undefined) {
        $table = $el;
        map = m;
      }
    });
  }

  // Last-resort fallback: the very first table on the page when NOTHING above
  // matched. Dangerous path (captcha/session-expired/form pages carry legend
  // tables) — flagged so we require digit-bearing case numbers below.
  let headerlessFallback = false;
  if ($table.length === 0) {
    $table = $("table").first();
    headerlessFallback = true;
  }
  if ($table.length === 0) return [];

  const $headers = $table.find("thead th");
  const effective: ColMap = Object.keys(map).length >= 2 ? map : { ...CANONICAL, ...map };

  const records: ProbateRecord[] = [];
  const bodyRows = $table.find("tbody tr").length
    ? $table.find("tbody tr")
    : $table.find("tr").slice($headers.length ? 1 : 0);

  bodyRows.each((_, tr) => {
    const cells = $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length < 2) return;
    const at = (idx?: number): string | undefined =>
      idx !== undefined && idx < cells.length ? cells[idx] || undefined : undefined;

    // Case number may be wrapped in an <a> link — cheerio .text() already
    // unwraps it, so plain cell text is fine.
    const caseNumber = at(effective.caseNumber);
    if (!caseNumber || /^\s*$/.test(caseNumber)) return; // spacer / no-results row
    // Headerless last-resort fallback only: a real clerk case number always
    // carries a digit (year/sequence). Reject digit-free col0 values so an
    // incidental legend table on a form/captcha page can't fabricate rows.
    if (headerlessFallback && !/\d/.test(caseNumber)) return;

    const decedent = at(effective.decedent) ?? at(effective.party) ?? "";
    records.push({
      caseNumber: caseNumber.trim(),
      decedentName: decedent,
      personalRepresentative: at(effective.pr),
      caseTypeRaw: at(effective.caseType),
      filedAt: at(effective.filedAt),
      status: at(effective.status),
    });
  });

  return records;
}

// ---------------------------------------------------------------------------
// Decedent-name normalization (spec §3) — shared by the matcher.
//
// 1. Uppercase; strip punctuation/extra whitespace.
// 2. Drop suffixes (JR/SR/II/III/IV) + decedent tails (ESTATE OF / DECEASED /
//    ET AL / A/K/A). Entity tails (LLC/INC/TRUST/...) are NOT stripped here —
//    they're handled by the matcher (a "John Smith Revocable Trust" parcel can
//    still STRONG-match decedent "John Smith" via name-core).
// 3. Reduce to a canonical "LAST FIRST MIDDLE" token string. FL rolls store
//    ownerName mostly LAST-first; we normalize both sides identically so a
//    direct string compare works regardless of input ordering.
// ---------------------------------------------------------------------------

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);
const DECEDENT_TAILS = /\b(ESTATE\s+OF|THE\s+ESTATE\s+OF|DECEASED|DCSD|ET\s+AL|A\/K\/A|AKA|N\/K\/A|F\/K\/A)\b/g;

export function normalizeDecedentName(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw
    .toUpperCase()
    .replace(DECEDENT_TAILS, " ")
    .replace(/[.,'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip a trailing suffix token.
  const toks = s.split(" ").filter((t) => t && !NAME_SUFFIXES.has(t));
  s = toks.join(" ");
  return s;
}

// ---------------------------------------------------------------------------
// Persistence — upsert ProbateCase (unique countyFips+caseNumber)
// ---------------------------------------------------------------------------

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A status string that signals the PR/letters-of-administration milestone. */
function inferPrAppointedAt(r: ProbateRecord): Date | null {
  // Without per-filing docket access we cannot know the letters-issued date.
  // Heuristic: if a PR is named in the index AND the case status is OPEN/ACTIVE,
  // treat the filing date as a lower bound for the peak-motivation window. The
  // matcher/rescore can refine this when richer docket fields land. Returning
  // null here keeps prAppointedAt honest (only set when explicitly known).
  return null;
}

export async function persistProbateCase(
  county: ProbateMvcCounty,
  r: ProbateRecord,
): Promise<number> {
  if (!r.caseNumber) return 0;
  const caseTypeCode = normalizeCaseType(r.caseTypeRaw);
  const filedAt = parseDate(r.filedAt);
  const decedentNameNormalized = normalizeDecedentName(r.decedentName);
  const source = `probate:${county.county.toLowerCase()}-mvc`;
  const status = r.status?.trim() || (r.filedAt ? "OPEN" : null);

  try {
    await prisma.probateCase.upsert({
      where: { countyFips_caseNumber: { countyFips: county.countyFips, caseNumber: r.caseNumber } },
      create: {
        countyFips: county.countyFips,
        caseNumber: r.caseNumber,
        decedentName: r.decedentName || "(unknown)",
        decedentNameNormalized: decedentNameNormalized || null,
        personalRepresentative: r.personalRepresentative ?? null,
        caseTypeRaw: r.caseTypeRaw ?? null,
        caseTypeCode,
        filedAt,
        status,
        prAppointedAt: inferPrAppointedAt(r),
        source,
      },
      update: {
        decedentName: r.decedentName || undefined,
        decedentNameNormalized: decedentNameNormalized || undefined,
        personalRepresentative: r.personalRepresentative ?? undefined,
        caseTypeRaw: r.caseTypeRaw ?? undefined,
        caseTypeCode,
        filedAt: filedAt ?? undefined,
        status: status ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[probate-mvc] persist failed:", (err as Error).message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Inline self-test — runs only on direct `tsx probate-mvc.ts` invocation.
// Validates the parser (HTML header-mapped + canonical-fallback + JSON
// envelope), case-type + name normalization, and RVT extraction against the
// SAVED RECON FIXTURES, since the live result HTML is reCAPTCHA-gated.
// ---------------------------------------------------------------------------

function _runInlineAssertions(): void {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const assert = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  // (a) HTML header-mapped parse, non-canonical order.
  {
    const html = `
      <table id="resultsTable"><thead><tr>
        <th>Case Number</th><th>Case Type</th><th>Decedent Name</th>
        <th>Personal Representative</th><th>Date Filed</th><th>Status</th>
      </tr></thead><tbody>
        <tr><td><a href="/x">2026-CP-001234</a></td><td>Formal Administration</td><td>SMITH, JOHN A</td>
            <td>SMITH JANE</td><td>06/02/2026</td><td>OPEN</td></tr>
        <tr><td>2026-CP-001235</td><td>Summary Administration >$1000</td><td>DOE MARY</td>
            <td>DOE ROBERT</td><td>06/03/2026</td><td>OPEN</td></tr>
      </tbody></table>`;
    const rows = parseProbateResults(html);
    assert("html: 2 rows", rows.length === 2, `got ${rows.length}`);
    assert("html: caseNumber unwrapped from <a>", rows[0].caseNumber === "2026-CP-001234", rows[0].caseNumber);
    assert("html: decedent mapped", rows[0].decedentName === "SMITH, JOHN A", rows[0].decedentName);
    assert("html: PR mapped", rows[0].personalRepresentative === "SMITH JANE", rows[0].personalRepresentative);
    assert("html: caseType mapped", rows[0].caseTypeRaw === "Formal Administration", rows[0].caseTypeRaw);
    assert("html: filedAt mapped", rows[0].filedAt === "06/02/2026", rows[0].filedAt);
  }

  // (b) Canonical-fallback parse (no headers).
  {
    const html = `<table><tbody>
      <tr><td>2026-CP-009999</td><td>JONES BOB</td><td>Disposition of Personal Property without Administration</td><td>06/05/2026</td><td>OPEN</td><td>JONES SUE</td></tr>
    </tbody></table>`;
    const rows = parseProbateResults(html);
    assert("fallback: 1 row", rows.length === 1, `got ${rows.length}`);
    assert("fallback: caseNumber col0", rows[0].caseNumber === "2026-CP-009999", rows[0].caseNumber);
    assert("fallback: decedent col1", rows[0].decedentName === "JONES BOB", rows[0].decedentName);
  }

  // (c) DataTables JSON envelope.
  {
    const json = JSON.stringify({
      data: [
        { CaseNumber: "482026CP001111", DecedentName: "BROWN, ALICE", PersonalRepresentative: "BROWN TOM", CaseType: "Caveat by Creditor", FileDate: "06/01/2026", Status: "OPEN" },
        { caseNo: "482026CP002222", style: "GREEN, PETER", caseType: "Guardianship", filingDate: "06/04/2026" },
      ],
    });
    const rows = parseProbateResults(json);
    assert("json: 2 rows", rows.length === 2, `got ${rows.length}`);
    assert("json: caseNumber via CaseNumber key", rows[0].caseNumber === "482026CP001111", rows[0].caseNumber);
    assert("json: decedent via DecedentName key", rows[0].decedentName === "BROWN, ALICE", rows[0].decedentName);
    assert("json: caseNumber via caseNo fallback", rows[1].caseNumber === "482026CP002222", rows[1].caseNumber);
    assert("json: decedent via style fallback", rows[1].decedentName === "GREEN, PETER", rows[1].decedentName);
  }

  // (d) Case-type normalization.
  {
    assert("ct: formal admin", normalizeCaseType("Formal Administration") === "FORMAL_ADMIN");
    assert("ct: summary admin", normalizeCaseType("Summary Administration >$1000") === "SUMMARY_ADMIN");
    assert("ct: disposition", normalizeCaseType("Disposition of Personal Property without Administration") === "DISPOSITION_NO_ADMIN");
    assert("ct: guardianship", normalizeCaseType("Guardianship Total") === "GUARDIANSHIP");
    assert("ct: trust", normalizeCaseType("Trust") === "TRUST");
    assert("ct: caveat", normalizeCaseType("Caveat by Creditor") === "CAVEAT");
    assert("ct: probate other → formal", normalizeCaseType("Probate Other") === "FORMAL_ADMIN");
    assert("ct: unknown → other", normalizeCaseType("Auto Negligence") === "OTHER");
    assert("estate-admin code: formal", isEstateAdminCode("FORMAL_ADMIN") === true);
    assert("estate-admin code: guardianship not estate", isEstateAdminCode("GUARDIANSHIP") === false);
  }

  // (e) Decedent-name normalization.
  {
    assert("name: estate-of stripped", normalizeDecedentName("Estate of John A. Smith, Jr.") === "JOHN A SMITH", normalizeDecedentName("Estate of John A. Smith, Jr."));
    assert("name: deceased + suffix stripped", normalizeDecedentName("DOE, MARY III DECEASED") === "DOE MARY", normalizeDecedentName("DOE, MARY III DECEASED"));
    assert("name: aka stripped", normalizeDecedentName("BROWN ALICE A/K/A ALICE B") === "BROWN ALICE ALICE B", normalizeDecedentName("BROWN ALICE A/K/A ALICE B"));
    assert("name: empty in → empty out", normalizeDecedentName(undefined) === "");
  }

  // (f) RVT extraction (both attribute orderings) + sentinel detection.
  {
    const a = extractRvt(`<input name="__RequestVerificationToken" type="hidden" value="ABC-123_xyz" />`);
    assert("rvt: name-then-value", a === "ABC-123_xyz", a);
    const b = extractRvt(`<input type="hidden" value="VAL-456" name="__RequestVerificationToken" />`);
    assert("rvt: value-then-name", b === "VAL-456", b);
    assert("captcha sentinel", CAPTCHA_SENTINEL.test("Invalid Captcha"));
    assert("session-expired sentinel", SESSION_EXPIRED.test("<title>Session Has Expired</title>"));
    assert("captcha body → 0 rows", parseProbateResults("Invalid Captcha").length === 0);
  }

  // (g) County config sanity.
  {
    assert("config: 2 counties", PROBATE_MVC_COUNTIES.length === 2, String(PROBATE_MVC_COUNTIES.length));
    assert("config: orange found", findProbateMvcCounty("12095")?.county === "Orange");
    assert("config: pinellas removed (now via free CSV)", findProbateMvcCounty("12103") === undefined);
    assert("config: broward found", findProbateMvcCounty("12011")?.county === "Broward");
    const oc = findProbateMvcCounty("12095")!.buildCriteria(new Date(2026, 5, 1), new Date(2026, 5, 8));
    assert("config: orange CaseTypes estate set", oc.CaseTypes === "10,22,23,6,20", oc.CaseTypes);
    assert("config: orange DateFrom mdy", oc.DateFrom === "6/1/2026", oc.DateFrom);
  }

  // (h) Recon-fixture validation (live curl probes 2026-06-11). The fixtures are
  // search-FORM pages (results are reCAPTCHA-gated), so the contract we can pin
  // without a token is: (1) the RVT mints from the real P-MVC markup, and (2) the
  // parser does NOT fabricate rows from the incidental legend/reference tables on
  // those form pages (Broward's "Case Prefix / Court Type / Example" grid is the
  // trap). Skips cleanly when the qa-reports dir isn't checked out.
  {
    let fixtureDir: string | null = null;
    let readFn: ((p: string) => string) | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("node:fs") as typeof import("node:fs");
      const candidate = ".gstack/qa-reports/probate-recon";
      if (fs.existsSync(candidate)) {
        fixtureDir = candidate;
        readFn = (p: string) => fs.readFileSync(p, "utf8");
      }
    } catch {
      /* fs unavailable — skip */
    }

    if (fixtureDir && readFn) {
      const read = readFn;
      const dir = fixtureDir;
      const load = (name: string): string | null => {
        try {
          return read(`${dir}/${name}`);
        } catch {
          return null;
        }
      };
      // RVT mints from each real P-MVC form fixture (the load-bearing session piece).
      for (const [name, county] of [
        ["probe-orange-court.html", "Orange"],
        ["probe-broward-court.html", "Broward"],
        // Pinellas dropped — now served by the free pinellas-probate-csv source.
      ] as const) {
        const html = load(name);
        if (html == null) {
          assert(`fixture ${county}: present`, false, `${name} missing`);
          continue;
        }
        const rvt = extractRvt(html);
        assert(`fixture ${county}: RVT minted`, rvt.length > 20, `len=${rvt.length}`);
        // Form pages carry NO result grid → parser must yield 0 (no legend fabrication).
        const rows = parseProbateResults(html);
        assert(`fixture ${county}: no fabricated rows from form page`, rows.length === 0, `got ${rows.length}`);
      }
    } else {
      // Not a failure — recon fixtures aren't part of the runtime bundle.
      assert("fixtures: skipped (qa-reports not checked out)", true);
    }
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
  /probate-mvc(\.[tj]s)?$/.test(process.argv[1]);
if (_isMain) _runInlineAssertions();
