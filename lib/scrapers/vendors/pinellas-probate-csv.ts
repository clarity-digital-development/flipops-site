import { prisma } from "@/lib/prisma";
import { politeFetch } from "../base/http-client";
import { normalizeCaseType, normalizeDecedentName } from "./probate-mvc";

// ---------------------------------------------------------------------------
// Pinellas County (FIPS 12103) PROBATE — captcha-free daily-CSV ingester.
// M3.1 / OPS-8. Discovered + verified live 2026-06-13 (see memory
// project_ops8_county_source_map).
//
// The Pinellas Clerk of the Circuit Court & Comptroller publishes an OPEN,
// login-free, captcha-free IIS static directory of daily new-estate filings:
//
//   https://publicfiles.mypinellasclerk.gov/download/PROBATE/
//     NEW_ESTATE_CASE_FILINGS_DAILY/EstateNewCaseFilingsDaily_MM-DD-YYYY.csv
//
// One CSV per business day, ~90-day rolling window, posted ~09:00 UTC the next
// business day. This is the SUPERIOR Pinellas path vs the captcha-gated /
// 500-row-capped courtrecords.mypinellasclerk.gov search portal AND vs the
// reCAPTCHA-gated P-MVC scraper (probate-mvc.ts) — same county, $0, zero
// scraping risk, and it carries DOB / Date-of-Death / attorney fields the
// portal does not.
//
// LEGAL: green. This is data the Clerk publishes to the public at large (the
// directory states the files "no longer require an account"). We ingest the
// public docket INDEX only — never confidential filings within a case.
//
// EGRESS: direct (useProxy:false). It's a government static file host.
//
// CSV QUIRK (caught live 2026-06-13): the file is NOT RFC-4180 — fields are
// unquoted, and the free-text "Attorney's Address" field contains UNQUOTED
// embedded commas (e.g. `ROOTH & ROOTH, P.A. 7600 SEMINOLE BLVD, STE 102 ...`).
// A naive split(",") therefore over-shards that row. parseProbateCsvRow()
// anchors on the rigid fields instead: cols 0-2 (Category/Type/CaseNumber) by
// position, the Uniform Case Number as the right anchor, and the first
// MM/DD/YYYY date as the Case-Create-Date anchor — so commas in the Title or
// Address fields are absorbed rather than shifting the columns.
//
// SCHEMA NOTE: ProbateCase now carries decedentDob / decedentDateOfDeath /
// attorneyName / attorneyAddress (M3.1 schema extension), so every parsed field
// is persisted. Date-of-Death is the high-value column — it dates the
// peak-motivation window better than the filing date. Everything lands on
// ProbateCase with source "probate:pinellas-publicfiles-csv".
// ---------------------------------------------------------------------------

export const PINELLAS_PROBATE = {
  countyFips: "12103",
  county: "Pinellas",
  source: "probate:pinellas-publicfiles-csv",
  baseUrl:
    "https://publicfiles.mypinellasclerk.gov/download/PROBATE/NEW_ESTATE_CASE_FILINGS_DAILY/",
  /** EstateNewCaseFilingsDaily_MM-DD-YYYY.csv for a given date (UTC components). */
  fileName(d: Date): string {
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `EstateNewCaseFilingsDaily_${mm}-${dd}-${yyyy}.csv`;
  },
  fileUrl(d: Date): string {
    return this.baseUrl + this.fileName(d);
  },
} as const;

// ---------------------------------------------------------------------------
// Parsing — pure, no I/O (the testable core).
// ---------------------------------------------------------------------------

/** One parsed CSV row, all 19 columns (DOB/DOD/attorney now persisted to ProbateCase). */
export interface PinellasProbateRow {
  caseCategory: string;
  caseType: string;
  caseNumber: string;
  title: string;
  caseCreateDate: string;
  decedentFirst: string;
  decedentMiddle: string;
  decedentLast: string;
  dob: string;
  dateOfDeath: string;
  repType: string;
  repFirst: string;
  repMiddle: string;
  repLast: string;
  attorneyFirst: string;
  attorneyMiddle: string;
  attorneyLast: string;
  attorneyAddress: string;
  uniformCaseNumber: string;
}

const DATE_RE = /^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/;
const HEADER_RE = /case\s*category/i;

function strip(s: string | undefined): string {
  return (s ?? "").replace(/^"|"$/g, "").trim();
}

/**
 * Parse one data line. Robust to unquoted embedded commas in the Title (col 3)
 * and Attorney Address (col 17) fields by anchoring on the rigid columns.
 * Returns null for header / blank / unanchorable rows.
 */
export function parseProbateCsvRow(line: string): PinellasProbateRow | null {
  if (!line || !line.trim()) return null;
  // Strip a UTF-8 BOM if present on the first line.
  const clean = line.replace(/^﻿/, "");
  if (HEADER_RE.test(clean) && /case\s*number/i.test(clean)) return null; // header

  const parts = clean.split(",");
  if (parts.length < 19) return null; // too short to be a valid 19-column row

  const at = (i: number): string => (i >= 0 && i < parts.length ? strip(parts[i]) : "");

  const caseCategory = at(0);
  const caseType = at(1);
  const caseNumber = at(2);
  const uniformCaseNumber = at(parts.length - 1);

  // Anchor: the Case Create Date is the first MM/DD/YYYY at index >= 4. Title
  // (col 3) is everything between the case number and that date (may hold commas).
  let dateIdx = -1;
  for (let i = 4; i < parts.length - 1; i++) {
    if (DATE_RE.test(parts[i])) {
      dateIdx = i;
      break;
    }
  }
  if (dateIdx === -1) return null; // no anchorable create-date → reject (don't corrupt)

  const title = parts.slice(3, dateIdx).map(strip).join(", ").trim();
  const caseCreateDate = at(dateIdx);

  // Fixed single-token columns following the create date.
  const decedentFirst = at(dateIdx + 1);
  const decedentMiddle = at(dateIdx + 2);
  const decedentLast = at(dateIdx + 3);
  const dob = at(dateIdx + 4);
  const dateOfDeath = at(dateIdx + 5);
  const repType = at(dateIdx + 6);
  const repFirst = at(dateIdx + 7);
  const repMiddle = at(dateIdx + 8);
  const repLast = at(dateIdx + 9);
  const attorneyFirst = at(dateIdx + 10);
  const attorneyMiddle = at(dateIdx + 11);
  const attorneyLast = at(dateIdx + 12);

  // Address (col 17) absorbs any remaining commas up to the right anchor.
  const addrStart = dateIdx + 13;
  const addrEnd = parts.length - 1; // exclusive — uniformCaseNumber is the last col
  const attorneyAddress =
    addrStart < addrEnd ? parts.slice(addrStart, addrEnd).map((p) => p.trim()).join(", ").trim() : "";

  if (!caseNumber) return null;

  return {
    caseCategory,
    caseType,
    caseNumber,
    title,
    caseCreateDate,
    decedentFirst,
    decedentMiddle,
    decedentLast,
    dob,
    dateOfDeath,
    repType,
    repFirst,
    repMiddle,
    repLast,
    attorneyFirst,
    attorneyMiddle,
    attorneyLast,
    attorneyAddress,
    uniformCaseNumber,
  };
}

/** Parse a whole CSV file body into rows (header + blanks skipped). */
export function parsePinellasProbateCsv(text: string): PinellasProbateRow[] {
  const out: PinellasProbateRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = parseProbateCsvRow(line);
    if (row) out.push(row);
  }
  return out;
}

/** Shape persisted to ProbateCase (pure mapping — no I/O). Dates stay as the raw
 *  MM/DD/YYYY strings here ("" when absent) and are parsed in persistRow. */
export interface ProbateCaseInput {
  caseNumber: string;
  decedentName: string;
  personalRepresentative: string | null;
  caseTypeRaw: string;
  filedAt: string;
  dob: string;                       // decedent's date of birth, MM/DD/YYYY or ""
  dateOfDeath: string;               // decedent's date of death, MM/DD/YYYY or "" — peak-window driver
  attorneyName: string | null;       // petitioner's attorney, assembled "FIRST MIDDLE LAST"
  attorneyAddress: string | null;    // petitioner's attorney address (free-text, as printed)
}

/** Map a parsed row to the ProbateCase fields we can persist today. */
export function toProbateCaseInput(row: PinellasProbateRow): ProbateCaseInput {
  // Prefer the structured decedent columns ("LAST, FIRST MIDDLE" — the order
  // normalizeDecedentName canonicalizes). Fall back to the Title with the
  // "IN RE: THE ESTATE OF" lead stripped.
  const last = row.decedentLast.trim();
  const first = row.decedentFirst.trim();
  const middle = row.decedentMiddle.trim();
  let decedentName = "";
  if (last || first) {
    const given = [first, middle].filter(Boolean).join(" ");
    decedentName = given ? `${last}, ${given}` : last;
  } else {
    decedentName = row.title.replace(/^IN\s+RE:?\s*(THE\s+)?ESTATE\s+OF\s*/i, "").trim();
  }

  const pr = [row.repFirst, row.repMiddle, row.repLast]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  // Petitioner's attorney — assembled the same way as the PR name.
  const attorneyName = [row.attorneyFirst, row.attorneyMiddle, row.attorneyLast]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    caseNumber: row.caseNumber,
    decedentName: decedentName || "(unknown)",
    personalRepresentative: pr || null,
    caseTypeRaw: row.caseType,
    filedAt: row.caseCreateDate,
    dob: row.dob,
    dateOfDeath: row.dateOfDeath,
    attorneyName: attorneyName || null,
    attorneyAddress: row.attorneyAddress.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Persistence — upsert ProbateCase (unique countyFips+caseNumber).
// Dedicated (not probate-mvc's persistProbateCase) so the `source` provenance
// reflects the CSV origin rather than the reCAPTCHA-gated MVC portal.
// ---------------------------------------------------------------------------

/** CSV dates are MM/DD/YYYY — locale-ambiguous to `new Date` (parsed as LOCAL
 *  midnight, undefined per ECMA-262). Parse to explicit UTC midnight so
 *  `filedAt` is correct regardless of the runner's timezone. */
export function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function persistRow(input: ProbateCaseInput): Promise<number> {
  if (!input.caseNumber) return 0;
  const caseTypeCode = normalizeCaseType(input.caseTypeRaw);
  const filedAt = parseDate(input.filedAt);
  const decedentDob = parseDate(input.dob);
  const decedentDateOfDeath = parseDate(input.dateOfDeath);
  const decedentNameNormalized = normalizeDecedentName(input.decedentName);
  try {
    await prisma.probateCase.upsert({
      where: {
        countyFips_caseNumber: {
          countyFips: PINELLAS_PROBATE.countyFips,
          caseNumber: input.caseNumber,
        },
      },
      create: {
        countyFips: PINELLAS_PROBATE.countyFips,
        caseNumber: input.caseNumber,
        decedentName: input.decedentName || "(unknown)",
        decedentNameNormalized: decedentNameNormalized || null,
        personalRepresentative: input.personalRepresentative,
        caseTypeRaw: input.caseTypeRaw || null,
        caseTypeCode,
        filedAt,
        status: filedAt ? "OPEN" : null,
        decedentDob,
        decedentDateOfDeath,
        attorneyName: input.attorneyName,
        attorneyAddress: input.attorneyAddress,
        prAppointedAt: null, // parity with persistProbateCase; letters-of-admin date not in this feed
        source: PINELLAS_PROBATE.source,
      },
      update: {
        // Never overwrite `source` (first-writer-wins provenance — mirrors
        // persistProbateCase). Refresh the index fields.
        decedentName: input.decedentName || undefined,
        decedentNameNormalized: decedentNameNormalized || undefined,
        personalRepresentative: input.personalRepresentative ?? undefined,
        caseTypeRaw: input.caseTypeRaw || undefined,
        caseTypeCode,
        filedAt: filedAt ?? undefined,
        decedentDob: decedentDob ?? undefined,
        decedentDateOfDeath: decedentDateOfDeath ?? undefined,
        attorneyName: input.attorneyName ?? undefined,
        attorneyAddress: input.attorneyAddress ?? undefined,
      },
    });
    return 1;
  } catch (err) {
    console.warn("[pinellas-probate-csv] persist failed:", (err as Error).message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Scrape — walk the daily CSV window, fetch each file, parse, upsert.
// ---------------------------------------------------------------------------

/** Hard cap on a daily CSV body. A real file is a few KB; this guards against
 *  an oversized/hostile 200 response exhausting worker heap before parsing. */
const MAX_CSV_BYTES = 10 * 1024 * 1024;

export interface PinellasProbateScrapeOpts {
  /** Inclusive lower bound (cursor from the last successful run). */
  sinceDate?: Date | null;
  /** Bootstrap window when no cursor is given (default 90 = the full retained window). */
  daysBack?: number;
  /** Override "now" for deterministic runs/tests. */
  today?: Date;
  /** Per-file polite gap (ms). */
  rateLimitMs?: number;
}

export interface PinellasProbateScrapeResult {
  countyFips: string;
  county: string;
  outcome: "ok" | "empty" | "error";
  filesFound: number;
  filesMissing: number;
  rowsFound: number;
  persisted: number;
  /** Latest date (YYYY-MM-DD) the run advanced through — the new cursor. */
  newHighWaterMark: string | null;
  errors: string[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A UTC date at noon (DST-safe) for the given y/m/d. */
function utcNoon(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

export async function scrapePinellasProbateCsv(
  opts: PinellasProbateScrapeOpts = {},
): Promise<PinellasProbateScrapeResult> {
  const now = opts.today ?? new Date();
  const end = utcNoon(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysBack = opts.daysBack ?? 90;

  let start: Date;
  if (opts.sinceDate) {
    const s = opts.sinceDate;
    start = utcNoon(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  } else {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - daysBack);
  }

  const result: PinellasProbateScrapeResult = {
    countyFips: PINELLAS_PROBATE.countyFips,
    county: PINELLAS_PROBATE.county,
    outcome: "ok",
    filesFound: 0,
    filesMissing: 0,
    rowsFound: 0,
    persisted: 0,
    newHighWaterMark: opts.sinceDate ? dayKey(opts.sinceDate) : null,
    errors: [],
  };

  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const url = PINELLAS_PROBATE.fileUrl(d);
    try {
      const res = await politeFetch(url, {
        method: "GET",
        useProxy: false,
        rateLimitMs: opts.rateLimitMs ?? 800,
        timeoutMs: 30_000,
        maxRetries: 2,
        headers: { Accept: "text/csv,text/plain,*/*" },
      });

      if (res.status === 404) {
        // No file for this day (weekend/holiday/not-yet-posted). Do NOT advance
        // the cursor here — a transient 404 on a real filing day would skip it
        // forever. We advance only on a parsed file, so the next run re-scans
        // from the last success; re-hitting no-filing 404s is cheap + self-heals.
        result.filesMissing++;
        continue;
      }
      if (!res.ok) {
        result.errors.push(`HTTP ${res.status} ${url}`);
        continue;
      }

      // Guard a 200 that isn't actually our CSV (IIS can serve an HTML error
      // page at 200) or an oversized body — either would parse to 0 rows and
      // otherwise advance the cursor past a real day.
      const contentType = res.headers.get("content-type") ?? "";
      const contentLength = Number(res.headers.get("content-length") ?? 0);
      if (contentLength > MAX_CSV_BYTES) {
        result.errors.push(`oversized ${contentLength}B ${url}`);
        continue;
      }
      const body = await res.text();
      if (body.length > MAX_CSV_BYTES) {
        result.errors.push(`oversized body ${body.length}B ${url}`);
        continue;
      }
      if (/html|xml/i.test(contentType) || /^\s*</.test(body)) {
        result.errors.push(`non-CSV response (content-type "${contentType}") ${url}`);
        continue;
      }

      const rows = parsePinellasProbateCsv(body);
      result.filesFound++;
      result.rowsFound += rows.length;
      for (const row of rows) {
        result.persisted += await persistRow(toProbateCaseInput(row));
      }
      result.newHighWaterMark = dayKey(d); // advance only on a real, parsed file
    } catch (err) {
      result.errors.push(`${(err as Error).message} ${url}`);
    }
  }

  if (result.filesFound === 0 && result.errors.length > 0) result.outcome = "error";
  else if (result.rowsFound === 0) result.outcome = "empty"; // genuinely no rows (not an idempotent re-run noop)

  return result;
}
