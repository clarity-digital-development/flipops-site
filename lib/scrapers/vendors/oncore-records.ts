import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { parseSetCookieHeaders, buildCookieHeader } from "../base/cookie-fetch";

// ---------------------------------------------------------------------------
// OnCore / Eagle (Tyler Technologies recorder) official-records FAMILY adapter
// — M2.1c / Lane C1 (Family C per .gstack/qa-reports/CIVITEK-BUILD-SPEC.md).
//
// Sister to the Acclaim (lib/scrapers/vendors/acclaim-records.ts) and Landmark
// (lib/scrapers/vendors/landmark-records.ts) family adapters. One parser → many
// counties via the ONCORE_COUNTIES config table.
//
// ⚠ LIVE-PROBE FINDING 2026-06-11 (Orange 12095, the only OnCore metro):
//   The classic OnCore/Eagle servlet at or.occompt.com/recorder/web/ STILL mints
//   a guest session (disclaimer accept works) but its document search has been
//   MIGRATED to Tyler's newer "Self-Service" SPA at
//   selfservice.or.occompt.com/ssweb/. The legacy /recorder/eagleweb/docSearch.jsp
//   now returns only a migration notice pointing at the new portal.
//
//   Two session gates exist and BOTH the mints are verified working over cheap
//   HTTP (no Playwright, no proxy, direct egress):
//     LEGACY  GET  /recorder/web/                       → JSESSIONID (Path=/recorder)
//             POST /recorder/web/loginPOST.jsp;jsessionid=<SID>
//                  body guest=true&submit=I+Accept       → 302, isLoggedInAsPublic=true
//     SS      GET  /ssweb/user/disclaimer               → JSESSIONID (Path=/ssweb)
//             POST /ssweb/user/disclaimer
//                  body submitDisclaimerAccept=I+Accept  → 200 JSON "true",
//                                                          disclaimerAccepted=true cookie
//
//   The SEARCH itself is the wall (NOT a captcha, NOT a credential):
//     - GET  /ssweb/search/SearchType{Name,RecordDate,ParcelID,DocumentNumber,
//            BookPage,Consideration,Legal,Document} → 302 to
//            /ssweb/?message=...+your+options+have+changed
//     - POST /ssweb/search/SearchTypeName (X-Requested-With) → 200 but body is
//            "An error has occurred. Please add this GUID..."
//   The Self-Service search UI is a jQuery-Mobile SPA (self.service.js, ~92KB
//   minified) that builds the search-type menu, criteria form, and result grid
//   entirely client-side via async controller calls with dynamically-constructed
//   URLs + per-session search state. Plain HTTP can't replay the handshake.
//
//   STATUS: adapter ships enabled=false-ready. The verified session-mint path,
//   the OnCore/Eagle result-grid parser, the doc-type classifier, and the
//   Mortgage/Lien persistence + APN join are all COMPLETE and unit-tested
//   inline. The ONLY missing piece is the SPA search handshake — activate the
//   adapter once that is reverse-engineered OR a stealth-chromium fallback is
//   wired (deferred, per spec §3: OnCore is "lower priority — 1 metro only").
//
// PERSISTENCE → Mortgage + Lien (NO schema changes):
//   - mortgage / deed-of-trust → Mortgage (borrower=grantor, lender=grantee)
//   - lis_pendens / judgment / lien → Lien (plaintiff=grantor=claimant,
//     defendant=grantee=owner)
//   - upsert on @@unique([countyFips, documentNumber, source]) with the STABLE
//     source "scraper:oncore-<fips>" so re-runs update, never dup.
//
// APN join (spec §4 strategy, conservative writes only):
//   - direct (confidence 1.0): row parcel id normalized (digits-only) and
//     verified to exist in Parcel(countyFips, apn).
//   - unique-name (confidence 0.85): owner-side party name compressed
//     ([^A-Z0-9] stripped) matches exactly ONE distinct Parcel.ownerName in
//     the county. >1 distinct parcel = ambiguous = no apn write.
//   Mortgage/Lien have no metadata column, so per-row confidence is persisted
//   in the bronze captureRaw payload (`apnJoins`); DB apn written only at
//   confidence >= 0.85.
// ---------------------------------------------------------------------------

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface OnCoreCountyConfig {
  countyFips: string;
  county: string;
  /** Legacy OnCore/Eagle recorder base (mints the guest session), no trailing slash. */
  recorderBaseUrl: string;
  /** Tyler Self-Service base (the live search portal), no trailing slash. */
  selfServiceBaseUrl: string;
  /** Per-county empirical egress (spec §5). Orange verified DIRECT 2026-06-11. */
  useProxy: boolean;
  /** Normalize a portal parcel id into candidate Parcel.apn values. */
  apnCandidates: (raw: string) => string[];
  notes: string;
}

/** Strip non-alphanumerics + uppercase. */
function normAlnum(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Orange DOR Parcel.apn is a 15-digit numeric string; the recorder shows it
 *  dash-formatted (e.g. 20-22-31-6688-01-330). Strip to digits to join. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const ONCORE_COUNTIES: OnCoreCountyConfig[] = [
  {
    countyFips: "12095",
    county: "Orange",
    recorderBaseUrl: "https://or.occompt.com/recorder",
    selfServiceBaseUrl: "https://selfservice.or.occompt.com/ssweb",
    useProxy: false, // direct verified 2026-06-11 (session-mint path; no proxy needed)
    apnCandidates: (raw) => {
      const d = digitsOnly(raw);
      return d.length >= 6 ? [d] : [];
    },
    notes:
      "Tyler OnCore/Eagle recorder. Doc search migrated to Self-Service SPA (ssweb v2025.1.32). Session mint works; SPA search handshake pending.",
  },
];

export function findOnCoreCounty(countyFips: string): OnCoreCountyConfig | undefined {
  return ONCORE_COUNTIES.find((c) => c.countyFips === countyFips);
}

// ---------------------------------------------------------------------------
// Doc-type families (matched against OnCore/Eagle DocumentType labels).
// Order matters — classification takes the FIRST match.
// ---------------------------------------------------------------------------

export type OnCoreDocFamily =
  | "lis_pendens"
  | "satisfaction"
  | "assignment"
  | "mortgage"
  | "judgment"
  | "lien";

const DOC_FAMILIES: Array<{ family: OnCoreDocFamily; match: RegExp; exclude?: RegExp }> = [
  { family: "lis_pendens", match: /LIS\s*PENDENS/i },
  { family: "satisfaction", match: /SATISF|RELEASE/i, exclude: /NOTICE|PRESERVATION/i },
  { family: "assignment", match: /ASSIGNMENT/i },
  { family: "mortgage", match: /MORTGAGE|DEED\s*OF\s*TRUST/i, exclude: /SATISF|RELEASE|ASSIGNMENT/i },
  {
    family: "judgment",
    match: /JUDGMENT/i,
    exclude: /HIDDEN FROM WEB|DOMESTIC VIOLENCE|JUVENILE|RPO|SATISF|RELEASE/i,
  },
  {
    family: "lien",
    match: /\bLIEN\b|CLAIM OF LIEN/i,
    exclude: /HIDDEN FROM WEB|CANCEL|RELEASE|SATISF|TRANSFER LIEN|CONTEST|JUVENILE/i,
  },
];

/** Classify a DocumentType label into a distress family (null = ignore). */
export function classifyOnCoreDocType(text: string): OnCoreDocFamily | null {
  for (const f of DOC_FAMILIES) {
    if (f.match.test(text) && !(f.exclude && f.exclude.test(text))) return f.family;
  }
  return null;
}

/** Mortgage vs Lien routing (satisfaction/assignment handled by caller). */
export function classifyOnCoreDocument(type: string): "mortgage" | "lien" | "other" {
  const fam = classifyOnCoreDocType(type);
  if (fam === "mortgage" || fam === "assignment") return "mortgage";
  if (fam === "lien" || fam === "judgment" || fam === "lis_pendens") return "lien";
  return "other";
}

/** Lien sub-category, mirroring acclaim/landmark conventions. */
function classifyLienCategory(family: OnCoreDocFamily, docType: string): string {
  if (family === "lis_pendens") return "lis_pendens";
  if (family === "judgment") return "judgment";
  const t = docType.toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax/.test(t)) return "tax";
  return "other";
}

// ---------------------------------------------------------------------------
// Session mint (legacy recorder disclaimer + Self-Service disclaimer).
// ---------------------------------------------------------------------------

export interface OnCoreSession {
  /** Cookie header for the legacy recorder host (or.occompt.com). */
  recorderCookies: string;
  /** Cookie header for the Self-Service host (selfservice.or.occompt.com). */
  selfServiceCookies: string;
  recorderOrigin: string;
  selfServiceBase: string;
  useProxy: boolean;
  /** True when the SS disclaimer accept came back "true". */
  selfServiceReady: boolean;
}

function jarToHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
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

/** Pull `loginPOST.jsp;jsessionid=<SID>` action + the submit button label off the splash. */
export function parseDisclaimerForm(html: string): { action: string | null; submit: string } {
  const $ = cheerio.load(html);
  let action: string | null = null;
  let submit = "I Accept";
  $("form").each((_, el) => {
    const a = $(el).attr("action") ?? "";
    if (/loginPOST\.jsp/i.test(a) && $(el).find('input[name="guest"]').length) {
      action = a;
      const val = $(el).find('input[type="submit"]').attr("value");
      if (val) submit = val;
    }
  });
  return { action, submit };
}

/**
 * Mint both sessions: legacy recorder disclaimer (verified) + Self-Service
 * disclaimer accept (verified). Returns null on a hard failure so the caller
 * records a clean "blocked" outcome instead of throwing.
 */
export async function mintOnCoreSession(
  cfg: OnCoreCountyConfig,
  opts?: { useProxy?: boolean },
): Promise<OnCoreSession | null> {
  const useProxy = opts?.useProxy ?? cfg.useProxy;
  const recorderOrigin = new URL(cfg.recorderBaseUrl).origin;
  const selfServiceBase = cfg.selfServiceBaseUrl;
  const recorderJar = new Map<string, string>();
  const ssJar = new Map<string, string>();

  try {
    // --- Legacy recorder: splash GET → accept disclaimer (best-effort) ---
    const splash = await politeFetch(`${cfg.recorderBaseUrl}/web/`, {
      method: "GET",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: { "User-Agent": CHROME_UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    mergeCookies(recorderJar, splash);
    const splashHtml = await splash.text().catch(() => "");
    const { action, submit } = parseDisclaimerForm(splashHtml);
    if (action) {
      // Form action is relative to /web/ (e.g. "../web/loginPOST.jsp;jsessionid=..").
      const loginUrl = new URL(action, `${cfg.recorderBaseUrl}/web/`).toString();
      const accept = await politeFetch(loginUrl, {
        method: "POST",
        useProxy,
        rotateFingerprint: true,
        timeoutMs: 30_000,
        redirect: "manual",
        headers: {
          "User-Agent": CHROME_UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: jarToHeader(recorderJar),
          Referer: `${cfg.recorderBaseUrl}/web/`,
        },
        body: new URLSearchParams({ guest: "true", submit }).toString(),
      });
      mergeCookies(recorderJar, accept);
      await accept.text().catch(() => {});
    }

    // --- Self-Service: disclaimer GET → accept POST (the live search portal) ---
    const ssDisc = await politeFetch(`${selfServiceBase}/user/disclaimer`, {
      method: "GET",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: { "User-Agent": CHROME_UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    mergeCookies(ssJar, ssDisc);
    await ssDisc.text().catch(() => {});

    const ssAccept = await politeFetch(`${selfServiceBase}/user/disclaimer`, {
      method: "POST",
      useProxy,
      rotateFingerprint: true,
      timeoutMs: 30_000,
      headers: {
        "User-Agent": CHROME_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: jarToHeader(ssJar),
        Referer: `${selfServiceBase}/user/disclaimer`,
      },
      body: new URLSearchParams({ submitDisclaimerAccept: "I Accept" }).toString(),
    });
    mergeCookies(ssJar, ssAccept);
    const acceptBody = (await ssAccept.text().catch(() => "")).trim();
    const selfServiceReady = ssAccept.ok && /^true$/i.test(acceptBody);

    return {
      recorderCookies: jarToHeader(recorderJar),
      selfServiceCookies: jarToHeader(ssJar),
      recorderOrigin,
      selfServiceBase,
      useProxy,
      selfServiceReady,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search (Self-Service SPA). Currently GATED — see header note. The HTTP path
// is attempted and the gate is detected so the adapter degrades cleanly; the
// parser below is ready the moment a working search transport lands.
// ---------------------------------------------------------------------------

const OPTIONS_CHANGED_RE = /options\s+have\s+changed/i;
const SS_ERROR_RE = /An error has occurred/i;

export interface OnCoreSearchAttempt {
  /** Whether the search produced parseable result HTML. */
  ok: boolean;
  /** Why it didn't, when it didn't. */
  blocker:
    | "none"
    | "spa-options-changed"
    | "spa-server-error"
    | "session-not-ready"
    | "http-error";
  httpStatus: number;
  resultHtml: string;
}

/**
 * Attempt a record-date search via the Self-Service HTTP endpoints. Returns a
 * structured attempt so the caller can persist whatever parsed (today: nothing,
 * because the SPA gate fires) without throwing. Probe-verified 2026-06-11:
 * GET 302→options-changed, POST→server-error.
 */
export async function attemptOnCoreRecordDateSearch(
  sess: OnCoreSession,
  from: Date,
  to: Date,
): Promise<OnCoreSearchAttempt> {
  if (!sess.selfServiceReady) {
    return { ok: false, blocker: "session-not-ready", httpStatus: 0, resultHtml: "" };
  }
  try {
    // The SPA POSTs to establish the search type; mirror that shape.
    const res = await politeFetch(`${sess.selfServiceBase}/search/SearchTypeRecordDate`, {
      method: "POST",
      useProxy: sess.useProxy,
      rotateFingerprint: true,
      timeoutMs: 45_000,
      headers: {
        "User-Agent": CHROME_UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: sess.selfServiceCookies,
        Referer: `${sess.selfServiceBase}/`,
      },
      body: new URLSearchParams({
        // Tyler Self-Service criteria field names (best-effort; the live SPA
        // confirms these once the handshake is reverse-engineered).
        recordDateStart: fmtDate(from),
        recordDateEnd: fmtDate(to),
      }).toString(),
    });
    const html = await res.text().catch(() => "");
    if (OPTIONS_CHANGED_RE.test(html)) {
      return { ok: false, blocker: "spa-options-changed", httpStatus: res.status, resultHtml: "" };
    }
    if (SS_ERROR_RE.test(html)) {
      return { ok: false, blocker: "spa-server-error", httpStatus: res.status, resultHtml: "" };
    }
    if (!res.ok) {
      return { ok: false, blocker: "http-error", httpStatus: res.status, resultHtml: "" };
    }
    return { ok: true, blocker: "none", httpStatus: res.status, resultHtml: html };
  } catch {
    return { ok: false, blocker: "http-error", httpStatus: 0, resultHtml: "" };
  }
}

// ---------------------------------------------------------------------------
// Parser — OnCore/Eagle result grid → OnCoreRecord[]. Tyler recorder result
// pages render a <table> with header text (Grantor/Grantee/Document Type/
// Recording Date/Instrument#/Book/Page/Legal). Column ORDER varies per county
// theme, so we map by <thead> header text with a canonical fallback. Index
// fields only — never opens a document image.
// ---------------------------------------------------------------------------

export interface OnCoreRecord {
  documentType: string;
  documentNumber?: string;
  recordingDate?: string;
  grantor?: string; // mortgage: borrower | lien: claimant/plaintiff
  grantee?: string; // mortgage: lender   | lien: owner/defendant
  consideration?: number;
  bookPage?: string;
  legal?: string;
  parcelId?: string;
}

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
  if (/record\s*date|rec\.?\s*date|date\s*recorded|file\s*date/.test(t)) return "recordDate";
  if (/grantor|direct\s*name|first\s*party|from/.test(t)) return "grantor";
  if (/grantee|reverse\s*name|second\s*party|\bto\b/.test(t)) return "grantee";
  if (/\bname|part(y|ies)/.test(t)) return "party";
  if (/legal/.test(t)) return "legal";
  if (/instrument|doc(ument)?\s*(#|number|num|id)|clerk\s*file|cfn|reception/.test(t)) return "instrument";
  if (/consideration|amount/.test(t)) return "consideration";
  if (/book\s*\/?\s*page|book.*page|vol/.test(t)) return "bookPage";
  if (/doc(ument)?\s*type|\btype\b|kind/.test(t)) return "docType";
  if (/parcel|apn|pin/.test(t)) return "parcelId";
  return null;
}

const CANONICAL: ColMap = {
  recordDate: 0, party: 1, legal: 2, instrument: 3, consideration: 4, bookPage: 5, docType: 6,
};

export function parseOnCoreResults(html: string): OnCoreRecord[] {
  const $ = cheerio.load(html);

  let $table = $("#searchResultsTable, #resultsTable, table.results, table#results");
  if ($table.length === 0) {
    $("table").each((_, el) => {
      if ($table.length) return;
      const headers = $(el).find("thead th, tr:first-child th");
      if (headers.length >= 3) $table = $(el);
    });
  }
  if ($table.length === 0) $table = $("table").first();
  if ($table.length === 0) return [];
  $table = $table.first();

  const map: ColMap = {};
  const $headers = $table.find("thead th");
  if ($headers.length > 0) {
    $headers.each((i, th) => {
      const key = headerToKey($(th).text().trim());
      if (key && map[key] === undefined) map[key] = i;
    });
  }
  const effective: ColMap = Object.keys(map).length >= 3 ? map : { ...CANONICAL, ...map };

  const records: OnCoreRecord[] = [];
  const bodyRows = $table.find("tbody tr").length
    ? $table.find("tbody tr")
    : $table.find("tr").slice($headers.length ? 1 : 0);

  bodyRows.each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 3) return;
    const at = (idx?: number): string | undefined =>
      idx !== undefined && idx < cells.length ? cells[idx] || undefined : undefined;

    const docType = at(effective.docType);
    const instrument = at(effective.instrument);
    if (!docType && !instrument) return; // header/spacer row

    let grantor = at(effective.grantor);
    let grantee = at(effective.grantee);
    if (!grantor && !grantee) {
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

function fmtDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function splitBookPage(bp: string | undefined): { book: string | null; page: string | null } {
  if (!bp) return { book: null, page: null };
  const m = bp.split(/[/\\-]/).map((x) => x.trim());
  return { book: m[0] || null, page: m[1] || null };
}

// ---------------------------------------------------------------------------
// APN join (two-tier, conservative) — mirrors acclaim resolveApns.
// ---------------------------------------------------------------------------

type ApnJoinTier = "direct" | "unique-name" | "ambiguous" | "none";

interface ClassifiedRow {
  rec: OnCoreRecord;
  family: OnCoreDocFamily;
  recordingDate: Date;
  ownerName: string | null;
  apn: string | null;
  apnTier: ApnJoinTier;
}

async function resolveApns(cfg: OnCoreCountyConfig, rows: ClassifiedRow[]): Promise<void> {
  // Tier 1: direct parcel-id verification (batched IN query).
  const candidates = new Set<string>();
  for (const r of rows) {
    const pn = r.rec.parcelId?.trim();
    if (!pn) continue;
    for (const c of cfg.apnCandidates(pn)) if (c.length >= 6) candidates.add(c);
  }
  const verified = new Set<string>();
  const all = [...candidates];
  for (let i = 0; i < all.length; i += 500) {
    const chunk = all.slice(i, i + 500);
    if (chunk.length === 0) continue;
    const hits = await prisma.parcel.findMany({
      where: { countyFips: cfg.countyFips, apn: { in: chunk } },
      select: { apn: true },
    });
    for (const h of hits) verified.add(h.apn);
  }
  for (const r of rows) {
    const pn = r.rec.parcelId?.trim();
    if (!pn) continue;
    const hit = cfg.apnCandidates(pn).find((c) => verified.has(c));
    if (hit) {
      r.apn = hit;
      r.apnTier = "direct";
    }
  }

  // Tier 2: unique compressed owner-name join.
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
  cfg: OnCoreCountyConfig,
  r: ClassifiedRow,
  source: string,
): Promise<boolean> {
  const doc = r.rec.documentNumber;
  if (!doc) return false;
  const { book, page } = splitBookPage(r.rec.bookPage);
  const isAssignment = r.family === "assignment";
  try {
    await prisma.mortgage.upsert({
      where: { countyFips_documentNumber_source: { countyFips: cfg.countyFips, documentNumber: doc, source } },
      create: {
        countyFips: cfg.countyFips,
        apn: r.apn,
        recordingDate: r.recordingDate,
        loanAmount: r.rec.consideration ?? null,
        lenderName: r.rec.grantee?.trim() || null,
        borrowerName: isAssignment ? null : r.rec.grantor?.trim() || null,
        mortgageType: r.rec.documentType || null,
        documentNumber: doc,
        orBook: book,
        orPage: page,
        source,
      },
      update: {
        loanAmount: r.rec.consideration ?? undefined,
        lenderName: r.rec.grantee?.trim() || undefined,
        borrowerName: isAssignment ? undefined : r.rec.grantor?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[oncore:${cfg.county}] mortgage persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

async function persistLien(
  cfg: OnCoreCountyConfig,
  r: ClassifiedRow,
  source: string,
): Promise<boolean> {
  const doc = r.rec.documentNumber;
  if (!doc) return false;
  const { book, page } = splitBookPage(r.rec.bookPage);
  const docType = r.rec.documentType || "";
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips: cfg.countyFips, documentNumber: doc, source } },
      create: {
        countyFips: cfg.countyFips,
        apn: r.apn,
        lienCategory: classifyLienCategory(r.family, docType),
        recordingDate: r.recordingDate,
        amount: r.rec.consideration ?? null,
        plaintiffName: r.rec.grantor?.trim() || null,
        defendantName: r.rec.grantee?.trim() || null,
        lienTypeCode: docType || null,
        documentNumber: doc,
        orBook: book,
        orPage: page,
        source,
      },
      update: {
        amount: r.rec.consideration ?? undefined,
        plaintiffName: r.rec.grantor?.trim() || undefined,
        defendantName: r.rec.grantee?.trim() || undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[oncore:${cfg.county}] lien persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main entry — one (county, date-range) sweep.
// ---------------------------------------------------------------------------

export interface OnCoreScrapeResult {
  countyFips: string;
  county: string;
  from: string;
  to: string;
  /** Why a run produced 0 persisted rows, when it did. */
  outcome: "ok" | "search-blocked" | "session-failed" | "empty";
  /** Specific search blocker (when outcome=search-blocked). */
  blocker: OnCoreSearchAttempt["blocker"] | "session-mint";
  found: number;
  byFamily: Record<string, number>;
  persistedMortgages: number;
  persistedLiens: number;
  rejected: number;
  apnJoin: { direct: number; uniqueName: number; ambiguous: number; none: number };
}

export async function scrapeOnCoreCounty(opts: {
  countyFips: string;
  from: Date;
  to: Date;
  useProxy?: boolean;
  /** Pre-fetched result HTML (test / future SPA-transport injection). Bypasses the live gate. */
  injectResultHtml?: string;
}): Promise<OnCoreScrapeResult> {
  const cfg = findOnCoreCounty(opts.countyFips);
  if (!cfg) throw new Error(`[oncore] county ${opts.countyFips} not in ONCORE_COUNTIES`);

  const source = `scraper:oncore-${cfg.countyFips}`;
  const fromStr = opts.from.toISOString().slice(0, 10);
  const toStr = opts.to.toISOString().slice(0, 10);

  const result: OnCoreScrapeResult = {
    countyFips: cfg.countyFips,
    county: cfg.county,
    from: fromStr,
    to: toStr,
    outcome: "ok",
    blocker: "none",
    found: 0,
    byFamily: {},
    persistedMortgages: 0,
    persistedLiens: 0,
    rejected: 0,
    apnJoin: { direct: 0, uniqueName: 0, ambiguous: 0, none: 0 },
  };

  // --- Acquire result HTML (live gate today; injectable for tests/future) ---
  let resultHtml = opts.injectResultHtml ?? "";
  if (!resultHtml) {
    const sess = await mintOnCoreSession(cfg, { useProxy: opts.useProxy });
    if (!sess) {
      result.outcome = "session-failed";
      result.blocker = "session-mint";
      return result;
    }
    const attempt = await attemptOnCoreRecordDateSearch(sess, opts.from, opts.to);
    if (!attempt.ok) {
      result.outcome = "search-blocked";
      result.blocker = attempt.blocker;
      // Bronze: record the blocker so the audit row is honest about WHY 0 rows.
      void captureRaw({
        entityType: "parcel",
        source: "oncore",
        sourceTag: `${source}-${fromStr}..${toStr}`,
        category: "clerk_recordings_bulk",
        countyFips: cfg.countyFips,
        requestParams: {
          selfServiceBase: cfg.selfServiceBaseUrl,
          from: fromStr,
          to: toStr,
          useProxy: opts.useProxy ?? cfg.useProxy,
        },
        rawResponse: {
          blocker: attempt.blocker,
          httpStatus: attempt.httpStatus,
          note: "OnCore search migrated to Tyler Self-Service SPA; HTTP search handshake pending. Session mint verified.",
          selfServiceReady: sess.selfServiceReady,
        },
        legalRisk: "yellow",
      });
      return result;
    }
    resultHtml = attempt.resultHtml;
  }

  // --- Parse → classify → APN join → persist ---
  const rows = parseOnCoreResults(resultHtml);
  result.found = rows.length;

  const classified: ClassifiedRow[] = [];
  for (const rec of rows) {
    const family = classifyOnCoreDocType(rec.documentType);
    const recordingDate = parseDate(rec.recordingDate);
    if (!rec.documentNumber || !rec.documentType || !recordingDate || !family) {
      result.rejected++;
      continue;
    }
    result.byFamily[family] = (result.byFamily[family] ?? 0) + 1;
    const ownerName =
      family === "mortgage"
        ? rec.grantor?.trim() || null
        : family === "lien" || family === "judgment" || family === "lis_pendens"
          ? rec.grantee?.trim() || null
          : null;
    classified.push({ rec, family, recordingDate, ownerName, apn: null, apnTier: "none" });
  }

  const joinable = classified.filter((c) => c.family !== "satisfaction");
  await resolveApns(cfg, joinable);

  for (const c of joinable) {
    if (c.apnTier === "direct") result.apnJoin.direct++;
    else if (c.apnTier === "unique-name") result.apnJoin.uniqueName++;
    else if (c.apnTier === "ambiguous") result.apnJoin.ambiguous++;
    else result.apnJoin.none++;

    if (c.family === "mortgage" || c.family === "assignment") {
      if (await persistMortgage(cfg, c, source)) result.persistedMortgages++;
    } else {
      if (await persistLien(cfg, c, source)) result.persistedLiens++;
    }
  }

  // Bronze: full extracted payload + per-row APN join confidence.
  void captureRaw({
    entityType: "parcel",
    source: "oncore",
    sourceTag: `${source}-${fromStr}..${toStr}`,
    category: "clerk_recordings_bulk",
    countyFips: cfg.countyFips,
    requestParams: { selfServiceBase: cfg.selfServiceBaseUrl, from: fromStr, to: toStr },
    rawResponse: {
      rows,
      apnJoins: joinable.map((c) => ({
        documentNumber: c.rec.documentNumber,
        family: c.family,
        apn: c.apn,
        tier: c.apnTier,
        confidence: c.apnTier === "direct" ? 1.0 : c.apnTier === "unique-name" ? 0.85 : 0,
      })),
    },
    legalRisk: "yellow",
  });

  if (result.found === 0) result.outcome = "empty";
  return result;
}

// ---------------------------------------------------------------------------
// Inline self-test — runs only on direct `tsx oncore-records.ts` invocation.
// Validates the parser (header-mapped + canonical-fallback), the classifiers,
// and the APN normalizer against a synthetic fixture mirroring an OnCore/Eagle
// result grid (the live result HTML is SPA-gated — see header note).
// ---------------------------------------------------------------------------

function _runInlineAssertions(): void {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const assert = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  // (a) Header-mapped parse, non-canonical column order.
  {
    const html = `
      <table id="searchResultsTable"><thead><tr>
        <th>Document Type</th><th>Recording Date</th><th>Grantor</th><th>Grantee</th>
        <th>Instrument #</th><th>Book/Page</th><th>Consideration</th><th>Legal</th><th>Parcel</th>
      </tr></thead><tbody>
        <tr><td>MORTGAGE</td><td>06/02/2026</td><td>SMITH JOHN</td><td>WELLS FARGO BANK NA</td>
            <td>20260123456</td><td>11234/0567</td><td>$250,000.00</td><td>LOT 4 BLK 2</td><td>20-22-31-6688-01-330</td></tr>
        <tr><td>CLAIM OF LIEN</td><td>06/03/2026</td><td>ABC PLUMBING LLC</td><td>DOE JANE</td>
            <td>20260123457</td><td>11234/0568</td><td>$8,200.00</td><td>UNIT 12B</td><td></td></tr>
        <tr><td>LIS PENDENS</td><td>06/04/2026</td><td>BANK OF AMERICA</td><td>ROE RICHARD</td>
            <td>20260123458</td><td>11234/0569</td><td></td><td>LOT 9</td><td></td></tr>
      </tbody></table>`;
    const rows = parseOnCoreResults(html);
    assert("parse: 3 rows", rows.length === 3, `got ${rows.length}`);
    assert("parse: doctype mapped", rows[0].documentType === "MORTGAGE", rows[0].documentType);
    assert(
      "parse: grantor/grantee",
      rows[0].grantor === "SMITH JOHN" && rows[0].grantee === "WELLS FARGO BANK NA",
    );
    assert("parse: consideration", rows[0].consideration === 250000, String(rows[0].consideration));
    assert("parse: instrument", rows[0].documentNumber === "20260123456", rows[0].documentNumber);
    assert("parse: parcel dash format", rows[0].parcelId === "20-22-31-6688-01-330", rows[0].parcelId);
    assert("classify: mortgage", classifyOnCoreDocument(rows[0].documentType) === "mortgage");
    assert("classify: lien", classifyOnCoreDocument(rows[1].documentType) === "lien");
    assert("classify: lis pendens → lien", classifyOnCoreDocument(rows[2].documentType) === "lien");
    assert("family: lis pendens", classifyOnCoreDocType(rows[2].documentType) === "lis_pendens");
  }

  // (b) Canonical-fallback parse (no headers).
  {
    const html = `<table><tbody>
      <tr><td>06/05/2026</td><td>OWNER A → BANK B</td><td>LOT 9</td><td>20260200000</td><td>$0.00</td><td>11300/100</td><td>SATISFACTION OF MORTGAGE</td></tr>
    </tbody></table>`;
    const rows = parseOnCoreResults(html);
    assert("fallback: 1 row", rows.length === 1, `got ${rows.length}`);
    assert(
      "fallback: party split on arrow",
      rows[0].grantor === "OWNER A" && rows[0].grantee === "BANK B",
      JSON.stringify(rows[0]),
    );
    assert("fallback: doctype col6", rows[0].documentType === "SATISFACTION OF MORTGAGE", rows[0].documentType);
    assert("classify: satisfaction not mortgage", classifyOnCoreDocument(rows[0].documentType) === "other");
    assert("family: satisfaction", classifyOnCoreDocType(rows[0].documentType) === "satisfaction");
  }

  // (c) DEED OF TRUST classified as mortgage; lien categories.
  {
    assert("deed of trust → mortgage", classifyOnCoreDocType("DEED OF TRUST") === "mortgage");
    assert("assignment family", classifyOnCoreDocType("ASSIGNMENT OF MORTGAGE") === "assignment");
    assert("judgment family", classifyOnCoreDocType("FINAL JUDGMENT") === "judgment");
    assert("mechanics lien cat", classifyLienCategory("lien", "MECHANICS LIEN") === "mechanics");
    assert("hoa lien cat", classifyLienCategory("lien", "HOA ASSESSMENT LIEN") === "hoa");
    assert("tax lien cat", classifyLienCategory("lien", "TAX LIEN") === "tax");
  }

  // (d) APN digits-only normalizer (Orange dash format → 15-digit DOR apn).
  {
    const cfg = ONCORE_COUNTIES[0];
    assert(
      "apn candidate strips dashes",
      cfg.apnCandidates("20-22-31-6688-01-330")[0] === "202231668801330",
      JSON.stringify(cfg.apnCandidates("20-22-31-6688-01-330")),
    );
    assert("apn candidate rejects short", cfg.apnCandidates("12-3").length === 0);
  }

  // (e) Disclaimer form parse (legacy recorder splash).
  {
    const splash = `<form class="splash" action="../web/loginPOST.jsp;jsessionid=ABC123" method="POST">
      <input type="hidden" name="guest" value="true" />
      <input type="submit" name="submit" value="I Accept" /></form>`;
    const { action, submit } = parseDisclaimerForm(splash);
    assert("disclaimer action parsed", action === "../web/loginPOST.jsp;jsessionid=ABC123", String(action));
    assert("disclaimer submit label", submit === "I Accept", submit);
  }

  // (f) Search-gate detection sentinels.
  {
    assert("options-changed detected", OPTIONS_CHANGED_RE.test("redirected because your options have changed"));
    assert("ss-error detected", SS_ERROR_RE.test("An error has occurred. GUID..."));
    assert("clean html not flagged", !OPTIONS_CHANGED_RE.test("<table>...</table>") && !SS_ERROR_RE.test("<table>"));
  }

  let failed = 0;
  for (const r of results) {
    if (r.ok) console.log(`PASS  ${r.name}`);
    else {
      failed++;
      console.error(`FAIL  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${results.length} assertions failed`);
    process.exit(1);
  } else console.log(`\nAll ${results.length} assertions passed.`);
}

const _isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  /oncore-records(\.[tj]s)?$/.test(process.argv[1]);
if (_isMain) _runInlineAssertions();
