import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";
import { captureCookiesFromUrl } from "../base/cookie-fetch";
import { decodeMacroHtml } from "./realauction-macros";

// ---------------------------------------------------------------------------
// RealTaxDeed scraper — M2.2 (B2: tax-deed applications signal).
//
// `*.realtaxdeed.com` is the SAME RealAuction platform as the production
// foreclosure scraper (lib/scrapers/vendors/realauction-playwright.ts).
// This file REUSES (imports, does not copy) the two shared pieces:
//   - cookie capture:  lib/scrapers/base/cookie-fetch.ts
//   - macro decoder:   lib/scrapers/vendors/realauction-macros.ts
//
// Flow per county:
//   1. CALENDAR-FIRST date discovery (new vs the foreclosure scraper's
//      blind weekday iteration): GET
//        /index.cfm?zaction=USER&zmethod=CALENDAR[&selCalDate={ts 'YYYY-MM-01 00:00:00'}]
//      for the current + next N months. Days that have a tax-deed sale carry
//      a `dayid='MM/DD/YYYY'` attribute on their CALBOX div (verified Duval +
//      Escambia 2026-06-10); empty days have no dayid. Tax-deed sales are
//      sparse (monthly-ish per county) so this turns ~60 blind date probes
//      into ~3 calendar GETs + only the real sale dates.
//   2. Per sale date: splash GET WITH AuctionDate (cookie mint — see below) →
//      3 XHR GETs for AREA=W/R/C → decode 12-macro envelope → parse rows.
//
// TWO LANDMINES verified live 2026-06-10 (both differ from what the
// foreclosure scraper assumes):
//   (a) The auction DATE is bound to the CF session AT SPLASH TIME — the
//       XHR's AuctionDate param is IGNORED. A cookie minted on the
//       06/10 splash returns 06/10 rows for an 08/12 XHR (verified with
//       fresh jars both directions). So cookies are minted FRESH PER
//       (county, date) — never cached across dates. (The foreclosure
//       scraper caches per-county for 25 min across dates; if realforeclose
//       behaves the same way this mis-attributes rows to wrong dates —
//       flagged for follow-up, not fixed here.)
//   (b) Some counties (verified: Miami-Dade) serve their FORECLOSURE
//       auctions on the same realtaxdeed.com vhost — calendar day boxes
//       carry CALTEXT 'Foreclosure' vs 'Tax Deed'. We only take days whose
//       box text says Tax Deed, and additionally drop any parsed row whose
//       Auction Type is present and not TAXDEED.
//
// Tax-deed AITEM rows differ from foreclosure rows only in ad_tab labels
// (verified against live Duval 2026-06-10 capture):
//   Auction Type: TAXDEED | Case #: 2024-1257TD | Certificate #: 02078-2022
//   Opening Bid: $37,955.80 | Parcel ID: <a href=...>015772-0060</a>
//   Property Address: ... (+ unlabeled city/zip continuation row)
//   Assessed Value: $285,046.00
//
// Persistence (M2.2 wave constraint — NO schema changes): reuses the
// Foreclosure table, mirroring persistAsForeclosure from the foreclosure
// scraper, with stageCode='TAX_DEED' (waiting/running) | 'SOLD' (area C,
// past sale date) | 'DISMISSED' (area C, FUTURE sale date = redeemed/
// canceled before sale) and source='realtaxdeed'. The unique key
// (countyFips, caseNumber, stageCode, source) tolerates this cleanly and
// keeps these rows distinct from the legacy realauction-xhr tax-deed rows.
// AuctionSummary aggregation (scripts/rescore-auction.ts) includes the
// TAX_DEED stage in nextAuctionDate/scheduledCount so the auction UI
// inherits these rows. Certificate # and Assessed Value have no Foreclosure
// columns — they live in the RawCapture bronze payload until a schema wave.
//
// Proxy posture: useProxy defaults to FALSE — RealAuction's WAF 403s the
// DataImpulse residential pool (L0 probe 2026-06-02); direct Railway/local
// egress works. Same posture as the production foreclosure scraper.
// ---------------------------------------------------------------------------

export interface RealTaxDeedCounty {
  countyFips: string;
  subdomain: string; // `${subdomain}.realtaxdeed.com`
  county: string;
}

/**
 * Verified `*.realtaxdeed.com` hosts (probed 2026-06-10, all returned 200 with
 * a "RealForeclose- <County> County -Auction Calendar" title).
 *
 * NOT hosted (302 → www.realauction.com): brevard, manatee, collier,
 * charlotte, okaloosa, stlucie, sumter, walton, mypalmbeach.
 * NOTE: Palm Beach tax-deed lives at `palmbeach` even though the
 * foreclosure track uses `mypalmbeach.realforeclose.com`.
 */
export const REALTAXDEED_COUNTIES: RealTaxDeedCounty[] = [
  { countyFips: "12086", subdomain: "miamidade",    county: "Miami-Dade" },
  { countyFips: "12011", subdomain: "broward",      county: "Broward" },
  { countyFips: "12057", subdomain: "hillsborough", county: "Hillsborough" },
  { countyFips: "12095", subdomain: "orange",       county: "Orange" },
  { countyFips: "12031", subdomain: "duval",        county: "Duval" },
  { countyFips: "12099", subdomain: "palmbeach",    county: "Palm Beach" },
  { countyFips: "12103", subdomain: "pinellas",     county: "Pinellas" },
  { countyFips: "12071", subdomain: "lee",          county: "Lee" },
  { countyFips: "12105", subdomain: "polk",         county: "Polk" },
  { countyFips: "12127", subdomain: "volusia",      county: "Volusia" },
  { countyFips: "12115", subdomain: "sarasota",     county: "Sarasota" },
  { countyFips: "12101", subdomain: "pasco",        county: "Pasco" },
  { countyFips: "12117", subdomain: "seminole",     county: "Seminole" },
  { countyFips: "12083", subdomain: "marion",       county: "Marion" },
  { countyFips: "12001", subdomain: "alachua",      county: "Alachua" },
  { countyFips: "12005", subdomain: "bay",          county: "Bay" },
  { countyFips: "12017", subdomain: "citrus",       county: "Citrus" },
  { countyFips: "12019", subdomain: "clay",         county: "Clay" },
  { countyFips: "12033", subdomain: "escambia",     county: "Escambia" },
  { countyFips: "12035", subdomain: "flagler",      county: "Flagler" },
  { countyFips: "12053", subdomain: "hernando",     county: "Hernando" },
  { countyFips: "12061", subdomain: "indianriver",  county: "Indian River" },
  { countyFips: "12069", subdomain: "lake",         county: "Lake" },
  { countyFips: "12073", subdomain: "leon",         county: "Leon" },
  { countyFips: "12085", subdomain: "martin",       county: "Martin" },
  { countyFips: "12089", subdomain: "nassau",       county: "Nassau" },
  { countyFips: "12097", subdomain: "osceola",      county: "Osceola" },
  { countyFips: "12107", subdomain: "putnam",       county: "Putnam" },
  { countyFips: "12113", subdomain: "santarosa",    county: "Santa Rosa" },
];

/** Fixed persistence source — distinguishes these rows from the legacy
 *  `scraper:realauction-xhr-<fips>-tax-deed` rows in the same table. */
export const REALTAXDEED_SOURCE = "realtaxdeed";

function baseUrl(subdomain: string): string {
  return `https://${subdomain}.realtaxdeed.com`;
}

function splashUrl(subdomain: string, auctionDate?: string): string {
  const base = `${baseUrl(subdomain)}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW`;
  return auctionDate ? `${base}&AuctionDate=${encodeURIComponent(auctionDate)}` : base;
}

function xhrUrl(subdomain: string, area: "W" | "R" | "C", auctionDate: string): string {
  return `${baseUrl(subdomain)}/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=${area}&AuctionDate=${encodeURIComponent(auctionDate)}`;
}

function calendarUrl(subdomain: string, firstOfMonth?: Date): string {
  const base = `${baseUrl(subdomain)}/index.cfm?zaction=USER&zmethod=CALENDAR`;
  if (!firstOfMonth) return base;
  const y = firstOfMonth.getUTCFullYear();
  const m = String(firstOfMonth.getUTCMonth() + 1).padStart(2, "0");
  // ColdFusion timestamp literal, URL-encoded: {ts 'YYYY-MM-01 00:00:00'}
  const ts = `{ts '${y}-${m}-01 00:00:00'}`;
  return `${base}&selCalDate=${encodeURIComponent(ts)}`;
}

// NOTE: deliberately NO cross-date cookie cache (landmine (a) above) — the
// CF session pins the auction date at splash time, so each (county, date)
// mints its own session. The session must also be minted on the AUCTION
// PREVIEW page: cookies minted on the CALENDAR page yield empty retHTML
// from the UPDATE/LOAD XHR (both verified live 2026-06-10).

// ---------------------------------------------------------------------------
// Parsing helpers (tax-deed flavored; the foreclosure scraper keeps its own
// private equivalents — only the macro decoder + cookie helper are shared).
// ---------------------------------------------------------------------------

const APN_DENYLIST_RE = /^(property appraiser|view|details|search|link|case|case #|click here|hidden|n\/a|-)$/i;
const APN_SHAPE_RE = /^[0-9][0-9A-Z\-.\s]{4,}$/i;

export function looksLikeTaxDeedApn(s: string | undefined | null): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  if (APN_DENYLIST_RE.test(trimmed)) return false;
  if (!APN_SHAPE_RE.test(trimmed)) return false;
  return true;
}

function parseDollar(s: string): number | undefined {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Parse "MM/DD/YYYY" into a UTC Date anchored at the typical 10:00 AM ET
 * RealAuction kickoff (EDT/EST approximated by month — same approach as the
 * foreclosure scraper; good enough for sorting/day-bucketing).
 */
export function parseSaleDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const isEdt = month >= 3 && month <= 10;
  return new Date(Date.UTC(year, month - 1, day, 10 + (isEdt ? 4 : 5), 0));
}

export interface TaxDeedRow {
  aid?: string;
  status: "waiting" | "running" | "sold";
  saleDate?: string; // MM/DD/YYYY — from the request param, NOT the DOM
  auctionType?: string;
  caseNumber?: string;
  certificateNumber?: string;
  openingBid?: number;
  parcelId?: string;
  propertyAddress?: string;
  assessedValue?: number;
}

/**
 * Parse decoded tax-deed calendar HTML into structured rows.
 * Scoped to `div[id^='AITEM_']` ONLY (never walk the body — the splash
 * skeleton's left-nav "Property Appraiser" link leaks otherwise; same
 * landmine the foreclosure parser hit on Duval/Hillsborough).
 */
export function parseTaxDeedRows(
  html: string,
  requestedSaleDate: string,
  area: "W" | "R" | "C",
): TaxDeedRow[] {
  const $ = cheerio.load(html);
  const rows: TaxDeedRow[] = [];
  const status: TaxDeedRow["status"] =
    area === "R" ? "running" : area === "C" ? "sold" : "waiting";

  $("div[id^='AITEM_']").each((_, item) => {
    const $item = $(item);
    const row: TaxDeedRow = {
      aid: $item.attr("aid"),
      status,
      saleDate: requestedSaleDate,
    };
    let lastLabel = "";

    $item.find("table.ad_tab > tbody > tr").each((__, tr) => {
      const $tr = $(tr);
      const label = $tr.find("td.AD_LBL").first().text().trim().replace(/:$/, "");
      const $data = $tr.find("td.AD_DTA").first();
      const $a = $data.find("a").first();
      const linkText = $a.text().trim();
      const cellText = $data.text().trim();
      const value = (linkText || cellText).trim();

      if (!label) {
        // Unlabeled continuation row — city/state/zip line of the address.
        if (lastLabel === "Property Address" && cellText && row.propertyAddress) {
          row.propertyAddress = `${row.propertyAddress}, ${cellText}`;
        }
        return;
      }
      lastLabel = label;

      switch (label) {
        case "Auction Type":
          row.auctionType = value;
          break;
        case "Case #":
          row.caseNumber = value;
          break;
        case "Certificate #":
          row.certificateNumber = value;
          break;
        case "Opening Bid":
          row.openingBid = value === "Hidden" ? undefined : parseDollar(value);
          break;
        case "Parcel ID": {
          // Prefer cell text (plain-text variants), then link text (Duval's
          // <a>-wrapped APN); validate every candidate.
          const candidates: string[] = [];
          if (cellText && cellText !== linkText) candidates.push(cellText);
          if (linkText) candidates.push(linkText);
          const apn = candidates.find(looksLikeTaxDeedApn);
          if (apn) row.parcelId = apn.replace(/\s+/g, "");
          break;
        }
        case "Property Address":
          row.propertyAddress = value || undefined;
          break;
        case "Assessed Value":
          row.assessedValue = parseDollar(value);
          break;
      }
    });

    if (row.caseNumber) rows.push(row);
  });

  return rows;
}

/**
 * Extract TAX-DEED sale dates from a CALENDAR page's HTML.
 *
 * Day boxes WITH a sale carry `dayid='MM/DD/YYYY'`; empty days have no
 * dayid. Each sale day's box also carries a CALTEXT label ('Tax Deed' vs
 * 'Foreclosure') because some counties (verified: Miami-Dade) serve BOTH
 * auction types from the realtaxdeed.com vhost — we only return days whose
 * box text says Tax Deed. Exported for tests.
 */
export function parseCalendarSaleDates(html: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $("[dayid]").each((_, el) => {
    const $el = $(el);
    const dayid = ($el.attr("dayid") ?? "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dayid)) return;
    if (!/tax\s*deed/i.test($el.text())) return; // skip Foreclosure-day boxes
    out.add(dayid);
  });
  return [...out].sort(
    (a, b) => (parseSaleDate(a)?.getTime() ?? 0) - (parseSaleDate(b)?.getTime() ?? 0),
  );
}

/**
 * Discover upcoming (and same-month recent) tax-deed sale dates for one
 * county by walking the calendar for the current + next `monthsAhead` months.
 */
export async function fetchTaxDeedSaleDates(opts: {
  subdomain: string;
  monthsAhead?: number; // default 2 (current month + 2 = 3 calendar GETs)
  useProxy?: boolean;
}): Promise<string[]> {
  const monthsAhead = opts.monthsAhead ?? 2;
  const useProxy = opts.useProxy ?? false;
  const now = new Date();
  const dates: string[] = [];

  for (let i = 0; i <= monthsAhead; i++) {
    const first = i === 0
      ? undefined
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const url = calendarUrl(opts.subdomain, first);
    const res = await politeFetch(url, {
      method: "GET",
      useProxy,
      rotateFingerprint: true, // WAF 403s the polite bot UA on the front door
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    if (res.status !== 200) continue;
    for (const d of parseCalendarSaleDates(html)) dates.push(d);
  }
  return [...new Set(dates)];
}

export interface RealTaxDeedResult {
  countyFips: string;
  saleDate: string;
  found: number;
  persisted: number;
}

/**
 * Scrape one (county, saleDate) tax-deed calendar via the authenticated XHR
 * endpoint and persist rows into Foreclosure (stageCode TAX_DEED/SOLD,
 * source 'realtaxdeed').
 */
export async function scrapeRealTaxDeed(opts: {
  countyFips: string;
  saleDate: string; // "MM/DD/YYYY"
  useProxy?: boolean;
}): Promise<RealTaxDeedResult | null> {
  const county = REALTAXDEED_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!county) return null;

  const useProxy = opts.useProxy ?? false;
  const sourceTag = `scraper:realtaxdeed-${opts.countyFips}`;
  const splash = splashUrl(county.subdomain, opts.saleDate);
  // Fresh session PER (county, date) — the CF session pins the auction date
  // at splash time and ignores the XHR's AuctionDate param (landmine (a)).
  const cookieHeader = await captureCookiesFromUrl(splash, { useProxy });

  const areas: Array<"W" | "R" | "C"> = ["W", "R", "C"];
  const rows: TaxDeedRow[] = [];
  const envelopesByArea: Record<string, { url: string; httpStatus: number; retHTMLBytes: number; bodyFirst200: string }> = {};

  for (const area of areas) {
    const url = xhrUrl(county.subdomain, area, opts.saleDate);
    let httpStatus = 0;
    let body = "";
    try {
      const res = await politeFetch(url, {
        method: "GET",
        useProxy,
        rotateFingerprint: true,
        headers: {
          Cookie: cookieHeader,
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json,text/javascript,*/*;q=0.01",
          Referer: splash,
        },
      });
      httpStatus = res.status;
      body = await res.text();
    } catch (err) {
      console.warn(
        `[realtaxdeed] ${opts.countyFips}/${opts.saleDate} AREA=${area} fetch failed: ${(err as Error).message}`,
      );
      envelopesByArea[area] = { url, httpStatus: 0, retHTMLBytes: 0, bodyFirst200: `ERROR: ${(err as Error).message}` };
      continue;
    }

    let retHTML = "";
    try {
      const envelope = JSON.parse(body) as { retHTML?: string };
      retHTML = typeof envelope.retHTML === "string" ? envelope.retHTML : "";
    } catch {
      retHTML = "";
    }
    envelopesByArea[area] = { url, httpStatus, retHTMLBytes: retHTML.length, bodyFirst200: body.slice(0, 200) };
    if (!retHTML) continue; // empty bucket for this date — not an error

    const decoded = decodeMacroHtml(retHTML);
    for (const r of parseTaxDeedRows(decoded, opts.saleDate, area)) rows.push(r);
  }

  // Bronze audit snapshot — same shape contract as the foreclosure scraper.
  const totalRetHtmlBytes = Object.values(envelopesByArea).reduce((s, e) => s + e.retHTMLBytes, 0);
  void captureRaw({
    entityType: "parcel",
    source: "xhr",
    sourceTag,
    category: "realtaxdeed_calendar",
    countyFips: opts.countyFips,
    requestParams: { splashUrl: splash, saleDate: opts.saleDate, areas },
    rawResponse: {
      extracted: rows,
      htmlBytes: totalRetHtmlBytes,
      htmlSample: "",
      envelopesByArea,
    },
    legalRisk: "yellow",
  });

  let persisted = 0;
  for (const r of rows) {
    // Landmine (b): combined-vhost counties interleave FORECLOSURE rows.
    // Persist only rows whose Auction Type is TAXDEED (or absent — the
    // calendar filter already restricted us to Tax Deed days).
    if (r.auctionType && !/tax\s*deed/i.test(r.auctionType)) continue;
    persisted += await persistTaxDeedAsForeclosure(opts.countyFips, r);
  }

  return {
    countyFips: opts.countyFips,
    saleDate: opts.saleDate,
    found: rows.length,
    persisted,
  };
}

/**
 * Mirror of the foreclosure scraper's persistAsForeclosure, tax-deed flavored:
 *   - stageCode 'TAX_DEED' for waiting/running rows (future/in-flight sales).
 *   - Area-C ("closed") rows: 'SOLD' when the sale date is past, 'DISMISSED'
 *     when the sale date is still in the FUTURE — verified live (Escambia
 *     08/05/2026): future dates carry area-C items that were closed BEFORE
 *     the sale, i.e. redeemed/canceled under FL Ch.197 (owner can redeem the
 *     certificate any time before the sale). Both feed AuctionSummary's
 *     pastAuctionCount; scheduled tax-deed sales stay distinguishable from
 *     judicial-foreclosure SCHEDULED rows.
 *   - source fixed at 'realtaxdeed' (countyFips is part of the unique key).
 * Certificate # / Assessed Value / Property Address have no Foreclosure
 * columns this wave — they are retained in the RawCapture bronze payload.
 */
async function persistTaxDeedAsForeclosure(countyFips: string, r: TaxDeedRow): Promise<number> {
  if (!r.caseNumber) return 0;
  const saleTime = parseSaleDate(r.saleDate)?.getTime();
  const saleInFuture = saleTime !== undefined && saleTime !== null && saleTime > Date.now();
  const stageCode =
    r.status === "sold" ? (saleInFuture ? "DISMISSED" : "SOLD") : "TAX_DEED";
  const safeApn = looksLikeTaxDeedApn(r.parcelId) ? r.parcelId : null;

  try {
    await prisma.foreclosure.upsert({
      where: {
        countyFips_caseNumber_stageCode_source: {
          countyFips,
          caseNumber: r.caseNumber,
          stageCode,
          source: REALTAXDEED_SOURCE,
        },
      },
      create: {
        countyFips,
        apn: safeApn,
        stageCode,
        auctionDate: parseSaleDate(r.saleDate),
        judgmentAmount: null, // no judgment in a tax-deed sale
        openingBid: r.openingBid ?? null,
        caseNumber: r.caseNumber,
        trusteeId: r.caseNumber, // realauction case id, mirrors foreclosure path
        source: REALTAXDEED_SOURCE,
      },
      update: {
        auctionDate: parseSaleDate(r.saleDate) ?? undefined,
        openingBid: r.openingBid ?? undefined,
        apn: safeApn ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[realtaxdeed] persist failed:", (err as Error).message);
    return 0;
  }
}
