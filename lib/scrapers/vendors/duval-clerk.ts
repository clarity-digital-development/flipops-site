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
  });

  try {
    const page = await sess.newPage();
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

    // Step 1: Accept disclaimer
    await page.click("#btnButton", { timeout: 10_000 }).catch(() => {
      // Disclaimer may already be accepted if session is restored
    });

    // Step 2: Wait for the search form
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });

    // Step 3: Fill date and submit. Use type-clear-and-fill since the input
    // has a default value.
    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", dateStr);

    // Step 4: Click search and wait for the SPECIFIC AJAX response that
    // loads the Kendo grid (`/Search/PartialGrid`). networkidle was unreliable
    // because the page has long-poll requests that keep the network busy.
    // Race the two possible signal patterns from AcclaimSearchPages.js:
    //   - GET /Search/PartialGrid (loads the results table)
    //   - GET /Search/HasResults (the JS calls this first to decide)
    const searchResponseP = page.waitForResponse(
      (resp) => /\/Search\/(PartialGrid|HasResults)/i.test(resp.url()),
      { timeout: 60_000 },
    ).catch(() => null);
    await page.click("#btnSearch");
    await searchResponseP;
    // After AJAX response, give Kendo's render lifecycle one more pass
    await page.waitForTimeout(2500);
    // If the grid is supposed to have rows, wait briefly for the first one
    await page.waitForSelector("#RsltsGrid tbody tr, .k-grid-content tbody tr, .gridDiv tr", { timeout: 10_000 }).catch(() => {});

    // Step 5: Read the rendered HTML
    const html = await page.content();
    const $ = cheerio.load(html);

    // The Kendo grid renders <tr> inside #RsltsGrid. Headers + data rows.
    // We grab the data rows from inside tbody.
    const rows: DuvalRecording[] = [];
    $("#RsltsGrid tbody tr, .k-grid-content tbody tr").each((_, tr) => {
      const cells = $(tr).find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 3) return;
      // Header order (per Duval UI): Name | Instrument # | Doc Type | Record Date | Consideration | Book/Page | Case #
      // Some columns may be hidden but the data row preserves column order.
      const [, instrument, docType, recordDate, consideration, bookPage] = cells;
      if (!docType) return;
      rows.push({
        documentType: docType,
        documentNumber: instrument || undefined,
        recordingDate: recordDate || undefined,
        consideration: parseConsideration(consideration),
        bookPage: bookPage || undefined,
        parties: cells[0] || undefined,
      });
    });

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
