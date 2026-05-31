import * as cheerio from "cheerio";
import { PlaywrightSession } from "../base/playwright-session";
import type { Page } from "playwright-chromium";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Orange County (FL, FIPS 12095) delinquent real-estate tax scraper.
//
// Source: lienhub.com/county/orange/certsale — RealAuction/LienHub's PUBLIC
// "View Advertised List" view of the annual Tax Certificate Sale per FL §
// 197.402. No bidder registration is required for the advertised list (only
// for placing bids), so the entire delinquent universe is reachable as a
// public web view.
//
// Direct HTTP to octaxcol.com / lienhub.com returns 403 (Akamai bot wall),
// so we drive a stealth-chromium browser. The cost is real (~1-2s/page,
// ~7 min for ~209 pages) but the data is otherwise unreachable.
//
// Page structure (verified 2026-05-30):
//   • Auction main: /county/orange/certsale/main
//     → bears the "AdvertisedList" link with a per-session unique_id token
//   • Advertised list: same path + ?use_this=print_advertised_list
//     → 100 rows per page, ~209 pages, total ~20,900 advertised parcels
//   • Pagination is a POST to the same path with page_number=N and the
//     form's SEC token preserved. We invoke the page's own go_to_page(N)
//     JS function via page.evaluate(), which submits the form and re-renders
//     the table — DOM-driven so we read the resulting <table> after each step.
//
// Table columns (in order):
//   [Adv No, Account No, Homestead, Legal 1, Owner Name, Face Amount]
//
//   Account No format: "01-20-27-0000-00010"
//   Transform: strip dashes → "012027000000010" (15 digits)
//   This matches our Parcel.apn format for Orange exactly — verified at
//   100% on the first 3 samples (DB join produced situs + market value for
//   every one).
//
// Tax year: the 2026 advertised list represents 2025 delinquent taxes
// (FL § 197.333: taxes due Nov 1, delinquent April 1 of the following year,
// certificate sale held in May/June). We derive the year from the auction
// page title ("2026 Orange County Tax Lien Auction" → delinquentYear = 2025)
// and record it on each Lien row.
//
// Unique key in Lien: (countyFips, documentNumber=<apn>-<taxYear>, source)
// So a parcel delinquent across multiple years still produces one row per
// year per scrape source, never collapsing distinct delinquencies.
// ---------------------------------------------------------------------------

const AUCTION_MAIN_URL = "https://lienhub.com/county/orange/certsale/main";
const COUNTY_FIPS = "12095";

interface DelinquentRecord {
  advNumber: number;
  apn: string;          // 15-digit Account No, dashes stripped
  homestead: boolean;
  legalDescription: string;
  ownerName: string;
  amount: number;
  taxYear: number;      // derived from auction title
}

export interface OrangeTaxDelinquentResult {
  found: number;
  totalReported: number;
  totalPages: number;
  persisted: number;
  skippedHallucinated: number;
  taxYear: number;
}

/**
 * Scrape Orange County's annual tax certificate sale advertised list.
 * Returns counts; data persists to Lien table with lienCategory='tax'.
 */
export async function scrapeOrangeTaxDelinquent(): Promise<OrangeTaxDelinquentResult> {
  // Headed: false / stealth-chromium — LienHub blocks vanilla automation.
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  const sourceTag = `scraper:lienhub-orange-tax-${new Date().toISOString().slice(0, 10)}`;
  const today = new Date();

  let allRecords: DelinquentRecord[] = [];
  let totalPages = 0;
  let totalReported = 0;
  let taxYear = today.getFullYear() - 1;

  try {
    const page = await sess.newPage();

    // 1) Land on the auction main page to populate the session + discover
    //    the dynamic unique_id token embedded in the AdvertisedList link.
    await page.goto(AUCTION_MAIN_URL, { waitUntil: "networkidle", timeout: 60_000 });

    // Locate the AdvertisedList link to get the right unique_id
    const advLink = await page.$$eval("a", (as) => {
      const found = as.find((a) => /advertised\s*list/i.test(a.textContent || ""));
      return found ? (found as HTMLAnchorElement).href : null;
    });
    if (!advLink) {
      throw new Error("Could not find AdvertisedList link on certsale/main — auction may be inactive");
    }
    console.log(`[orange-tax-delinquent] resolved advertised list URL: ${advLink}`);

    // 2) Open page 1 of the advertised list
    await page.goto(advLink, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("table.adv_list, table.dataTable", { timeout: 30_000 });

    // Derive tax year from the page title (auction year → delinquent year is
    // auction year - 1 under FL § 197.333 timing).
    const title = await page.title();
    const yearMatch = title.match(/(20\d{2})\s+Orange\s+County\s+Tax\s+Lien\s+Auction/i);
    const auctionYear = yearMatch ? parseInt(yearMatch[1], 10) : today.getFullYear();
    taxYear = auctionYear - 1;
    console.log(`[orange-tax-delinquent] auction year=${auctionYear} → tax year=${taxYear}`);

    // Discover total pages by clamping: jump to a page beyond any possible
    // size (the server caps to the last actual page) and read the highest
    // advNumber from the last row, then compute pages = ceil(maxAdvNo/100).
    //
    // Why not parse the pagination links: on page 1 LienHub renders only
    // "Next >>" with no numeric page links, so there's no upper bound there.
    // The "go beyond and clamp" technique is the most reliable way to find
    // the universe size.
    totalPages = await discoverTotalPagesByClamp(page);
    if (!totalPages || totalPages < 1) totalPages = 1;
    console.log(`[orange-tax-delinquent] discovered ${totalPages} pages`);

    // After the clamp probe we're on the LAST page. Navigate back to page 1
    // before starting the forward walk.
    await navigateToPage(page, 1);

    // 3) Capture one bronze snapshot of page 1 — both for audit and so we
    //    have a sample of the rendered structure if the parser ever drifts.
    const firstHtml = await page.content();
    void captureRaw({
      entityType: "parcel",
      source: "lienhub",
      sourceTag,
      category: "tax_delinquent_notice",
      countyFips: COUNTY_FIPS,
      requestParams: { url: advLink, totalPages, auctionYear, taxYear },
      rawResponse: { totalPages, firstPageHtmlSample: firstHtml.slice(0, 30_000) },
      legalRisk: "yellow",
    });

    // Parse page 1
    allRecords.push(...parseRecords(firstHtml, taxYear));
    let lastLogged = 0;

    // 4) Walk remaining pages by invoking the page's own go_to_page(N) — that
    //    submits the hidden form with SEC + page_number=N and re-renders the
    //    same table in place. We wait for the row indices to advance to
    //    confirm the page transition before parsing.
    for (let p = 2; p <= totalPages; p++) {
      try {
        const ok = await navigateToPage(page, p);
        if (!ok) {
          console.warn(`[orange-tax-delinquent] page ${p} did not advance; retrying once`);
          await page.waitForTimeout(2_000);
          const ok2 = await navigateToPage(page, p);
          if (!ok2) {
            console.warn(`[orange-tax-delinquent] page ${p} failed after retry; skipping`);
            continue;
          }
        }
        const html = await page.content();
        const rows = parseRecords(html, taxYear);
        allRecords.push(...rows);
        if (allRecords.length - lastLogged >= 1_000 || p === totalPages) {
          console.log(`[orange-tax-delinquent] paginated ${allRecords.length} records through page ${p}/${totalPages}`);
          lastLogged = allRecords.length;
        }
      } catch (err) {
        console.warn(`[orange-tax-delinquent] page ${p} failed: ${(err as Error).message}`);
        // Continue — partial data is more useful than no data.
      }
    }

    // The highest Adv No we saw is the source's reported total.
    totalReported = allRecords.reduce((max, r) => Math.max(max, r.advNumber), 0);
    console.log(`[orange-tax-delinquent] paginated total: ${allRecords.length}, max advNumber=${totalReported}`);
  } finally {
    await sess.close();
  }

  // 5) Persist via bulk-upsert
  let skippedHallucinated = 0;
  const upsertRows: LienUpsertInput[] = [];
  for (const r of allRecords) {
    if (looksHallucinated(r)) { skippedHallucinated++; continue; }
    upsertRows.push({
      countyFips:       COUNTY_FIPS,
      apn:              r.apn,
      documentNumber:   `${r.apn}-${r.taxYear}`,
      source:           sourceTag,
      lienCategory:     "tax",
      lienTypeCode:     `DELINQUENT_TAX_${r.taxYear}`,
      recordingDate:    today,
      amount:           r.amount,
      defendantName:    r.ownerName,
      plaintiffAddress: null,
    });
  }
  console.log(`[orange-tax-delinquent] bulk-upserting ${upsertRows.length} rows…`);
  const bulkResult = await bulkUpsertLiens(upsertRows);
  console.log(
    `[orange-tax-delinquent] bulk-upsert done: persisted=${bulkResult.persisted} batches=${bulkResult.batches} in ${(bulkResult.durationMs / 1000).toFixed(1)}s`,
  );
  const persisted = bulkResult.persisted;

  return {
    found: allRecords.length,
    totalReported,
    totalPages,
    persisted,
    skippedHallucinated,
    taxYear,
  };
}

/**
 * Probe-and-clamp: jump to a page far beyond any possible size. The server
 * caps to the last actual page, so the highest Adv No on the resulting
 * table tells us the universe size. Returns ceil(maxAdvNo / 100).
 */
async function discoverTotalPagesByClamp(page: Page): Promise<number> {
  const PROBE_PAGE = 999_999;
  const before = await page.evaluate(() => {
    const c = document.querySelector("table.adv_list tr.even td, table.adv_list tr.odd td, table.dataTable tr td");
    return c ? (c.textContent || "").trim() : "";
  });
  await page.evaluate((n) => {
    const w = window as unknown as { go_to_page?: (n: number) => void };
    if (typeof w.go_to_page === "function") w.go_to_page(n);
  }, PROBE_PAGE);
  // Wait for the table's first Adv No to change.
  try {
    await page.waitForFunction(
      (prev) => {
        const c = document.querySelector("table.adv_list tr.even td, table.adv_list tr.odd td, table.dataTable tr td");
        const cur = c ? (c.textContent || "").trim() : "";
        return cur !== "" && cur !== prev;
      },
      before,
      { timeout: 30_000 },
    );
  } catch {
    // If the table didn't change at all the auction may be a single page.
  }

  // Read the highest Adv No on the resulting table.
  const maxAdvNo = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table.adv_list tr, table.dataTable tr"));
    let max = 0;
    for (const tr of rows) {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 6) continue;
      const advText = (tds[0].textContent || "").trim();
      const n = parseInt(advText.replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
  });
  return Math.ceil(maxAdvNo / 100);
}

/**
 * Drive the page's own go_to_page(N) JS to navigate, then wait until the
 * first row's Adv No reflects the new page (page N starts at advNumber
 * ((N-1)*100)+1, or until rows differ from before).
 */
async function navigateToPage(page: Page, pageNumber: number): Promise<boolean> {
  const beforeFirstAdvNo = await page.evaluate(() => {
    const cell = document.querySelector("table.adv_list tr.even td, table.adv_list tr.odd td, table.dataTable tr td");
    return cell ? (cell.textContent || "").trim() : "";
  });

  await page.evaluate((n) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as unknown as { go_to_page?: (n: number) => void };
    if (typeof win.go_to_page === "function") win.go_to_page(n);
  }, pageNumber);

  // Wait for the table's first Adv No to change, signalling re-render.
  try {
    await page.waitForFunction(
      (prev) => {
        const cell = document.querySelector("table.adv_list tr.even td, table.adv_list tr.odd td, table.dataTable tr td");
        const cur = cell ? (cell.textContent || "").trim() : "";
        return cur && cur !== prev;
      },
      beforeFirstAdvNo,
      { timeout: 20_000 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Parse one page's advertised-list table. */
function parseRecords(html: string, taxYear: number): DelinquentRecord[] {
  const $ = cheerio.load(html);
  const records: DelinquentRecord[] = [];

  // Locate the data table by class — LienHub uses `adv_list` consistently.
  const $table = $("table.adv_list").first().length
    ? $("table.adv_list").first()
    : $("table.dataTable").first();
  if (!$table.length) return records;

  const rows = $table.find("tr").toArray();
  for (let i = 0; i < rows.length; i++) {
    const cells = $(rows[i]).find("td").toArray();
    if (cells.length < 6) continue; // header has <th> only; data rows have 6 <td>

    const advText = $(cells[0]).text().trim();
    const advNumber = parseInt(advText.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(advNumber) || advNumber < 1) continue;

    const acctText = $(cells[1]).text().trim();
    // Account No format: "01-20-27-0000-00010" → strip dashes → 15 digits.
    const apn = acctText.replace(/\D/g, "");
    if (apn.length !== 15) continue;

    const homesteadText = $(cells[2]).text().trim();
    const homestead = /^yes$/i.test(homesteadText);

    const legalDescription = $(cells[3]).text().replace(/\s+/g, " ").trim();
    const ownerName = $(cells[4]).text().replace(/\s+/g, " ").trim();

    const amountText = $(cells[5]).text().trim();
    const amount = parseFloat(amountText.replace(/[^\d.]/g, ""));

    records.push({
      advNumber,
      apn,
      homestead,
      legalDescription,
      ownerName,
      amount: Number.isFinite(amount) ? amount : 0,
      taxYear,
    });
  }
  return records;
}

// Hallucination guard — defends against malformed scrapes even though this
// is direct HTML parsing (no LLM in the loop).
function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.apn || !/^\d{15}$/.test(r.apn)) return true;            // malformed APN
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true; // unreasonable year
  if (!r.ownerName) return true;                                  // missing owner
  if (/^(john|jane)\s+(doe|smith)|^test\b|^sample\b/i.test(r.ownerName)) return true;
  if (r.amount < 0 || r.amount > 1e8) return true;                // impossible amounts
  return false;
}
