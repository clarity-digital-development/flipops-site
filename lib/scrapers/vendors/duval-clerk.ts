import * as cheerio from "cheerio";
import { PlaywrightSession } from "../base/playwright-session";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";

// ---------------------------------------------------------------------------
// Duval County Clerk of Court — Official Records bulk scraper.
//
// Per FL-COVERAGE-PLAN.md Phase F2.1 (top-5 metros custom path approved by
// user 2026-05-29 — switching from "one Firecrawl scraper per platform" to
// "custom Playwright scraper per top-5 metro" after ASP.NET MVC AsyncForm
// AJAX flow proved too per-county to reverse-engineer at scale).
//
// Flow (verified via probe-duval-clerk.ts + inspect-duval-clerk-script.ts):
//   1. Playwright opens or.duvalclerk.com/search/SearchTypeRecordDate
//   2. Click "I accept" (#btnButton) → search form loads
//   3. Clear date input, type target date
//   4. Click #btnSearch → JS AJAX submits form
//   5. Wait for #RsltsGrid (Kendo grid) to populate
//   6. Read rows from the grid table
//   7. Map each row → Mortgage / Lien / Foreclosure based on Doc Type
//
// Persists via the same Mortgage / Lien / Foreclosure model as the
// (now-deprecated) Firecrawl scraper. The hallucination guard isn't
// needed here because we're reading the actual DOM — if there's no
// data, the grid is empty, not fabricated.
// ---------------------------------------------------------------------------

const COUNTY_FIPS = "12031";
const BASE_URL = "https://or.duvalclerk.com";
const SEARCH_URL = `${BASE_URL}/search/SearchTypeRecordDate`;

export interface DuvalRecording {
  documentType: string;
  documentNumber?: string;
  recordingDate?: string;
  parties?: string;
  consideration?: number;
  bookPage?: string;
}

export interface DuvalScrapeResult {
  date: string;
  found: number;
  persistedMortgages: number;
  persistedLiens: number;
  persistedForeclosures: number;
  rejectedHallucinated: number;
}

/**
 * Scrape Duval Clerk official records for a single date.
 * Duval's date-search is per-day; iterate dates externally for ranges.
 */
export async function scrapeDuvalRecordings(opts: {
  date: Date;
  useProxy?: boolean;
}): Promise<DuvalScrapeResult> {
  const dateStr = `${opts.date.getMonth() + 1}/${opts.date.getDate()}/${opts.date.getFullYear()}`;
  const sourceTag = `scraper:duval-clerk-${dateStr.replace(/\//g, "-")}`;

  const sess = new PlaywrightSession({
    useProxy: opts.useProxy ?? false,
    headless: true,
    navTimeoutMs: 90_000,
    engine: "stealth-chromium", // Required — vanilla Playwright is silently filtered to 0 rows
  });

  try {
    const page = await sess.newPage();

    // Step 0: Session warming — visit landing + Support to look like a
    // human's natural flow, not a direct-to-search hit. This pattern
    // verified working in probe-duval-stealth.ts.
    await page.goto("https://or.duvalclerk.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);
    await page.goto("https://or.duvalclerk.com/Support", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);

    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

    // Step 1: Accept disclaimer
    await page.click("#btnButton", { timeout: 10_000 }).catch(() => {});

    // Step 2: Wait for the search form
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });
    await page.waitForTimeout(1500); // human pause

    // Step 3: Fill date and submit.
    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", dateStr);
    await page.waitForTimeout(500 + Math.random() * 500);

    // Step 4: Click search and wait for grid AJAX.
    const searchResponseP = page.waitForResponse(
      (resp) => /\/Search\/(PartialGrid|HasResults)/i.test(resp.url()),
      { timeout: 60_000 },
    ).catch(() => null);
    await page.click("#btnSearch");
    await searchResponseP;
    await page.waitForTimeout(4000);
    await page.waitForSelector("#RsltsGrid tbody tr, .k-grid-content tbody tr, .gridDiv tr", { timeout: 10_000 }).catch(() => {});

    // Step 5: Bump page size to 500 via the Kendo grid's own dataSource
    // pageSize() — calling it on the dropdown wasn't enough (the dropdown
    // value updated but the grid didn't repaint). Going directly to the
    // grid's data source IS what the dropdown's "change" handler does
    // internally, so we just do it ourselves.
    // page.evaluate runs a STATIC closure in the page context — no untrusted
    // input interpolated, so JS-eval injection risks don't apply.
    const pagedRespP = page.waitForResponse((r) => /\/Search\/PartialGrid/i.test(r.url()), { timeout: 30_000 }).catch(() => null);
    await page.evaluate(() => {
      const w = window as { kendo?: { jQuery?: (sel: string) => { data: (k: string) => unknown } } };
      const grid = w.kendo?.jQuery?.("#RsltsGrid")?.data?.("kendoGrid") as
        | { dataSource: { pageSize: (n: number) => void } } | undefined;
      if (grid) grid.dataSource.pageSize(500);
    }).catch(() => { });
    await pagedRespP;
    await page.waitForTimeout(3000);

    // Step 6: Iterate pages — parse each page's rows directly, then click next
    // until pagination ends or safety cap hits. Collecting DuvalRecording
    // objects directly avoids the re-serialize-cheerio-node dance.
    const rows: DuvalRecording[] = [];
    const seenDocNums = new Set<string>();
    let pageNum = 1;
    const maxPages = 30; // safety cap; 500 rows/page × 30 = 15k

    while (pageNum <= maxPages) {
      // Parse current page's rows
      const pageHtml = await page.content();
      const $$ = cheerio.load(pageHtml);
      let newOnThisPage = 0;
      $$("#RsltsGrid tbody tr, .k-grid-content tbody tr").each((_, tr) => {
        const cells = $$(tr).find("td").map((_, td) => $$(td).text().trim()).get();
        if (cells.length < 7) return;
        const grantor = cells[2];
        const grantee = cells[3];
        const instrumentNumber = cells[4];
        const recordDate = cells[5];
        const docType = cells[6];
        const bookPage = cells[8];
        if (!docType || !instrumentNumber) return;
        if (seenDocNums.has(instrumentNumber)) return; // dedup across page transitions
        seenDocNums.add(instrumentNumber);
        rows.push({
          documentType: docType,
          documentNumber: instrumentNumber,
          recordingDate: recordDate || undefined,
          bookPage: bookPage || undefined,
          parties: [grantor, grantee].filter(Boolean).join(" → ") || undefined,
        });
        newOnThisPage++;
      });

      if (newOnThisPage === 0) break; // safety: nothing new = end of data

      // Click the next-page button via JS — this works regardless of
      // ambiguity in Kendo's class naming. page.evaluate runs a static
      // closure in the page context (no untrusted input interpolated).
      const nextRespP = page.waitForResponse((r) => /\/Search\/PartialGrid/i.test(r.url()), { timeout: 30_000 }).catch(() => null);
      const clicked = await page.evaluate(() => {
        const sel = "a.k-pager-nav[title='Go to the next page'], a.k-pager-nav[aria-label='Go to the next page']";
        const a = document.querySelector(sel) as HTMLAnchorElement | null;
        if (!a) return false;
        if (a.classList.contains("k-disabled") || a.classList.contains("k-state-disabled") ||
            a.getAttribute("aria-disabled") === "true") return false;
        a.click();
        return true;
      });
      if (!clicked) break; // no next-page link or it's disabled
      await nextRespP;
      await page.waitForTimeout(2500);
      pageNum++;
    }

    // The pagination loop above already accumulated all `rows`. Capture the
    // final-page HTML for bronze so we have a sample of the rendered grid.
    // Column-order reference (verified):
    //   td[2]=Grantor  td[3]=Grantee  td[4]=Instrument#  td[5]=RecDate
    //   td[6]=DocType  td[7]=BookType td[8]=Book/Page    td[9]=Legal
    const html = await page.content();

    // Bronze: capture the rendered HTML + extracted rows
    void captureRaw({
      entityType: "parcel",
      source: "playwright",
      sourceTag,
      category: "clerk_recordings_bulk",
      countyFips: COUNTY_FIPS,
      requestParams: { url: SEARCH_URL, date: dateStr },
      rawResponse: { extracted: rows, htmlBytes: html.length, htmlSample: html.slice(0, 30_000) },
      legalRisk: "yellow",
    });

    const result: DuvalScrapeResult = {
      date: dateStr,
      found: rows.length,
      persistedMortgages: 0,
      persistedLiens: 0,
      persistedForeclosures: 0,
      rejectedHallucinated: 0, // not applicable for DOM scrape
    };

    // Persist each row
    for (const r of rows) {
      const recordingDate = parseDate(r.recordingDate) ?? opts.date;
      const c = classifyDocument(r.documentType);
      if (c === "mortgage") result.persistedMortgages += await persistMortgage(r, recordingDate, sourceTag);
      else if (c === "lien") result.persistedLiens += await persistLien(r, recordingDate, sourceTag);
      else if (c === "foreclosure") result.persistedForeclosures += await persistForeclosure(r, recordingDate, sourceTag);
    }

    return result;
  } finally {
    await sess.close();
  }
}

// ---------------------------------------------------------------------------
// Classification + persistence helpers
// ---------------------------------------------------------------------------

function classifyDocument(type: string): "mortgage" | "lien" | "foreclosure" | "deed" | "satisfaction" | "other" {
  const t = type.toLowerCase();
  if (/lis\s*pendens|notice\s*of\s*default|foreclosure/.test(t)) return "foreclosure";
  if (/mortgage|deed\s*of\s*trust/.test(t) && !/satisfaction|release/.test(t)) return "mortgage";
  if (/satisfaction|release\s*of\s*mortgage/.test(t)) return "satisfaction";
  if (/lien|judgment|claim/.test(t)) return "lien";
  if (/deed|warranty|quit\s*claim|tax\s*deed/.test(t) && !/of\s*trust/.test(t)) return "deed";
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
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // Common formats: "M/D/YYYY", "YYYY-MM-DD"
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function persistMortgage(r: DuvalRecording, recordingDate: Date, source: string): Promise<number> {
  if (!r.documentNumber) return 0;
  try {
    await prisma.mortgage.upsert({
      where: { countyFips_documentNumber_source: { countyFips: COUNTY_FIPS, documentNumber: r.documentNumber, source } },
      create: {
        countyFips: COUNTY_FIPS,
        recordingDate,
        loanAmount: r.consideration ?? null,
        mortgageType: r.documentType,
        documentNumber: r.documentNumber,
        orBook: r.bookPage?.split("/")[0] ?? null,
        orPage: r.bookPage?.split("/")[1] ?? null,
        source,
      },
      update: { loanAmount: r.consideration ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[duval-clerk] mortgage persist failed:", (err as Error).message);
    return 0;
  }
}

async function persistLien(r: DuvalRecording, recordingDate: Date, source: string): Promise<number> {
  if (!r.documentNumber) return 0;
  try {
    await prisma.lien.upsert({
      where: { countyFips_documentNumber_source: { countyFips: COUNTY_FIPS, documentNumber: r.documentNumber, source } },
      create: {
        countyFips: COUNTY_FIPS,
        lienCategory: classifyLien(r.documentType),
        recordingDate,
        amount: r.consideration ?? null,
        lienTypeCode: r.documentType,
        documentNumber: r.documentNumber,
        orBook: r.bookPage?.split("/")[0] ?? null,
        orPage: r.bookPage?.split("/")[1] ?? null,
        source,
      },
      update: { amount: r.consideration ?? undefined },
    });
    return 1;
  } catch (err) {
    console.warn("[duval-clerk] lien persist failed:", (err as Error).message);
    return 0;
  }
}

async function persistForeclosure(r: DuvalRecording, recordingDate: Date, source: string): Promise<number> {
  const caseNumber = r.documentNumber ?? `duval-${recordingDate.toISOString().slice(0, 10)}-${r.parties?.slice(0, 8) ?? "unknown"}`;
  const stageCode = /lis\s*pendens/i.test(r.documentType) ? "LP"
    : /notice\s*of\s*default/i.test(r.documentType) ? "NOD"
    : /foreclosure\s*sale/i.test(r.documentType) ? "SCHEDULED"
    : "LP";
  try {
    await prisma.foreclosure.upsert({
      where: { countyFips_caseNumber_stageCode_source: { countyFips: COUNTY_FIPS, caseNumber, stageCode, source } },
      create: {
        countyFips: COUNTY_FIPS,
        stageCode,
        filingDate: recordingDate,
        caseNumber,
        source,
      },
      update: {},
    });
    return 1;
  } catch (err) {
    console.warn("[duval-clerk] foreclosure persist failed:", (err as Error).message);
    return 0;
  }
}
