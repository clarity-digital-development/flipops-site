import { parse as parseCsv } from "csv-parse/sync";
import { PlaywrightSession } from "../base/playwright-session";
import type { Download, Page } from "playwright-chromium";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Broward County (FL, FIPS 12011) delinquent real-estate tax scraper —
// TaxSys govhub CSV report path (M1.4 fix, 2026-06-09).
//
// WHY THIS EXISTS — the original Broward scraper
// (`broward-tax-delinquent.ts`, LienHub county-held certificates) is NOT
// broken: probed 2026-06-09, the endpoint truthfully reports
// `recordsTotal: 1`. County-held certs are the post-cert-sale RESIDUE
// (certs that even paying bidders passed on) — cyclically near-empty for
// ~11 months a year. It was never the full delinquent universe, which is
// why AUDIT-A1 saw "exactly 1 row" for Broward vs ~26-39k for peer metros.
//
// THE FULL UNIVERSE lives on Broward's own Grant Street TaxSys portal:
//   https://broward.county-taxes.com/govhub/reports/real-estate
// (the old playbook's "DO NOT use broward.county-taxes.com — login-walled"
// applies to the payments/bidder portal, NOT this public reports route —
// verified 200 to vanilla HTTP on 2026-06-09).
//
// TWO reports compose the delinquent universe (both CSV-downloadable):
//
//  1. "PUBLIC_BROWARD UNPAID REAL ESTATE" (id 2949) — account-level rows,
//     all roll years (132,178 rows probed 2026-06-09). Columns:
//       [Tax Yr, Account Status, Account Type, Advertised Number,
//        Account Number, Cert Status, Deed Status, Balance Amount,
//        Owner Name, Billing Address, Property Address, ...]
//     CAVEAT (learned in the 2026-06-09 dry run): once a tax certificate is
//     SOLD, the cert buyer pays the county and the ACCOUNT balance drops to
//     $0 — only 63 rows had balance > 0 a week after the June 1 sale. So
//     this report alone is only the pre-sale window + non-certable accounts
//     (litigation/bankruptcy). It is also our owner-name/address source.
//
//  2. "PUBLIC_CERTIFICATE LIST PAID UNPAID BAL" (id 3964) — per-certificate
//     rows (11,718 probed 2026-06-09). Columns:
//       [Account Number, GEO Number, Tax Yr, Cert #, Interest Start Date,
//        Face Amount, Interest Rate, Bidder #, Cert Buyer, Account Status,
//        Account Balance Amount, Cert Status, Deed Status,
//        Price to Purchase, Issued Date]
//     Unpaid certificates ARE the live post-sale delinquency (the owner now
//     owes the cert holder redemption). This is the dominant slice.
//
// Merge: one record per (apn, taxYear); certificate face amount wins over
// account balance when both exist (face = advertised delinquent tax, stable
// across runs; balances accrue interest).
//
// Account Number: dashed BCPA folio ("474126-00-7000") → strip separators →
// 12-char Parcel.apn (same transform as the county-held scraper). Direct
// APN join — no address bridge needed.
//
// Unique key in Lien: (countyFips, documentNumber=<apn>-<taxYear>, source) —
// same documentNumber family as the county-held scraper, so the
// TaxDelinquencySummary dedup (latest capture per apn+documentNumber wins)
// composes both sources cleanly.
// ---------------------------------------------------------------------------

const REPORTS_URL = "https://broward.county-taxes.com/govhub/reports/real-estate";
const ACCOUNT_REPORT_RE = /PUBLIC_BROWARD\s+UNPAID\s+REAL\s+ESTATE/i;
const CERT_REPORT_RE = /PUBLIC_CERTIFICATE\s+LIST\s+PAID\s+UNPAID\s+BAL/i;
const COUNTY_FIPS = "12011";
// Account report is ~132k rows (~23MB CSV) — allow a generous window.
const DOWNLOAD_TIMEOUT_MS = 240_000;

interface MergedRecord {
  apn: string;            // 12-char BCPA folio, separators stripped
  taxYear: number;
  ownerName: string;
  propertyAddress: string;
  amount: number;
}

export interface BrowardTaxDelinquentCsvResult {
  accountRows: number;     // account-report CSV rows parsed
  accountDelinquent: number; // account rows kept (balance > 0)
  certRows: number;        // certificate-report CSV rows parsed
  certUnpaid: number;      // cert rows kept (unpaid + live cert status)
  merged: number;          // distinct (apn, taxYear) records persisted from
  csvBytes: number;        // both downloads combined
  persisted: number;
  skippedHallucinated: number;
}

/**
 * Scrape Broward's full delinquent real-estate tax universe via the TaxSys
 * govhub public CSV reports. Persists to Lien with lienCategory='tax'.
 *
 * `opts.dryRun` downloads + parses + merges but skips ALL DB writes
 * (no Lien upserts, no bronze capture) — local verification only.
 */
export async function scrapeBrowardTaxDelinquentCsv(
  opts: { dryRun?: boolean } = {},
): Promise<BrowardTaxDelinquentCsvResult> {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  const sourceTag = `scraper:broward-tax-${new Date().toISOString().slice(0, 10)}`;
  const today = new Date();

  let accountCsv = "";
  let certCsv = "";

  try {
    const page = await sess.newPage();

    // Re-armable download capture — this run downloads TWO report CSVs.
    let resolveDownload: ((d: Download) => void) | null = null;
    let downloadPromise = new Promise<Download>((res) => {
      resolveDownload = res;
    });
    const armDownload = () => {
      downloadPromise = new Promise<Download>((res) => {
        resolveDownload = res;
      });
    };
    page.on("download", (d) => resolveDownload?.(d));

    // Pass 1: account-level unpaid report (also our owner/address source)
    accountCsv = await downloadReportCsv(
      page,
      ACCOUNT_REPORT_RE,
      "account report (PUBLIC_BROWARD UNPAID REAL ESTATE)",
      armDownload,
      () => downloadPromise,
    );

    // Pass 2: certificate list (the live post-sale delinquency universe)
    certCsv = await downloadReportCsv(
      page,
      CERT_REPORT_RE,
      "certificate report (PUBLIC_CERTIFICATE LIST PAID UNPAID BAL)",
      armDownload,
      () => downloadPromise,
    );

    // Bronze capture (samples only; skipped on dry-run so local verification
    // writes nothing at all)
    if (!opts.dryRun) {
      void captureRaw({
        entityType: "parcel",
        source: "broward-taxsys",
        sourceTag,
        category: "tax_delinquent_notice",
        countyFips: COUNTY_FIPS,
        requestParams: {
          url: REPORTS_URL,
          reports: [
            "PUBLIC_BROWARD UNPAID REAL ESTATE (id 2949)",
            "PUBLIC_CERTIFICATE LIST PAID UNPAID BAL (id 3964)",
          ],
          format: "csv",
        },
        rawResponse: {
          accountCsvBytes: accountCsv.length,
          certCsvBytes: certCsv.length,
          accountCsvSample: accountCsv.slice(0, 30_000),
          certCsvSample: certCsv.slice(0, 30_000),
        },
        legalRisk: "yellow",
      });
    }
  } finally {
    await sess.close();
  }

  // Parse + merge ------------------------------------------------------------
  const account = parseAccountCsv(accountCsv);
  const cert = parseCertCsv(certCsv);
  console.log(
    `[broward-csv] account report: ${account.rows.length.toLocaleString()} rows → ${account.delinquent.length.toLocaleString()} with balance > 0; ` +
    `certificate report: ${cert.rows.toLocaleString()} rows → ${cert.unpaid.length.toLocaleString()} live unpaid certs`,
  );

  // Owner/address enrichment index from the account report (covers all years
  // including paid history, so nearly every APN resolves).
  const ownerByApn = new Map<string, { ownerName: string; propertyAddress: string }>();
  for (const r of account.rows) {
    if (!ownerByApn.has(r.apn) && (r.ownerName || r.propertyAddress)) {
      ownerByApn.set(r.apn, { ownerName: r.ownerName, propertyAddress: r.propertyAddress });
    }
  }

  // Merge one record per (apn, taxYear). Account balances first, then
  // certificates override (face amount is the stable advertised figure).
  const mergedMap = new Map<string, MergedRecord>();
  for (const r of account.delinquent) {
    mergedMap.set(`${r.apn}-${r.taxYear}`, {
      apn: r.apn,
      taxYear: r.taxYear,
      ownerName: r.ownerName,
      propertyAddress: r.propertyAddress,
      amount: r.balance,
    });
  }
  for (const c of cert.unpaid) {
    const key = `${c.apn}-${c.taxYear}`;
    const existing = mergedMap.get(key);
    // On collision for the same (apn, taxYear) — account row + cert row, or
    // multiple certs (e.g. reissues) — keep the larger amount so a partial
    // figure never shadows the fuller one.
    const enrich = ownerByApn.get(c.apn);
    mergedMap.set(key, {
      apn: c.apn,
      taxYear: c.taxYear,
      ownerName: existing?.ownerName || enrich?.ownerName || "",
      propertyAddress: existing?.propertyAddress || enrich?.propertyAddress || "",
      amount: Math.max(c.amount, existing?.amount ?? 0),
    });
  }

  // Persist via bulk-upsert (direct APN — no parcel index needed) ------------
  let skippedHallucinated = 0;
  const upsertRows: LienUpsertInput[] = [];
  for (const r of mergedMap.values()) {
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
      defendantName:    r.ownerName || null,
      plaintiffAddress: r.propertyAddress || null,
    });
  }

  const base = {
    accountRows: account.rows.length,
    accountDelinquent: account.delinquent.length,
    certRows: cert.rows,
    certUnpaid: cert.unpaid.length,
    merged: upsertRows.length,
    csvBytes: accountCsv.length + certCsv.length,
    skippedHallucinated,
  };

  if (opts.dryRun) {
    console.log(
      `[broward-csv] DRY RUN — would persist ${upsertRows.length.toLocaleString()} rows (skippedHallucinated=${skippedHallucinated})`,
    );
    return { ...base, persisted: 0 };
  }

  const bulkResult = await bulkUpsertLiens(upsertRows);
  console.log(
    `[broward-csv] bulk-upsert done: persisted=${bulkResult.persisted} batches=${bulkResult.batches} in ${(bulkResult.durationMs / 1000).toFixed(1)}s`,
  );
  return { ...base, persisted: bulkResult.persisted };
}

// ---------------------------------------------------------------------------
// govhub report → CSV download driver (mirrors the Hillsborough flow)
// ---------------------------------------------------------------------------

async function downloadReportCsv(
  page: Page,
  linkRe: RegExp,
  label: string,
  armDownload: () => void,
  getDownloadPromise: () => Promise<Download>,
): Promise<string> {
  armDownload();

  await page.goto(REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(4_000);

  const clicked = await page.evaluate((reSource: string) => {
    const re = new RegExp(reSource, "i");
    const a = Array.from(document.querySelectorAll("a")).find((el) =>
      re.test(el.textContent || ""),
    );
    if (a) { (a as HTMLAnchorElement).click(); return true; }
    return false;
  }, linkRe.source);
  if (!clicked) throw new Error(`[broward-csv] could not find report link for ${label}`);
  await page.waitForTimeout(6_000);

  // Ensure CSV output (probe showed filetype defaults to csv — defensive)
  await page.evaluate(() => {
    const ft = document.getElementById("filetype") as HTMLSelectElement | null;
    if (ft) ft.value = "csv";
  });

  // Run the search with the report's default filters; we filter client-side.
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
    const t = btns.find((b) => /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? ""));
    if (t) (t as HTMLButtonElement).click();
  });
  await page.waitForTimeout(15_000);

  // Open the CSV download dialog + confirm the modal
  const csvBtnClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /download_options\(.?csv.?\)/i.test(b.getAttribute("onclick") || ""),
    );
    if (btn) { (btn as HTMLButtonElement).click(); return true; }
    return false;
  });
  if (!csvBtnClicked) throw new Error(`[broward-csv] could not find CSV format button for ${label}`);
  await page.waitForTimeout(2_500);

  const dlBtnClicked = await page.evaluate(() => {
    const ft = document.getElementById("filetype") as HTMLSelectElement | null;
    if (ft) ft.value = "csv";
    const btn = document.getElementById("download-report") as HTMLButtonElement | null;
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!dlBtnClicked) throw new Error(`[broward-csv] could not find modal download button for ${label}`);

  console.log(`[broward-csv] download triggered for ${label} — awaiting file…`);
  const dl = await Promise.race([
    getDownloadPromise(),
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new Error(`[broward-csv] download timeout after ${DOWNLOAD_TIMEOUT_MS / 1000}s for ${label}`)),
        DOWNLOAD_TIMEOUT_MS,
      ),
    ),
  ]);
  const stream = await dl.createReadStream();
  if (!stream) throw new Error(`[broward-csv] download stream not available for ${label}`);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const buf = Buffer.concat(chunks);
  console.log(`[broward-csv] downloaded ${(buf.length / 1024 / 1024).toFixed(2)}MB for ${label}`);
  return buf.toString("utf8");
}

// ---------------------------------------------------------------------------
// CSV parsing — tolerant header lookup (TaxSys CSV headers track the display
// columns but may drift in spacing/casing across report edits).
// ---------------------------------------------------------------------------

interface AccountRecord {
  apn: string;
  taxYear: number;
  ownerName: string;
  propertyAddress: string;
  balance: number;
}

function parseAccountCsv(csvText: string): { rows: AccountRecord[]; delinquent: AccountRecord[] } {
  const raw = parseRows(csvText);
  if (raw.length === 0) return { rows: [], delinquent: [] };

  const keys = Object.keys(raw[0]);
  const findKey = (re: RegExp): string | null => keys.find((k) => re.test(k)) ?? null;
  const kTaxYear = findKey(/^tax\s*yr/i);
  const kAccount = findKey(/^account\s*number/i);
  const kBalance = findKey(/^balance/i);
  const kOwner   = findKey(/^owner\s*name/i);
  const kPropAddr = findKey(/^property\s*address/i);
  if (!kTaxYear || !kAccount || !kBalance) {
    throw new Error(
      `[broward-csv] account CSV header mismatch — got [${keys.join(", ")}]; need Tax Yr / Account Number / Balance Amount`,
    );
  }

  const rows: AccountRecord[] = [];
  for (const row of raw) {
    const taxYear = parseInt(row[kTaxYear] ?? "", 10);
    if (!Number.isFinite(taxYear) || taxYear < 1990 || taxYear > 2030) continue;
    const apn = normalizeApn(row[kAccount]);
    if (!apn) continue;
    rows.push({
      apn,
      taxYear,
      ownerName: (kOwner ? row[kOwner] : "")?.trim() ?? "",
      propertyAddress: (kPropAddr ? row[kPropAddr] : "")?.replace(/\s+/g, " ").trim() ?? "",
      balance: parseMoney(row[kBalance]),
    });
  }
  return { rows, delinquent: rows.filter((r) => r.balance > 0) };
}

interface CertRecord {
  apn: string;
  taxYear: number;
  amount: number; // face amount (fallback: account balance)
}

function parseCertCsv(csvText: string): { rows: number; unpaid: CertRecord[] } {
  const raw = parseRows(csvText);
  if (raw.length === 0) return { rows: 0, unpaid: [] };

  const keys = Object.keys(raw[0]);
  const findKey = (re: RegExp): string | null => keys.find((k) => re.test(k)) ?? null;
  const kTaxYear = findKey(/^tax\s*yr/i);
  const kAccount = findKey(/^account\s*number/i);
  const kFace    = findKey(/^face\s*amount/i);
  const kBalance = findKey(/balance/i);
  const kAcctStatus = findKey(/^account\s*status/i);
  const kCertStatus = findKey(/^cert\s*status/i);
  if (!kTaxYear || !kAccount || (!kFace && !kBalance)) {
    throw new Error(
      `[broward-csv] certificate CSV header mismatch — got [${keys.join(", ")}]; need Tax Yr / Account Number / Face Amount`,
    );
  }

  const unpaid: CertRecord[] = [];
  for (const row of raw) {
    const taxYear = parseInt(row[kTaxYear] ?? "", 10);
    if (!Number.isFinite(taxYear) || taxYear < 1990 || taxYear > 2030) continue;
    const apn = normalizeApn(row[kAccount]);
    if (!apn) continue;

    // Live delinquency = the account is still unpaid AND the certificate is
    // still outstanding (a redeemed/canceled cert means the owner paid).
    const acctStatus = (kAcctStatus ? row[kAcctStatus] : "")?.trim() ?? "";
    const certStatus = (kCertStatus ? row[kCertStatus] : "")?.trim() ?? "";
    if (acctStatus && !/unpaid|paid\s*to\s*date/i.test(acctStatus)) continue;
    if (certStatus && /redeemed|cancel|surrender|expired|deleted/i.test(certStatus)) continue;

    const face = parseMoney(kFace ? row[kFace] : undefined);
    const balance = parseMoney(kBalance ? row[kBalance] : undefined);
    const amount = face > 0 ? face : balance;
    if (amount <= 0) continue;
    unpaid.push({ apn, taxYear, amount });
  }
  return { rows: raw.length, unpaid };
}

function parseRows(csvText: string): Array<Record<string, string>> {
  if (!csvText) return [];
  return parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;
}

/** BCPA folio "474126-00-7000" → "474126007000". Condo folios contain
 *  letters (AB/BJ/BM), so keep alphanumerics, not just digits. */
function normalizeApn(raw: string | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** "$12,626.21" | "12626.21" | "0.00" → number (0 on garbage). */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Defense-in-depth guard — mirrors broward-tax-delinquent.ts (county-held).
function looksHallucinated(r: MergedRecord): boolean {
  // Broward BCPA folios are exactly 12 alphanumeric characters.
  if (!r.apn || r.apn.length !== 12) return true;
  if (!/^[0-9A-Z]{12}$/.test(r.apn)) return true;
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true;
  if (/^(john|jane)\s+(doe|smith)|test|sample|n\/a/i.test(r.ownerName)) return true;
  if (r.amount < 0 || r.amount > 1e8) return true;
  return false;
}
