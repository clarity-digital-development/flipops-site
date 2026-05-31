import { parse as parseCsv } from "csv-parse/sync";
import { PlaywrightSession } from "../base/playwright-session";
import type { Download } from "playwright-chromium";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Hillsborough delinquent-tax scraper — CSV download path (Phase 4).
//
// Replaces the 26-min HTML pagination (`hillsborough-tax-delinquent.ts`) with
// a ~1-min flow:
//   1. Land on the iframe-taxsys reports page (stealth-chromium for Akamai)
//   2. Click "Public - Delinquent Report" (loads form)
//   3. Set tax_year=all + filetype=csv + rows_per_page=1000
//   4. Click Search to populate results
//   5. Click the CSV-format download trigger
//   6. Confirm the modal's "Download" button
//   7. Capture the file via Playwright's download event handler
//   8. Parse CSV → 28k records
//   9. Persist (same logic as HTML scraper: in-memory parcel index + bulk
//      Lien upsert) — shared via SHARED_PERSIST helper.
//
// Probe artifact:
//   tmp/probe-hillsborough-csv/downloaded-*-Public - Delinquent Report.csv
//   8 columns: Tax Yr, Account Number, Owner Name, Property Address,
//   Account Status, Cert Status, Deed Status, Standard Flags
//
// See docs/development/FRESHNESS-LAYER-PLAN.md v3 §"Phase 4".
// ---------------------------------------------------------------------------

const REPORTS_URL =
  "https://county-taxes.net/iframe-taxsys/hillsborough.county-taxes.com/govhub/reports/real-estate";
const COUNTY_FIPS = "12057";

interface DelinquentRecord {
  account: string;
  taxYear: number;
  ownerName: string;
  situsAddress: string;
  situsCity: string;
  situsZip: string;
  situsStreet: string;
  accountStatus: string;
  certStatus: string;
  deedStatus: string;
  standardFlag: string;
}

export interface HillsboroughTaxDelinquentCsvResult {
  found: number;
  csvBytes: number;
  persisted: number;
  apnResolved: number;
  skippedHallucinated: number;
}

/**
 * Scrape via CSV download. Dramatically faster than the HTML walk; same result
 * shape on the persistence side. The HTML scraper at hillsborough-tax-
 * delinquent.ts remains available for testing + fallback.
 */
export async function scrapeHillsboroughTaxDelinquentCsv(): Promise<HillsboroughTaxDelinquentCsvResult> {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  const sourceTag = `scraper:hillsborough-tax-${new Date().toISOString().slice(0, 10)}`;
  const today = new Date();

  let csvText = "";
  let csvBytes = 0;

  try {
    const page = await sess.newPage();

    // Set up the download promise BEFORE the click that triggers it.
    let resolveDownload: ((d: Download) => void) | null = null;
    const downloadPromise = new Promise<Download>((res) => {
      resolveDownload = res;
    });
    page.on("download", (d) => resolveDownload?.(d));

    // 1) Land on reports page (no auth)
    await page.goto(REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4_000);

    // 2) Click "Public - Delinquent Report"
    const clicked = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((el) =>
        /Public - Delinquent Report/i.test(el.textContent || ""),
      );
      if (a) { (a as HTMLAnchorElement).click(); return true; }
      return false;
    });
    if (!clicked) throw new Error("[hillsborough-csv] could not find 'Public - Delinquent Report' link");
    await page.waitForTimeout(6_000);

    // 3) Set filter to "all delinquent roll years", csv format, max rows
    await page.evaluate(() => {
      const ty = document.getElementById("tax_year") as HTMLInputElement | null;
      if (ty) ty.value = "all delinquent roll years";
      const rpp = document.querySelector('select[name="rows_per_page"], #rows_per_page') as HTMLSelectElement | null;
      if (rpp) rpp.value = "1000";
      const ft = document.getElementById("filetype") as HTMLSelectElement | null;
      if (ft) ft.value = "csv";
    });

    // 4) Click Search to populate results
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find((b) => /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? ""));
      if (t) (t as HTMLButtonElement).click();
    });
    await page.waitForTimeout(15_000);

    // 5) Open the download dialog via the CSV button (click triggers
    //    download_options('csv') which opens a modal).
    const csvBtnClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /download_options\(.?csv.?\)/i.test(b.getAttribute("onclick") || ""),
      );
      if (btn) { (btn as HTMLButtonElement).click(); return true; }
      return false;
    });
    if (!csvBtnClicked) throw new Error("[hillsborough-csv] could not find CSV format button");
    await page.waitForTimeout(2_500);

    // 6) Confirm the modal's Download button (id="download-report").
    const dlBtnClicked = await page.evaluate(() => {
      // Ensure filetype is csv inside the modal too (defensive)
      const ft = document.getElementById("filetype") as HTMLSelectElement | null;
      if (ft) ft.value = "csv";
      const btn = document.getElementById("download-report") as HTMLButtonElement | null;
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!dlBtnClicked) throw new Error("[hillsborough-csv] could not find modal download button");

    // 7) Wait for the download event
    console.log(`[hillsborough-csv] download triggered — awaiting file…`);
    const dl = await Promise.race([
      downloadPromise,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("[hillsborough-csv] download timeout after 60s")), 60_000),
      ),
    ]);

    // Stream into memory.
    const stream = await dl.createReadStream();
    if (!stream) throw new Error("[hillsborough-csv] download stream not available");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const buf = Buffer.concat(chunks);
    csvBytes = buf.length;
    csvText = buf.toString("utf8");
    console.log(`[hillsborough-csv] downloaded ${(csvBytes / 1024 / 1024).toFixed(2)}MB`);

    // 8) Capture bronze (small sample only — full CSV would bloat RawSnapshot)
    void captureRaw({
      entityType: "parcel",
      source: "hillsborough-taxsys",
      sourceTag,
      category: "tax_delinquent_notice",
      countyFips: COUNTY_FIPS,
      requestParams: {
        url: REPORTS_URL,
        report: "Public - Delinquent Report (id 2470)",
        format: "csv",
        filter: "all delinquent roll years",
      },
      rawResponse: { csvBytes, csvSample: csvText.slice(0, 60_000) },
      legalRisk: "yellow",
    });
  } finally {
    await sess.close();
  }

  // 9) Parse CSV into DelinquentRecord[]
  const records = parseCsvRows(csvText);
  console.log(`[hillsborough-csv] parsed ${records.length.toLocaleString()} records from CSV`);

  // 10) Bulk-load parcel index for in-memory apn resolution
  console.log(`[hillsborough-csv] loading parcel index…`);
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
      const ownerPrefix = p.ownerName.slice(0, 24);
      const key = `${ownerPrefix}|${p.situsCity}`;
      if (!parcelByOwnerCity.has(key)) parcelByOwnerCity.set(key, p.apn);
    }
  }
  console.log(
    `[hillsborough-csv] indexed ${parcels.length.toLocaleString()} parcels (addr ${parcelByAddrCity.size.toLocaleString()}, owner ${parcelByOwnerCity.size.toLocaleString()}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  // Build the bulk-upsert payload in memory (no per-row Prisma round-trip).
  let apnResolved = 0;
  let skippedHallucinated = 0;
  const upsertRows: LienUpsertInput[] = [];

  for (const r of records) {
    if (looksHallucinated(r)) { skippedHallucinated++; continue; }

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

    upsertRows.push({
      countyFips:       COUNTY_FIPS,
      apn,
      documentNumber:   `${r.account}-${r.taxYear}`,
      source:           sourceTag,
      lienCategory:     "tax",
      lienTypeCode:     `DELINQUENT_TAX_${r.taxYear}`,
      recordingDate:    today,
      amount:           null, // public report doesn't expose amount due
      defendantName:    r.ownerName,
      plaintiffAddress: `${r.situsStreet}|${r.situsCity}|${r.situsZip}`,
    });
  }

  console.log(`[hillsborough-csv] bulk-upserting ${upsertRows.length} rows…`);
  const bulkResult = await bulkUpsertLiens(upsertRows);
  console.log(
    `[hillsborough-csv] bulk-upsert done: persisted=${bulkResult.persisted} batches=${bulkResult.batches} in ${(bulkResult.durationMs / 1000).toFixed(1)}s`,
  );

  return {
    found: records.length,
    csvBytes,
    persisted: bulkResult.persisted,
    apnResolved,
    skippedHallucinated,
  };
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

interface CsvRow {
  "Tax Yr": string;
  "Account Number": string;
  "Owner Name": string;
  "Property Address": string;
  "Account Status": string;
  "Cert Status": string;
  "Deed Status": string;
  "Standard Flags": string;
}

function parseCsvRows(csvText: string): DelinquentRecord[] {
  const rows = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as CsvRow[];

  const records: DelinquentRecord[] = [];
  for (const row of rows) {
    const taxYear = parseInt(row["Tax Yr"], 10);
    if (!Number.isFinite(taxYear) || taxYear < 1990 || taxYear > 2030) continue;

    const account = row["Account Number"]?.trim() ?? "";
    if (!account || !/^[A-Z]\d{9,12}$/.test(account)) continue;

    const ownerName = row["Owner Name"]?.trim() ?? "";
    const situsRaw = (row["Property Address"] ?? "").replace(/\s+/g, " ").trim();
    const parsed = parseSitus(situsRaw);

    records.push({
      account,
      taxYear,
      ownerName,
      situsAddress: situsRaw,
      situsCity: parsed.city,
      situsZip: parsed.zip,
      situsStreet: parsed.street,
      accountStatus: row["Account Status"]?.trim() ?? "",
      certStatus: row["Cert Status"]?.trim() ?? "",
      deedStatus: row["Deed Status"]?.trim() ?? "",
      standardFlag: row["Standard Flags"]?.trim() ?? "",
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Helpers (mirror hillsborough-tax-delinquent.ts for parity)
// ---------------------------------------------------------------------------

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
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : "";
  const withoutZip = zip ? raw.replace(/\s*\d{5}(?:-\d{4})?\s*$/, "").trim() : raw;

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
    const parts = withoutZip.split(/\s+/);
    if (parts.length >= 2) {
      city = parts[parts.length - 1];
      street = parts.slice(0, -1).join(" ");
    }
  }
  return { street, city, zip };
}

function looksHallucinated(r: DelinquentRecord): boolean {
  if (!r.account || !/^[A-Z]\d{9,12}$/.test(r.account)) return true;
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true;
  if (/^(john|jane)\s+(doe|smith)|test|sample/i.test(r.ownerName)) return true;
  if (!r.situsAddress || r.situsAddress.length < 3) return true;
  return false;
}
