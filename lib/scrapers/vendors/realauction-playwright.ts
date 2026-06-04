import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { captureCookiesFromUrl } from "../base/cookie-fetch";
import { decodeMacroHtml } from "./realauction-macros";
import { REALAUCTION_COUNTIES, type RealAuctionTrack } from "./realauction";

// ---------------------------------------------------------------------------
// RealAuction XHR scraper (F2.2, post-pivot 2026-06-04).
//
// NOTE: despite the file name (`realauction-playwright.ts`), this scraper no
// longer uses Playwright. We kept the file name to avoid a cascade of import
// updates across the dispatcher / scheduler / tests. The retired Playwright
// path used a stealth-chromium nav to the PREVIEW splash page and waited
// 3s for the AJAX inject — slow (60s+ Chromium startup per (county, date))
// and unnecessary now that we hit the real data endpoint directly.
//
// New flow per (county, date):
//   1. GET splash URL via politeFetch → parse Set-Cookie into a Cookie
//      header (CFID/CFTOKEN + AWSALB + CF_CLIENT_<COUNTY>_*).
//      Cached per county for 25 minutes (cookies expire ~30 min).
//   2. For each AREA in {W (waiting), R (running), C (closed/sold)} issue
//      one authenticated XHR GET to:
//        /index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD
//          &AREA={W|R|C}&AuctionDate=MM/DD/YYYY
//      with headers { Cookie, X-Requested-With: XMLHttpRequest, ... }.
//   3. The response is JSON: { retHTML, rlist }. retHTML is wire-compacted
//      via 12 `@`-prefixed macros (see lib/scrapers/vendors/realauction-macros.ts).
//   4. Decode → feed to cheerio → reuse the existing parseAuctionRows()
//      logic (unchanged: still iterates div[id^='AITEM_'] / table.ad_tab).
//
// Proxy posture: useProxy defaults to FALSE. RealAuction's WAF returns 403
// to the DataImpulse residential pool (L0 probe 2026-06-02 verified), same
// pattern we hit with OCFL on the Duval Clerk pivot. Direct egress from
// Railway is required. If Railway IPs eventually get blocked too, fall back
// to BD-with-KYC (see project_bright_data_402.md).
//
// Status mapping: AREA is now AUTHORITATIVE — we know which area each row
// came from at fetch time, so we set status directly rather than re-reading
// the enclosing Area_* container. parseAuctionRows() falls back to its
// own container-walk if the per-area override is not provided.
//
// The auction DATE comes from the request param `AuctionDate=MM/DD/YYYY`
// — it is NOT in the response payload — so we thread it through to each row.
//
// Same parser handles all 16 wired counties via the subdomain pattern.
// ---------------------------------------------------------------------------

interface AuctionRow {
  auctionStarts?: string;        // MM/DD/YYYY date string from the request param
  auctionType?: string;
  caseNumber?: string;
  finalJudgmentAmount?: number;
  parcelId?: string;
  plaintiffMaxBid?: number;
  status?: "running" | "waiting" | "sold" | "cancelled";
  aid?: string;
}

export interface RealAuctionPlaywrightResult {
  countyFips: string;
  track: RealAuctionTrack;
  found: number;
  persistedForeclosures: number;
  persistedLiens: number;
}

function rootFor(track: RealAuctionTrack): string {
  return track === "foreclosure" ? "realforeclose.com" :
         track === "tax-deed"    ? "realtaxdeed.com" :
                                   "realtaxlien.com";
}

function splashUrlFor(track: RealAuctionTrack, subdomain: string, auctionDate?: string): string {
  const base = `https://${subdomain}.${rootFor(track)}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW`;
  return auctionDate ? `${base}&AuctionDate=${encodeURIComponent(auctionDate)}` : base;
}

function xhrUrlFor(
  track: RealAuctionTrack,
  subdomain: string,
  area: "W" | "R" | "C",
  auctionDate: string,
): string {
  return `https://${subdomain}.${rootFor(track)}/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=${area}&AuctionDate=${encodeURIComponent(auctionDate)}`;
}

// ---------------------------------------------------------------------------
// Per-county cookie cache.
//
// RealAuction cookies expire ~30 minutes after they're set. We cache for
// 25 minutes to leave a safety buffer. Cookies are county-namespaced
// (CF_CLIENT_<COUNTY>_*) so we MUST cache per-subdomain, not globally.
// Keyed by `${subdomain}:${rootHost}` so foreclosure / tax-deed / tax-lien
// hosts each get their own bucket.
// ---------------------------------------------------------------------------
const COOKIE_TTL_MS = 25 * 60 * 1000;
const cookieCache = new Map<string, { cookieHeader: string; capturedAt: number }>();

async function getCookieHeaderFor(
  splashUrl: string,
  cacheKey: string,
  useProxy: boolean,
): Promise<string> {
  const now = Date.now();
  const cached = cookieCache.get(cacheKey);
  if (cached && now - cached.capturedAt < COOKIE_TTL_MS) {
    return cached.cookieHeader;
  }
  const cookieHeader = await captureCookiesFromUrl(splashUrl, { useProxy });
  cookieCache.set(cacheKey, { cookieHeader, capturedAt: now });
  return cookieHeader;
}

interface XhrEnvelope {
  retHTML?: string;
  rlist?: string;
  [k: string]: unknown;
}

// APN denylist — strings that are clearly NOT parcel numbers but have been
// observed leaking from outer-DOM anchors (splash left-nav "Property Appraiser"
// link) or row-label misalignment on Duval/Hillsborough/Brevard.
const APN_DENYLIST_RE = /^(property appraiser|view|details|search|link|case|case #|click here|hidden|n\/a|-)$/i;
const APN_SHAPE_RE = /^[0-9][0-9A-Z\-\.\s]{4,}$/i; // at least one leading digit + 4+ APN-ish chars

function looksLikeApn(s: string | undefined | null): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (APN_DENYLIST_RE.test(trimmed)) return false;
  if (!APN_SHAPE_RE.test(trimmed)) return false;
  return true;
}

/**
 * Pull an APN from an anchor href as a last-resort fallback.
 * Searches the querystring for one of the well-known parcel-id keys used
 * by FL property appraiser detail pages.
 */
function extractApnFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const keys = ["parcel", "folio", "strap", "pin", "parcelid", "altkey", "re"];
  try {
    const u = new URL(href, "https://example.com/");
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v && looksLikeApn(v)) return v.trim();
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

/**
 * Parse the calendar page HTML into structured auction rows.
 *
 * IMPORTANT: scope iteration to `div[id^='AITEM_']` ONLY. NEVER walk
 * the full body — the splash skeleton contains a left-nav link with
 * anchor text "Property Appraiser" that leaked into the apn column on
 * Duval (12031) and Hillsborough (12057) under the previous body-walking
 * implementation.
 */
function parseAuctionRows(
  html: string,
  requestedAuctionDate?: string,
  areaOverride?: "W" | "R" | "C",
): AuctionRow[] {
  const $ = cheerio.load(html);
  const auctions: AuctionRow[] = [];

  // When the caller fetches a specific AREA endpoint we already know the
  // status authoritatively. Otherwise (legacy full-page parse) we walk up
  // to the enclosing Area_{R|W|C} container.
  // (cheerio's Element type isn't exported in v1; use the generic node type.)
  const statusFromArea = (area: "W" | "R" | "C"): AuctionRow["status"] =>
    area === "R" ? "running" : area === "C" ? "sold" : "waiting";

  const statusFor = (item: unknown): AuctionRow["status"] => {
    if (areaOverride) return statusFromArea(areaOverride);
    const $area = $(item as never).closest("[id^='Area_'],[arid]");
    const arid = ($area.attr("arid") ?? $area.attr("id") ?? "").toUpperCase();
    if (arid.includes("R")) return "running";
    if (arid.includes("C")) return "sold";
    return "waiting";
  };

  $("div[id^='AITEM_']").each((_, item) => {
    const $item = $(item);
    const aid = $item.attr("aid");
    const row: AuctionRow = {
      aid,
      status: statusFor(item),
      auctionStarts: requestedAuctionDate, // date comes from the URL param, NOT the DOM
    };

    $item.find("table.ad_tab > tbody > tr").each((_, tr) => {
      const $tr = $(tr);
      const label = $tr.find("td.AD_LBL").first().text().trim().replace(/:$/, "");
      if (!label) return; // skip address-continuation rows (empty AD_LBL)

      const $data = $tr.find("td.AD_DTA").first();
      const $a = $data.find("a").first();
      const linkText = $a.text().trim();
      const cellText = $data.text().trim();
      // Prefer link text when present (strips wrapper spaces), else cell text
      const value = (linkText || cellText).trim();

      switch (label) {
        case "Auction Type":
          row.auctionType = value;
          break;
        case "Case #":
          row.caseNumber = value;
          break;
        case "Final Judgment Amount":
          row.finalJudgmentAmount = parseDollar(value);
          break;
        case "Parcel ID": {
          // Defense-in-depth: try multiple sources, validate each.
          //  1. cellText (covers Brevard pattern where APN renders as plain text)
          //  2. linkText (preferred for Duval-pattern <a>-wrapped APN)
          //  3. href querystring (last resort for hrefs like
          //     ?parcel=035892-0000 — protects against future variants)
          //  4. ALL candidates filtered through looksLikeApn (rejects
          //     "Property Appraiser" label leak + case-number cross-contam)
          const candidates: string[] = [];
          if (cellText && cellText !== linkText) candidates.push(cellText);
          if (linkText) candidates.push(linkText);
          const hrefApn = extractApnFromHref($a.attr("href"));
          if (hrefApn) candidates.push(hrefApn);
          const apn = candidates.find(looksLikeApn);
          if (apn) row.parcelId = apn.replace(/\s+/g, ""); // strip internal spaces (Hillsborough 22-char APNs)
          break;
        }
        case "Plaintiff Max Bid":
          row.plaintiffMaxBid = value === "Hidden" ? undefined : parseDollar(value);
          break;
      }
    });

    if (row.caseNumber) auctions.push(row);
  });

  return auctions;
}

function parseDollar(s: string): number | undefined {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Parse a "MM/DD/YYYY" auction date string into a UTC Date.
 *
 * RealAuction stores no time-of-day in the preview DOM — only the calendar
 * date. We anchor each auction to 14:00 UTC (10:00 AM ET during EDT, 09:00 AM
 * ET during EST), matching the typical RealAuction 10am-ET kickoff.
 *
 * DST awareness: Florida observes EDT (UTC-4) from the 2nd Sunday in March
 * through the 1st Sunday in November. We approximate the offset based on
 * month — good enough for sorting / day-bucketing the leads list. If you
 * need true wall-clock fidelity, install `luxon` and replace this with a
 * tz-aware conversion. TODO(v0.1): exact DST boundary handling — note the
 * next flip is 2026-11-01 03:00 ET (EDT→EST) and 2027-03-14 02:00 ET
 * (EST→EDT). Until luxon lands, dates within a few hours of those flips
 * may be off by 1 hour.
 */
function parseAuctionDate(s: string | undefined): Date | null {
  if (!s) return null;
  // Accept either "MM/DD/YYYY" or "MM/DD/YYYY HH:MM AM/PM ET"
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s+(AM|PM))?/i);
  if (!m) return null;
  const [, mo, dd, yr, hr, mn, ampm] = m;
  const month = parseInt(mo, 10);
  const day = parseInt(dd, 10);
  const year = parseInt(yr, 10);

  // EDT roughly = March–October (months 3-10 inclusive); EST = Nov–Feb.
  // Offset to add to ET to get UTC.
  const isEdt = month >= 3 && month <= 10;
  const etToUtcHours = isEdt ? 4 : 5;

  let h = 10; // default 10 AM ET kickoff
  let m_ = 0;
  if (hr && mn && ampm) {
    h = parseInt(hr, 10);
    if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    m_ = parseInt(mn, 10);
  }
  return new Date(Date.UTC(year, month - 1, day, h + etToUtcHours, m_));
}

/**
 * Scrape one (county, track, date) via the authenticated XHR endpoint.
 *
 * useProxy defaults to FALSE — DataImpulse residential IPs are 403'd by
 * RealAuction's WAF. Caller may override but should only do so to test
 * a future provider that has been verified non-blocked.
 */
export async function scrapeRealAuctionsPlaywright(opts: {
  countyFips: string;
  track: RealAuctionTrack;
  useProxy?: boolean;
  auctionDate?: string; // "MM/DD/YYYY" — defaults to today
}): Promise<RealAuctionPlaywrightResult | null> {
  const county = REALAUCTION_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!county) return null;
  if (!county.tracks.includes(opts.track)) return null;

  const useProxy = opts.useProxy ?? false;
  const sourceTag = `scraper:realauction-xhr-${opts.countyFips}-${opts.track}`;

  // Default auction date = today, MM/DD/YYYY
  const today = new Date();
  const defaultDate = `${String(today.getUTCMonth() + 1).padStart(2, "0")}/${String(today.getUTCDate()).padStart(2, "0")}/${today.getUTCFullYear()}`;
  const auctionDate = opts.auctionDate ?? defaultDate;
  const splashUrl = splashUrlFor(opts.track, county.subdomain, auctionDate);

  // (1) Cookie capture — cached per (subdomain, track-root) for 25 min.
  const cacheKey = `${county.subdomain}:${rootFor(opts.track)}`;
  const cookieHeader = await getCookieHeaderFor(splashUrl, cacheKey, useProxy);

  // (2) Issue per-AREA XHR calls. The 3 W/R/C buckets partition the
  // calendar into upcoming / in-flight / completed auctions for the date.
  const areas: Array<"W" | "R" | "C"> = ["W", "R", "C"];
  const rows: AuctionRow[] = [];
  const envelopesByArea: Record<string, { url: string; httpStatus: number; retHTMLBytes: number; rlist?: string; bodyFirst200: string }> = {};

  for (const area of areas) {
    const xhrUrl = xhrUrlFor(opts.track, county.subdomain, area, auctionDate);
    let httpStatus = 0;
    let body = "";
    try {
      const res = await politeFetch(xhrUrl, {
        method: "GET",
        useProxy,
        // Always rotate UA — the WAF rejects the polite bot UA on the splash
        // (verified 2026-06-04), and we want the XHR fingerprint to match
        // the splash request that minted the session cookie.
        rotateFingerprint: true,
        headers: {
          Cookie: cookieHeader,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json,text/javascript,*/*;q=0.01",
          Referer: splashUrl,
        },
      });
      httpStatus = res.status;
      body = await res.text();
    } catch (err) {
      // Surface the error in the audit envelope but keep going for the
      // other areas — a single area failure shouldn't doom the (county, date).
      // eslint-disable-next-line no-console
      console.warn(`[realauction-xhr] ${opts.countyFips}/${opts.track}/${auctionDate} AREA=${area} fetch failed: ${(err as Error).message}`);
      envelopesByArea[area] = {
        url: xhrUrl,
        httpStatus: 0,
        retHTMLBytes: 0,
        bodyFirst200: `ERROR: ${(err as Error).message}`,
      };
      continue;
    }

    let envelope: XhrEnvelope = {};
    try {
      // The server sometimes prepends ColdFusion whitespace before the JSON
      // payload — JSON.parse tolerates leading whitespace per spec, so no
      // trim() needed. retHTML may also be a literal empty string when the
      // area has no auctions for the date.
      envelope = JSON.parse(body) as XhrEnvelope;
    } catch {
      envelope = { retHTML: "", rlist: "" };
    }
    const retHTML = typeof envelope.retHTML === "string" ? envelope.retHTML : "";
    envelopesByArea[area] = {
      url: xhrUrl,
      httpStatus,
      retHTMLBytes: retHTML.length,
      rlist: typeof envelope.rlist === "string" ? envelope.rlist : undefined,
      bodyFirst200: body.slice(0, 200),
    };

    // Empty retHTML = no auctions in that bucket for that date. Not an error.
    if (!retHTML) continue;

    const decoded = decodeMacroHtml(retHTML);
    const rowsFromArea = parseAuctionRows(decoded, auctionDate, area);
    for (const r of rowsFromArea) rows.push(r);
  }

  // (3) Audit snapshot — one capture per (county, track, date) covering
  // all three area envelopes. Same shape contract as before for downstream
  // analytics: { extracted: rows, htmlBytes, htmlSample } at the top level.
  const totalRetHtmlBytes = Object.values(envelopesByArea).reduce((s, e) => s + e.retHTMLBytes, 0);
  void captureRaw({
    entityType: "parcel",
    source: "xhr",
    sourceTag,
    category: "realauction_calendar",
    countyFips: opts.countyFips,
    requestParams: { splashUrl, track: opts.track, auctionDate, areas },
    rawResponse: {
      extracted: rows,
      htmlBytes: totalRetHtmlBytes,
      htmlSample: "",
      envelopesByArea,
    },
    legalRisk: "yellow",
  });

  const result: RealAuctionPlaywrightResult = {
    countyFips: opts.countyFips,
    track: opts.track,
    found: rows.length,
    persistedForeclosures: 0,
    persistedLiens: 0,
  };

  for (const r of rows) {
    // Brevard (12009) Option C exclusion: the Brevard RealAuction calendar
    // page renders the Parcel ID row with a structurally different layout
    // than the shared Duval pattern that ad_tab parsing assumes — historic
    // ingests wrote the case number into the apn column for ~20 rows/month.
    // Rather than ship a half-fix, v0 EXCLUDES Brevard rows whose extracted
    // apn equals the case number (or is missing). Proper Brevard support
    // (separate case→APN lookup against brevardpa.com) is queued for v0.1
    // per docs/development/v0-auction-verdict-2026-06-02.md.
    if (opts.countyFips === "12009") {
      if (!r.parcelId || r.parcelId === r.caseNumber) {
        // Skip — would write garbage apn. Persist nothing for this row.
        continue;
      }
    }

    if (opts.track === "tax-lien") {
      result.persistedLiens += await persistAsTaxLien(opts.countyFips, sourceTag, r);
    } else {
      result.persistedForeclosures += await persistAsForeclosure(opts.countyFips, sourceTag, r, opts.track);
    }
  }
  return result;
}

async function persistAsForeclosure(countyFips: string, source: string, r: AuctionRow, track: RealAuctionTrack): Promise<number> {
  if (!r.caseNumber) return 0;
  const stageCode =
    r.status === "sold" ? "SOLD" :
    r.status === "cancelled" ? "DISMISSED" :
    r.status === "running" ? "SCHEDULED" :
    "SCHEDULED";

  // Final defense: never persist a known-bad APN even if parseAuctionRows
  // somehow lets one through (e.g. future DOM change).
  const safeApn = looksLikeApn(r.parcelId) ? r.parcelId : null;

  try {
    await prisma.foreclosure.upsert({
      where: { countyFips_caseNumber_stageCode_source: { countyFips, caseNumber: r.caseNumber, stageCode, source } },
      create: {
        countyFips,
        apn: safeApn,
        stageCode,
        auctionDate: parseAuctionDate(r.auctionStarts),
        judgmentAmount: r.finalJudgmentAmount ?? null,
        openingBid: r.plaintiffMaxBid ?? null,
        caseNumber: r.caseNumber,
        trusteeId: r.caseNumber,
        source,
      },
      update: {
        auctionDate: parseAuctionDate(r.auctionStarts) ?? undefined,
        openingBid: r.plaintiffMaxBid ?? undefined,
        judgmentAmount: r.finalJudgmentAmount ?? undefined,
        apn: safeApn ?? undefined,
      },
    });
    void track; // present for future per-track variations
    return 1;
  } catch (err) {
    console.warn("[realauction-pw] persist failed:", (err as Error).message);
    return 0;
  }
}

async function persistAsTaxLien(countyFips: string, source: string, r: AuctionRow): Promise<number> {
  if (!r.caseNumber) return 0;
  const safeApn = looksLikeApn(r.parcelId) ? r.parcelId : null;
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.caseNumber, source } },
      create: {
        countyFips,
        apn: safeApn,
        lienCategory: "tax",
        recordingDate: parseAuctionDate(r.auctionStarts) ?? new Date(),
        amount: r.finalJudgmentAmount ?? null,
        documentNumber: r.caseNumber,
        source,
      },
      update: { amount: r.finalJudgmentAmount ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[realauction-pw] tax lien persist failed:", (err as Error).message);
    return 0;
  }
}
