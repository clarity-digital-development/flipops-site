import { PlaywrightSession } from "../base/playwright-session";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { bulkUpsertLiens, type LienUpsertInput } from "../base/bulk-upsert-lien";

// ---------------------------------------------------------------------------
// Broward County delinquent real-estate tax scraper.
//
// Source: lienhub.com/county/broward/countyheld/certificates (Grant Street
// Group's LienHub platform, the same vendor behind Broward's tax collector
// payments portal `broward.county-taxes.com`).
//
// What this represents: every tax certificate that went unsold at Broward's
// annual cert-sale auction and is therefore HELD by the county. These are
// always-delinquent properties — the lien has been advertised, auctioned,
// and even certified buyers passed. They are the highest-distress slice of
// the FL § 197.402 mandated delinquent universe.
//
// Why not legals.jaxdailyrecord.com-equivalent for Broward? The Duval pattern
// (newspaper-published full delinquent list) doesn't have a matching public
// HTML feed for Broward. The Broward Daily Business Review (ALM Media) and
// the Sun-Sentinel classifieds are paywalled / JS-walled and the §197.402
// publication is published only in print + paywalled e-edition. LienHub's
// county-held endpoint is the next-best PUBLIC source and uses identical
// Grant Street infrastructure to Duval LienHub (12 records as of 2026-05-30).
//
// Schema (JSON row):
//   account_number     : "494107-10-0034"   → strip dashes → 494107100034 (matches Parcel.apn)
//   alternate_key      : "836676"           (internal LienHub id)
//   tax_year           : 2024               (year of unpaid tax)
//   owner_name         : "WEST POINTE LAND LLC"
//   property_address   : "HIATUS RD"
//   purchase_amt       : "12626.21"         (cost to redeem the cert)
//   face_amount        : "10694.88"         (original lien amount advertised)
//   market_value       : "27460.00"         (BCPA market value at time of cert issue)
//   certs_outstanding  : "6.00"             (number of years delinquent)
//   issued_date        : "2025-05-28"
//
// Cloudflare: lienhub.com is behind Cloudflare's anti-bot challenge. We use
// Playwright stealth-chromium to bypass the challenge and execute the
// DataTables AJAX POST from within the browser context (where CF cookies
// and JS-fingerprinting have already validated).
//
// Pagination: DataTables `start` + `length` offsets — Broward's universe is
// small (1-100 records depending on the season relative to the June cert sale),
// so a single 1000-row request typically pulls everything.
//
// Unique key in Lien: (countyFips, documentNumber=<apn>-<taxYear>, source)
// — a property delinquent on multiple tax years gets multiple Lien rows.
// ---------------------------------------------------------------------------

const PAGE_URL = "https://lienhub.com/county/broward/countyheld/certificates";
const COUNTY_FIPS = "12011";
const PAGE_SIZE = 1000; // Broward inventory fits well under this in practice

interface DelinquentRecord {
  apn: string;             // BCPA folio (dashes stripped)
  taxYear: number;         // year the tax went unpaid
  ownerName: string;       // current owner of record
  propertyAddress: string; // situs from LienHub
  certPurchaseAmount: number; // cost to redeem (interest + face + fees)
  faceAmount: number;      // original advertised tax lien amount
  marketValue: number;     // BCPA market value at time of cert issue
  certsOutstanding: number; // number of years delinquent
  alternateKey: string;    // LienHub internal id
}

export interface BrowardTaxDelinquentResult {
  found: number;
  totalReported: number;
  persisted: number;
  skippedHallucinated: number;
}

export async function scrapeBrowardTaxDelinquent(): Promise<BrowardTaxDelinquentResult> {
  const sourceTag = `scraper:broward-tax-${new Date().toISOString().slice(0, 10)}`;
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  let allRecords: DelinquentRecord[] = [];
  let totalReported = 0;

  try {
    const page = await sess.newPage();

    // 1) Hit the page first to clear Cloudflare and acquire the session cookies.
    await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(3000);

    // 2) Issue DataTables AJAX POST from within the browser context — this
    //    inherits the CF-validated cookies + UA fingerprint automatically.
    //    Paginate via `start` offset until we've fetched all records.
    let start = 0;
    let draw = 1;
    while (true) {
      const responseText = await page.evaluate(
        async ({ url, start, length, draw }) => {
          const body = new URLSearchParams({
            datatables_ajax_data: JSON.stringify({
              draw,
              columns: [
                { data: "account_number", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
                { data: "tax_year", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
                { data: "certificate_number", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
                { data: "issued_date", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
                { data: "expiration_date", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
                { data: "purchase_amt", searchable: true, orderable: true, search: { value: "", regex: false, fixed: [] } },
              ],
              order: [{ column: 0, dir: "asc" }],
              start,
              length,
              search: { value: "", regex: false },
            }),
          }).toString();
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
            },
            body,
            credentials: "include",
          });
          return { status: res.status, body: await res.text() };
        },
        { url: PAGE_URL, start, length: PAGE_SIZE, draw },
      );

      if (responseText.status !== 200) {
        throw new Error(`LienHub POST returned ${responseText.status}`);
      }
      let json: any;
      try {
        json = JSON.parse(responseText.body);
      } catch (e) {
        throw new Error(`LienHub POST returned non-JSON (Cloudflare may still be challenging): ${responseText.body.slice(0, 200)}`);
      }

      if (start === 0) {
        totalReported = json.recordsTotal ?? 0;
        console.log(`[broward-tax-delinquent] total records reported: ${totalReported.toLocaleString()}`);
        // Bronze capture of the first page (full server response — full lossless training corpus).
        void captureRaw({
          entityType: "parcel",
          source: "lienhub",
          sourceTag,
          category: "tax_delinquent_notice",
          countyFips: COUNTY_FIPS,
          requestParams: { url: PAGE_URL, pageSize: PAGE_SIZE },
          rawResponse: { totalReported, firstPageJson: json },
          legalRisk: "yellow",
        });
      }

      const rows = parseRecords(json.data ?? []);
      allRecords.push(...rows);
      if (allRecords.length >= totalReported || (json.data?.length ?? 0) < PAGE_SIZE) {
        break;
      }
      start += PAGE_SIZE;
      draw++;
      console.log(`[broward-tax-delinquent] paginated ${allRecords.length}/${totalReported}`);
    }
    console.log(`[broward-tax-delinquent] paginated total: ${allRecords.length}`);
  } finally {
    await sess.close();
  }

  // 3) Persist via bulk-upsert
  const today = new Date();
  let skippedHallucinated = 0;
  const upsertRows: LienUpsertInput[] = [];
  for (const r of allRecords) {
    if (looksHallucinated(r)) { skippedHallucinated++; continue; }
    // Use face amount (the actual lien amount) as the primary amount;
    // purchase_amt is the redemption cost which includes interest + fees.
    const amt = r.faceAmount > 0 ? r.faceAmount : r.certPurchaseAmount;
    upsertRows.push({
      countyFips:       COUNTY_FIPS,
      apn:              r.apn,
      documentNumber:   `${r.apn}-${r.taxYear}`,
      source:           sourceTag,
      lienCategory:     "tax",
      lienTypeCode:     `DELINQUENT_TAX_${r.taxYear}`,
      recordingDate:    today,
      amount:           amt,
      defendantName:    r.ownerName,
      plaintiffAddress: null,
    });
  }
  const bulkResult = await bulkUpsertLiens(upsertRows);
  console.log(
    `[broward-tax-delinquent] bulk-upsert done: persisted=${bulkResult.persisted} batches=${bulkResult.batches} in ${(bulkResult.durationMs / 1000).toFixed(1)}s`,
  );

  return {
    found: allRecords.length,
    totalReported,
    persisted: bulkResult.persisted,
    skippedHallucinated,
  };
}

/** Convert LienHub JSON rows → DelinquentRecord. */
function parseRecords(rows: any[]): DelinquentRecord[] {
  const out: DelinquentRecord[] = [];
  for (const row of rows) {
    const acctRaw = typeof row.account_number === "string" ? row.account_number : "";
    // Broward BCPA folio format: "494107-10-0034" → 12 chars no dashes
    // Keep alphanumerics only (some condo folios contain letters like AB, BJ, BM)
    const apn = acctRaw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!apn) continue;
    const taxYear = parseInt(row.tax_year ?? "", 10);
    if (!Number.isFinite(taxYear)) continue;
    out.push({
      apn,
      taxYear,
      ownerName: String(row.owner_name ?? "").trim(),
      propertyAddress: String(row.property_address ?? "").trim(),
      certPurchaseAmount: parseFloat(row.purchase_amt ?? "0") || 0,
      faceAmount: parseFloat(row.face_amount ?? "0") || 0,
      marketValue: parseFloat(row.market_value ?? "0") || 0,
      certsOutstanding: parseFloat(row.certs_outstanding ?? "0") || 0,
      alternateKey: String(row.alternate_key ?? ""),
    });
  }
  return out;
}

// Defense-in-depth: reject obviously-bogus records even though this is direct
// JSON parsing (no LLM in the pipeline).
function looksHallucinated(r: DelinquentRecord): boolean {
  // Broward BCPA folios are exactly 12 alphanumeric characters: 6 digits + 2 letters + 4 digits
  // OR 12 all-digits (rectangular subdivisions). We accept both shapes.
  if (!r.apn || r.apn.length !== 12) return true;
  if (!/^[0-9A-Z]{12}$/.test(r.apn)) return true;
  if (!r.taxYear || r.taxYear < 1990 || r.taxYear > 2030) return true;
  if (/^(john|jane)\s+(doe|smith)|test|sample|n\/a/i.test(r.ownerName)) return true;
  if (r.faceAmount < 0 || r.faceAmount > 1e8) return true;
  if (r.certPurchaseAmount < 0 || r.certPurchaseAmount > 1e8) return true;
  return false;
}
