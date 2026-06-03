import * as cheerio from "cheerio";
import { PlaywrightSession } from "../base/playwright-session";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { REALAUCTION_COUNTIES, type RealAuctionTrack } from "./realauction";

// ---------------------------------------------------------------------------
// RealAuction Playwright scraper (F2.2, post-pivot 2026-05-29).
//
// Discovery: contrary to our earlier assumption, the auction CALENDAR is
// PUBLIC — no login required. The login form on the splash page is for
// BIDDERS, not viewers. Pattern verified against Duval foreclosure:
//
//   URL:  https://{county}.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW
//   Equivalent tax-deed: realtaxdeed.com domain, same URL pattern
//   Returns: real public auction calendar with full case details
//
// Data layout (verified — see scripts/probe-artifacts/realauction-dom-analysis-2026-06-03.md):
//   - "Running" / "Waiting" / "Closed" auctions are injected into
//     div#Area_R / div#Area_W / div#Area_C via XHR AFTER the page loads.
//   - Each auction is a `div[id^='AITEM_']` with a nested `table.ad_tab`:
//       Auction Type:    FORECLOSURE | TAX DEED
//       Case #:          16-2023-CA-011271-XXXX-MA
//       Final Judgment Amount: $194,101.91
//       Parcel ID:       <a href="...pao...">035892-0000</a>
//       Property Address: 9256 5TH AVE
//                         JACKSONVILLE, FL- 32208   (continuation row, empty AD_LBL)
//       Assessed Value:  $92,567.00
//       Plaintiff Max Bid: $216,205.58  (or literal "Hidden" in preview)
//
//   The auction DATE comes from the URL request param `AuctionDate=MM/DD/YYYY`
//   — it is NOT in the static DOM until the page polls. Passing it through
//   from the caller is the correct approach.
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

function urlFor(track: RealAuctionTrack, subdomain: string): string {
  const root =
    track === "foreclosure" ? "realforeclose.com" :
    track === "tax-deed"    ? "realtaxdeed.com" :
                              "realtaxlien.com";
  return `https://${subdomain}.${root}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW`;
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
function parseAuctionRows(html: string, requestedAuctionDate?: string): AuctionRow[] {
  const $ = cheerio.load(html);
  const auctions: AuctionRow[] = [];

  // Determine each AITEM's status by its enclosing Area_{R|W|C} container.
  // Falls back to "waiting" when the container is absent.
  // (cheerio's Element type isn't exported in v1; use the generic node type.)
  const statusFor = (item: unknown): AuctionRow["status"] => {
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

export async function scrapeRealAuctionsPlaywright(opts: {
  countyFips: string;
  track: RealAuctionTrack;
  useProxy?: boolean;
  auctionDate?: string; // "MM/DD/YYYY" — defaults to today
}): Promise<RealAuctionPlaywrightResult | null> {
  const county = REALAUCTION_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!county) return null;
  if (!county.tracks.includes(opts.track)) return null;

  const url = urlFor(opts.track, county.subdomain);
  const sourceTag = `scraper:realauction-pw-${opts.countyFips}-${opts.track}`;

  // Default auction date = today, MM/DD/YYYY
  const today = new Date();
  const defaultDate = `${String(today.getUTCMonth() + 1).padStart(2, "0")}/${String(today.getUTCDate()).padStart(2, "0")}/${today.getUTCFullYear()}`;
  const auctionDate = opts.auctionDate ?? defaultDate;

  const sess = new PlaywrightSession({ useProxy: opts.useProxy ?? false, headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // settle for any async render

    const html = await page.content();
    const rows = parseAuctionRows(html, auctionDate);

    void captureRaw({
      entityType: "parcel",
      source: "playwright",
      sourceTag,
      category: "realauction_calendar",
      countyFips: opts.countyFips,
      requestParams: { url, track: opts.track, auctionDate },
      rawResponse: { extracted: rows, htmlBytes: html.length, htmlSample: html.slice(0, 8000) },
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
  } finally {
    await sess.close();
  }
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
