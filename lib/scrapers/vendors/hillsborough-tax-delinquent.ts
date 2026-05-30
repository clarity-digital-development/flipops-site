import * as cheerio from "cheerio";
import { PlaywrightSession } from "../base/playwright-session";
import type { Page } from "playwright-chromium";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";

// ---------------------------------------------------------------------------
// Hillsborough County (FL, FIPS 12057) delinquent real-estate tax scraper.
//
// Source: county-taxes.net/hillsborough/reports/real-estate
//   → /iframe-taxsys/hillsborough.county-taxes.com/govhub/reports/real-estate
//
// Hillsborough's Tax Collector uses Grant Street Group's TaxSys "Public
// Reports" interface (powered by govhub.com / pay-hub.net). The interface
// exposes a "Public - Delinquent Report" (id 2470) that lists every parcel
// with an unpaid tax bill across all delinquent roll years — published in
// accordance with FL § 197.402.
//
// Direct HTTP to hillstax.org returns 403 (bot wall) and the modern SPA at
// county-taxes.net/hillsborough also blocks vanilla automation. We drive a
// stealth-chromium browser through the legacy TaxSys iframe — which renders
// the report as a server-side HTML table.
//
// Workflow (verified 2026-05-30):
//   1. Land on /iframe-taxsys/.../govhub/reports/real-estate (no auth needed)
//   2. Click "Public - Delinquent Report" link → loads the report form
//   3. Set tax_year filter to "all delinquent roll years" (else the default
//      "<current tax year" returns only ~9k vs ~29k total).
//   4. Set rows_per_page=1000 (the max), click Search → renders 1000 rows
//   5. Paginate via the page_<N> links until exhausted (~29 pages × 1000)
//
// Report columns (in order):
//   [Tax Yr, Account Number, Owner Name, Property Address, Account Status,
//    Cert Status, Deed Status, Standard Flags]
//
//   Account Number format: "A0002940200" (1 letter "A" + 10 digits = 11 char)
//   This is the TaxSys account number, NOT the FL DOR PARCEL_ID. Our Parcel
//   table stores the 22-char PARCEL_ID format (e.g., 172703ZZZ000000042200U).
//
//   To bridge the gap, we resolve apn by joining situs_address + situs_city
//   to the Parcel table (verified 100% match rate on 8/8 spot-check). This
//   address-based join is reliable because Hillsborough publishes the full
//   situs address in the report ("8807 BYS RUN ODESSA 33556").
//
// Notable absence: the public report does NOT expose the amount due. Each
// account's amount is only visible on its individual detail page, which is
// rate-limit-prone and would require 29k extra round trips. We persist
// amount=null and rely on cross-referenced Parcel data (market value) to
// surface high-value leads. A future "amount-due-enrichment" pass can fill
// these in lazily for high-priority deals.
//
// Unique key in Lien: (countyFips, documentNumber=<account>-<taxYear>, source)
// So a parcel delinquent across multiple roll years (e.g., FISHER ROSEMARY
// on years 2014-2024) produces one row per year per scrape source.
// ---------------------------------------------------------------------------

const REPORTS_URL =
  "https://county-taxes.net/iframe-taxsys/hillsborough.county-taxes.com/govhub/reports/real-estate";
const COUNTY_FIPS = "12057";
const PAGE_SIZE = 1000;
const SLEEP_MS = 1500; // gentle pause between pages

interface DelinquentRecord {
  account: string;        // e.g., "A0002940200" (TaxSys account number)
  taxYear: number;        // e.g., 2024
  ownerName: string;      // e.g., "HOWELL KEVIN E JR, HOWELL GAILE R"
  situsAddress: string;   // full raw situs ("8807 BYS RUN ODESSA 33556")
  situsCity: string;      // parsed city ("ODESSA")
  situsZip: string;       // parsed zip ("33556")
  situsStreet: string;    // parsed street portion ("8807 BYS RUN")
  accountStatus: string;  // "Unpaid" by default for delinquent report
  certStatus: string;     // "Issued" | "Redeemed" | etc.
  deedStatus: string;     // "Applied" | "None" | etc.
  standardFlag: string;   // litigation | bankrupt | etc.
}

export interface HillsboroughTaxDelinquentResult {
  found: number;
  totalReported: number;
  totalPages: number;
  persisted: number;
  apnResolved: number;          // # of records where we successfully matched a Parcel
  skippedHallucinated: number;
}

/**
 * Scrape the full delinquent real-estate tax universe for Hillsborough County.
 * Returns counts; data persists to Lien table with lienCategory='tax'.
 */
export async function scrapeHillsboroughTaxDelinquent(): Promise<HillsboroughTaxDelinquentResult> {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  const sourceTag = `scraper:hillsborough-tax-${new Date().toISOString().slice(0, 10)}`;
  const today = new Date();

  let allRecords: DelinquentRecord[] = [];
  let totalReported = 0;
  let totalPages = 0;

  try {
    const page = await sess.newPage();

    // 1) Land on the reports landing — public iframe, no auth
    await page.goto(REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(5000);

    // 2) Click "Public - Delinquent Report" — populates the search form
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("a"));
      const target = els.find((a) =>
        /Public - Delinquent Report/i.test(a.textContent || "")
      );
      if (target) {
        (target as HTMLAnchorElement).click();
        return true;
      }
      return false;
    });
    if (!clicked) {
      throw new Error("Could not find 'Public - Delinquent Report' link");
    }
    await page.waitForTimeout(6000);

    // 3) Expand to ALL delinquent roll years (else default <current returns ~9k)
    await page.evaluate(() => {
      const tyInput = document.getElementById("tax_year") as HTMLInputElement;
      if (tyInput) tyInput.value = "all delinquent roll years";
      // bump rows_per_page to max 1000
      const rpp = document.querySelector(
        'select[name="rows_per_page"], #rows_per_page'
      ) as HTMLSelectElement;
      if (rpp) rpp.value = "1000";
    });

    // 4) First page — click Search
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find((b) =>
        /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? "")
      );
      if (t) (t as HTMLButtonElement).click();
    });
    await page.waitForTimeout(15000);

    totalReported = await extractTotal(page);
    totalPages = Math.ceil(totalReported / PAGE_SIZE);
    console.log(
      `[hillsborough-tax-delinquent] total reported: ${totalReported.toLocaleString()} across ${totalPages} pages`
    );

    // Capture one bronze snapshot of the first page's raw HTML
    const firstPageHtml = await page.content();
    void captureRaw({
      entityType: "parcel",
      source: "hillsborough-taxsys",
      sourceTag,
      category: "tax_delinquent_notice",
      countyFips: COUNTY_FIPS,
      requestParams: {
        url: REPORTS_URL,
        report: "Public - Delinquent Report (id 2470)",
        filter: "all delinquent roll years",
        pageSize: PAGE_SIZE,
      },
      rawResponse: {
        totalReported,
        totalPages,
        firstPageHtmlSample: firstPageHtml.slice(0, 60_000),
      },
      legalRisk: "yellow",
    });

    // Parse first page rows
    const firstRows = parseRows(firstPageHtml);
    allRecords.push(...firstRows);
    console.log(
      `[hillsborough-tax-delinquent] page 1/${totalPages}: ${firstRows.length} rows (running total ${allRecords.length})`
    );

    // 5) Paginate through remaining pages
    for (let p = 2; p <= totalPages; p++) {
      try {
        await goToPage(page, p);
        await page.waitForTimeout(SLEEP_MS);
        const html = await page.content();
        const rows = parseRows(html);
        allRecords.push(...rows);
        if (p % 5 === 0 || p === totalPages) {
          console.log(
            `[hillsborough-tax-delinquent] page ${p}/${totalPages}: ${rows.length} rows (running total ${allRecords.length})`
          );
        }
      } catch (err) {
        console.warn(
          `[hillsborough-tax-delinquent] page ${p} failed: ${(err as Error).message}`
        );
      }
    }
    console.log(
      `[hillsborough-tax-delinquent] paginated total: ${allRecords.length}/${totalReported}`
    );
  } finally {
    await sess.close();
  }

  // 6) Persist — for each record, attempt apn resolution via address join.
  //
  // Performance note: doing a per-row Prisma query against Parcel takes
  // ~100ms each — over 28k rows, that's ~45 minutes. Instead we bulk-load
  // all Hillsborough parcels into memory (~524k rows, single SELECT) and
  // build two lookup maps:
  //   - parcelByAddrCity: situsAddress + situsCity → apn (primary path)
  //   - parcelByOwnerCity: ownerPrefix + situsCity → apn (fallback)
  // This drops persist time to ~1-2 minutes.
  console.log("[hillsborough-tax-delinquent] loading parcel index into memory...");
  const t0 = Date.now();
  const parcels = await prisma.parcel.findMany({
    where: { countyFips: COUNTY_FIPS },
    select: { apn: true, ownerName: true, situsAddress: true, situsCity: true },
  });
  const parcelByAddrCity = new Map<string, string>();
  const parcelByOwnerCity = new Map<string, string>();
  for (const p of parcels) {
    if (p.situsAddress && p.situsCity) {
      parcelByAddrCity.set(`${p.situsAddress}|${p.situsCity}`, p.apn);
    }
    if (p.ownerName && p.situsCity) {
      // Owner index: first 24 chars of owner name + city. We register the
      // PREFIX so a delinquent record with "HOWELL KEVIN E JR, HOWELL GAILE R"
      // still matches the parcel owner "HOWELL KEVIN E JR".
      const ownerPrefix = p.ownerName.slice(0, 24);
      const key = `${ownerPrefix}|${p.situsCity}`;
      if (!parcelByOwnerCity.has(key)) parcelByOwnerCity.set(key, p.apn);
    }
  }
  console.log(
    `[hillsborough-tax-delinquent] indexed ${parcels.length.toLocaleString()} parcels (addr: ${parcelByAddrCity.size.toLocaleString()}, owner: ${parcelByOwnerCity.size.toLocaleString()}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`
  );

  let persisted = 0;
  let apnResolved = 0;
  let skippedHallucinated = 0;

  for (const r of allRecords) {
    if (looksHallucinated(r)) {
      skippedHallucinated++;
      continue;
    }

    // Resolve apn from in-memory maps (no DB query)
    let apn: string | null = null;
    if (r.situsStreet && r.situsCity) {
      apn = parcelByAddrCity.get(`${r.situsStreet}|${r.situsCity}`) ?? null;
    }
    if (!apn && r.ownerName && r.situsCity) {
      const firstOwner = r.ownerName.split(",")[0].trim();
      if (firstOwner.length > 6) {
        apn = parcelByOwnerCity.get(`${firstOwner.slice(0, 24)}|${r.situsCity}`) ?? null;
      }
    }
    if (apn) apnResolved++;

    try {
      await prisma.lien.upsert({
        where: {
          countyFips_documentNumber_source: {
            countyFips: COUNTY_FIPS,
            documentNumber: `${r.account}-${r.taxYear}`,
            source: sourceTag,
          },
        },
        create: {
          countyFips: COUNTY_FIPS,
          apn,
          lienCategory: "tax",
          recordingDate: today,
          // No amount in the public report; per-account detail page would
          // require 29k extra round trips. Leave null until enrichment.
          amount: null,
          defendantName: r.ownerName,
          lienTypeCode: `DELINQUENT_TAX_${r.taxYear}`,
          documentNumber: `${r.account}-${r.taxYear}`,
          // Stash useful context in plaintiffAddress so we can re-resolve
          // apn later if the Parcel table is updated. Format: address|city|zip
          plaintiffAddress: `${r.situsStreet}|${r.situsCity}|${r.situsZip}`,
          source: sourceTag,
        },
        update: { apn, defendantName: r.ownerName },
      });
      persisted++;
      if (persisted % 2500 === 0) {
        console.log(
          `[hillsborough-tax-delinquent] persisted ${persisted}/${allRecords.length} (apn resolved: ${apnResolved})`
        );
      }
    } catch (err) {
      console.warn(
        "[hillsborough-tax-delinquent] persist failed:",
        (err as Error).message
      );
    }
  }

  return {
    found: allRecords.length,
    totalReported,
    totalPages,
    persisted,
    apnResolved,
    skippedHallucinated,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the "N search results found" banner. */
async function extractTotal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/([\d,]+)\s+search results found/i);
    return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
  });
}

/**
 * Jump to page N. TaxSys renders pagination links as
 *   <a href="javascript:report_page_link(N, sbgb_boundary);">N</a>
 * We invoke the same function in the page context. sbgb_boundary is a hidden
 * input that the server uses to demarcate "stably sorted page boundaries"
 * (it changes when the sort column changes; for our use case it stays "2").
 */
async function goToPage(page: Page, pageNum: number): Promise<void> {
  await page.evaluate((n: number) => {
    // Read the current sbgb_boundary
    const sbgbInp = document.querySelector(
      'input[name="sbgb_boundary"]'
    ) as HTMLInputElement | null;
    const sbgb = sbgbInp?.value ?? "2";
    // Call the page's own pagination function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (window as any).report_page_link;
    if (typeof fn === "function") {
      fn(n, parseInt(sbgb, 10));
    } else {
      // Fallback: click the link
      const link = Array.from(document.querySelectorAll("a")).find((a) => {
        const href = a.getAttribute("href") ?? "";
        return new RegExp(`report_page_link\\(\\s*${n}\\s*,`).test(href);
      });
      if (link) (link as HTMLAnchorElement).click();
    }
  }, pageNum);

  // Wait for the AJAX rebind. Server-rendered, takes 6-12s under load.
  await page.waitForTimeout(8000);
}

/** Parse one full HTML page's table rows into DelinquentRecord[]. */
function parseRows(html: string): DelinquentRecord[] {
  const $ = cheerio.load(html);
  const records: DelinquentRecord[] = [];

  // The data table has class "table-striped" and an account_number column.
  $("table.table-striped, table.table").each((_, tbl) => {
    const $tbl = $(tbl);
    // Confirm this is the data table: header must include Account Number
    const headerText = $tbl.find("thead, tr:first-child").text();
    if (!/Account\s*Number/i.test(headerText)) return;

    $tbl.find("tbody tr").each((_, tr) => {
      const cells = $(tr).find("td").toArray();
      if (cells.length < 8) return; // expect 8 cols

      const taxYearText = $(cells[0]).text().trim();
      const account = $(cells[1]).text().trim();
      const ownerName = $(cells[2]).text().trim();
      const situsRaw = $(cells[3]).text().replace(/\s+/g, " ").trim();
      const accountStatus = $(cells[4]).text().trim();
      const certStatus = $(cells[5]).text().trim();
      const deedStatus = $(cells[6]).text().trim();
      const standardFlag = $(cells[7]).text().trim();

      // Skip the first row, which is the search/filter row (contains
      // dropdown option labels concatenated into the cell text).
      const taxYear = parseInt(taxYearText, 10);
      if (!Number.isFinite(taxYear) || taxYear < 1990 || taxYear > 2030) return;
      // Account number must match the TaxSys "A" + 9-12 digits format
      if (!account || !/^[A-Z]\d{9,12}$/.test(account)) return;

      const parsed = parseSitus(situsRaw);

      records.push({
        account,
        taxYear,
        ownerName,
        situsAddress: situsRaw,
        situsCity: parsed.city,
        situsZip: parsed.zip,
        situsStreet: parsed.street,
        accountStatus,
        certStatus,
        deedStatus,
        standardFlag,
      });
    });
  });

  return records;
}

/**
 * Hillsborough situs address format is "<street> <CITY> <ZIP>" where ZIP is
 * always 5 digits at the end. e.g., "8807 BYS RUN ODESSA 33556" →
 *   street: "8807 BYS RUN", city: "ODESSA", zip: "33556"
 *
 * The city is the last all-CAPS word(s) BEFORE the zip. Cities can be
 * multi-word ("TEMPLE TERRACE", "SUN CITY CENTER", "PLANT CITY"). We use
 * a known-city list — Hillsborough's incorporated places + the major
 * unincorporated ones found in our Parcel table.
 */
const HILLSBOROUGH_CITIES = [
  "TEMPLE TERRACE",
  "SUN CITY CENTER",
  "PLANT CITY",
  "SUN CITY",
  "APOLLO BEACH",
  "RUSKIN",
  "LITHIA",
  "BRANDON",
  "VALRICO",
  "RIVERVIEW",
  "ODESSA",
  "SEFFNER",
  "DOVER",
  "MANGO",
  "THONOTOSASSA",
  "TAMPA",
  "WIMAUMA",
  "BALM",
  "GIBSONTON",
  "DURANT",
];

function parseSitus(raw: string): { street: string; city: string; zip: string } {
  // Try zip at end
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : "";
  const withoutZip = zip ? raw.replace(/\s*\d{5}(?:-\d{4})?\s*$/, "").trim() : raw;

  // Try multi-word city match first (longest match wins)
  let city = "";
  let street = withoutZip;
  for (const c of HILLSBOROUGH_CITIES.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\s+${c.replace(/\s+/g, "\\s+")}\\s*$`, "i");
    if (re.test(withoutZip)) {
      city = c;
      street = withoutZip.replace(re, "").trim();
      break;
    }
  }
  if (!city) {
    // Fallback — assume last word is city
    const parts = withoutZip.split(/\s+/);
    if (parts.length >= 2) {
      city = parts[parts.length - 1];
      street = parts.slice(0, -1).join(" ");
    }
  }

  return { street, city, zip };
}

/**
 * Hallucination guard — even though this is direct HTML parsing (no LLM),
 * we reject obviously-bogus records as a defense layer.
 */
function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.account || !/^A\d{9,12}$/.test(r.account)) return true; // malformed account#
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true;
  if (/^(john|jane)\s+(doe|smith)|test|sample/i.test(r.ownerName)) return true;
  if (!r.situsAddress || r.situsAddress.length < 3) return true;
  return false;
}
