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
// Data layout (verified):
//   - "Running Auctions" section: currently-live auctions
//   - "Auctions Waiting" section: scheduled upcoming auctions
//   - Each auction is a <table class="ad_tab"> with rows:
//       Auction Type:    FORECLOSURE | TAX DEED
//       Case #:          16-2023-CA-011271-XXXX-MA
//       Final Judgment Amount: $194,101.91
//       Parcel ID:       <link to Property Appraiser>
//       Plaintiff Max Bid: $216,205.58
//       Auction Starts:  06/01/2026 11:00 AM ET (in header before table)
//
// Same parser handles all 16 wired counties via the subdomain pattern.
// ---------------------------------------------------------------------------

interface AuctionRow {
  auctionStarts?: string;
  auctionType?: string;
  caseNumber?: string;
  finalJudgmentAmount?: number;
  parcelId?: string;
  plaintiffMaxBid?: number;
  status?: "running" | "waiting" | "sold" | "cancelled";
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

/** Parse the calendar page HTML into structured auction rows. */
function parseAuctionRows(html: string): AuctionRow[] {
  const $ = cheerio.load(html);
  const auctions: AuctionRow[] = [];

  // Section detection — text "Running Auctions" / "Auctions Waiting" / "Sold"
  // appears before its block of .ad_tab tables. Walk the DOM in order and
  // tag each .ad_tab with the most recent section header.
  let currentStatus: AuctionRow["status"] = "waiting";
  let currentStartTime: string | undefined;

  $("body *").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Section header detection (works for typical RealAuction page structure)
    if (/^Running Auctions/i.test(text) && text.length < 80) currentStatus = "running";
    else if (/^Auctions Waiting/i.test(text) && text.length < 80) currentStatus = "waiting";
    else if (/^Sold/i.test(text) && text.length < 30) currentStatus = "sold";
    else if (/^Cancelled/i.test(text) && text.length < 30) currentStatus = "cancelled";

    // Per-auction "Auction Starts" line precedes each ad_tab
    const startMatch = text.match(/^Auction Starts\s+([\d/]+\s+[\d:]+\s+[AP]M\s+ET)/i);
    if (startMatch && text.length < 100) currentStartTime = startMatch[1];

    if ($el.hasClass("ad_tab") && el.tagName === "table") {
      const row: AuctionRow = {
        status: currentStatus,
        auctionStarts: currentStartTime,
      };
      $el.find("tr").each((_, tr) => {
        const cells = $(tr).find("td").map((_, td) => $(td).text().trim()).get();
        if (cells.length < 2) return;
        const [label, ...rest] = cells;
        const value = rest.join(" ").trim();
        switch (true) {
          case /Auction Type/i.test(label): row.auctionType = value; break;
          case /Case #/i.test(label): row.caseNumber = value; break;
          case /Final Judgment Amount/i.test(label): row.finalJudgmentAmount = parseDollar(value); break;
          case /Parcel ID/i.test(label): row.parcelId = $(tr).find("a").text().trim() || value; break;
          case /Plaintiff Max Bid/i.test(label): row.plaintiffMaxBid = parseDollar(value); break;
        }
      });
      if (row.caseNumber) auctions.push(row);
    }
  });

  return auctions;
}

function parseDollar(s: string): number | undefined {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseAuctionDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)\s+(AM|PM)/i);
  if (!m) return null;
  const [, mo, dd, yr, hr, mn, ampm] = m;
  let h = parseInt(hr, 10);
  if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  return new Date(Date.UTC(parseInt(yr, 10), parseInt(mo, 10) - 1, parseInt(dd, 10), h + 4, parseInt(mn, 10))); // ET → UTC (rough +4 for EDT)
}

export async function scrapeRealAuctionsPlaywright(opts: {
  countyFips: string;
  track: RealAuctionTrack;
  useProxy?: boolean;
}): Promise<RealAuctionPlaywrightResult | null> {
  const county = REALAUCTION_COUNTIES.find((c) => c.countyFips === opts.countyFips);
  if (!county) return null;
  if (!county.tracks.includes(opts.track)) return null;

  const url = urlFor(opts.track, county.subdomain);
  const sourceTag = `scraper:realauction-pw-${opts.countyFips}-${opts.track}`;

  const sess = new PlaywrightSession({ useProxy: opts.useProxy ?? false, headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // settle for any async render

    const html = await page.content();
    const rows = parseAuctionRows(html);

    void captureRaw({
      entityType: "parcel",
      source: "playwright",
      sourceTag,
      category: "realauction_calendar",
      countyFips: opts.countyFips,
      requestParams: { url, track: opts.track },
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

  try {
    await prisma.foreclosure.upsert({
      where: { countyFips_caseNumber_stageCode_source: { countyFips, caseNumber: r.caseNumber, stageCode, source } },
      create: {
        countyFips,
        apn: r.parcelId ?? null,
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
        apn: r.parcelId ?? undefined,
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
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips, documentNumber: r.caseNumber, source } },
      create: {
        countyFips,
        apn: r.parcelId ?? null,
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
