import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { captureRaw } from "@/lib/data-sources/raw-capture";
import { politeFetch } from "../base/http-client";

// ---------------------------------------------------------------------------
// Hillsborough County (FL, FIPS 12057) Official-Records ingester — M2.1d
// (Family D per .gstack/qa-reports/CIVITEK-BUILD-SPEC.md).
//
// ★ BULK-FILE PATH — a 0-scrape win. The recon spec said "investigate the bulk
// public-data-files path on hillsclerk.com FIRST (cheaper + greener, possibly
// a 0-scrape win)". It is. Live-verified 2026-06-11:
//
//   hillsclerk.com (Liferay) → /records-and-reports/public-data-files links to
//   a FREE public IIS file server (NO subscription, NO captcha, NO login):
//     https://publicrec.hillsclerk.com/OfficialRecords/DailyIndexes/
//   Three pipe-delimited ASCII files are produced PER BUSINESS DAY:
//     D<YYYYMMDD><NN>id.29   document index  (one row per recorded instrument)
//     P<YYYYMMDD><NN>id.29   related-party index (1..N rows per instrument)
//     M<YYYYMMDD><NN>d.29    doc-code → FACC standard doc-type map
//   "At least two months of files are available online at all times."
//   This is the official-records SEARCH data (HOVER at hover.hillsclerk.com is
//   the same index behind a UI) delivered as bulk files — so we ingest the
//   files and never touch HOVER. The subscription mentioned on the clerk site
//   is for the IMAGE-viewing website only; the index files are open.
//
// FILE LAYOUTS (verified against the site's own readme.txt + live sample
// D/P/M files for 2026-05-29):
//
//   Document file (pipe-delimited, 14 fields, records end CRLF):
//     [0]  Action            DDA=add doc / DDD=delete doc
//     [1]  County number     29 (FACC code for Hillsborough)
//     [2]  Instrument Number  e.g. 2026204877 (YYYY + 6-digit sequence)
//     [3]  Document Type      FACC-ish code: MTG, LN, JUD, SAT, ASG, D, ...
//     [4]  Document Desc      "MORTGAGE", "LIEN", "JUDGMENT", ...
//     [5]  Legal Description  lot/block/subdivision text (NO folio/APN)
//     [6]  Book Type          'O'=Official Records, 'P'=Plat, ...
//     [7]  Book Number
//     [8]  Page Number
//     [9]  Filler             unused
//     [10] Document Page Count
//     [11] Date Recorded      MM/DD/YYYY
//     [12] Time Recorded      HH:MM
//     [13] Consideration      numeric (sales price / loan amount), often blank
//
//   Party file (pipe-delimited, 6 fields):
//     [0] Action   DPA=add party / DPD=delete party
//     [1] County number  29
//     [2] Sequence = the INSTRUMENT NUMBER (joins to Document [2]) — verified
//     [3] Party sequence within the instrument
//     [4] From/To  FRM=direct (grantor) / TO=reverse (grantee)
//     [5] Party Name
//   Both files carry a trailing "EOF|..." sentinel line we skip.
//
// PARTY → schema role mapping (spec §4):
//   mortgage:  FRM = borrower  | TO = lender
//   lien/LP/judgment: FRM = plaintiff/claimant | TO = defendant/owner
//   assignment: FRM = assignor | TO = assignee  (no borrower party)
//
// APN JOIN (the hard part — files carry NO folio, only a legal-description
// string). Single conservative tier, mirroring acclaim-records.ts tier 2:
//   unique-name (confidence 0.85): the OWNER-side party name, compressed
//   ([^A-Z0-9] stripped), matches exactly ONE distinct Parcel.ownerName in
//   12057. >1 distinct parcel = ambiguous = apn left null. The Hillsborough
//   DOR Parcel.apn is the 22-char PARCEL_ID (e.g. 172703ZZZ000000042200U),
//   NOT a folio, so there is no direct-id tier available from these files.
//   Owner side: mortgage→FRM (borrower owns), lien/judgment/LP→TO (defendant
//   owns), assignment/satisfaction→no owner party in the index.
//   Mortgage/Lien have no metadata column, so per-row join confidence is
//   persisted to RawCapture bronze (apnJoins[]); apn is written to the row
//   only at confidence >= 0.85.
//
// Persistence → Mortgage + Lien, source="bulk:hillsborough-or" (file-ingester
// cadence; the source string is vintage-stable so daily re-ingests upsert,
// never dup, on @@unique([countyFips, documentNumber, source])).
//
// EGRESS: DIRECT. publicrec.hillsclerk.com is a plain public IIS file server;
// verified 200 from direct egress 2026-06-11. useProxy:false default.
// ---------------------------------------------------------------------------

const COUNTY_FIPS = "12057";
const FACC_COUNTY = "29";
const SOURCE = "bulk:hillsborough-or";
const BASE_URL = "https://publicrec.hillsclerk.com/OfficialRecords/DailyIndexes";
const DATA_DIR = path.join(process.cwd(), "data", "raw", "hillsborough-or");

// ---------------------------------------------------------------------------
// Doc-type classification (FACC code + description). Order matters; FIRST match
// wins. Codes verified in live D files; descriptions are the fallback signal.
// ---------------------------------------------------------------------------

export type HillsDocFamily =
  | "lis_pendens"
  | "satisfaction"
  | "assignment"
  | "mortgage"
  | "judgment"
  | "lien";

interface FamilyRule {
  family: HillsDocFamily;
  /** Match against `${code} ${description}` upper-cased. */
  match: RegExp;
  exclude?: RegExp;
}

const FAMILY_RULES: FamilyRule[] = [
  { family: "lis_pendens", match: /\bLIS\s*PENDENS\b|\bLISPEN\b|\bLP\b/ },
  {
    family: "satisfaction",
    match: /\bSAT\b|\bREL\b|SATISF|RELEASE|TERMINAT|\bTER\b/,
    exclude: /NOTICE|PRESERVATION/,
  },
  { family: "assignment", match: /\bASG\b|\bASGT\b|ASSIGNMENT/ },
  {
    family: "mortgage",
    match: /\bMTG\b|MORTGAGE|DEED\s*OF\s*TRUST|\bMOD\b|MODIFICATION/,
    exclude: /SATISF|RELEASE|ASSIGNMENT/,
  },
  {
    family: "judgment",
    match: /\bJUD\b|\bCCJ\b|\bDRJUD\b|JUDGMENT/,
    exclude: /HIDDEN|DOMESTIC VIOLENCE|JUVENILE|\bRPO\b|SATISF|RELEASE/,
  },
  {
    family: "lien",
    match: /\bLN\b|\bLIE\b|\bLIEN\b|CLAIM OF LIEN/,
    exclude: /HIDDEN|CANCEL|RELEASE|SATISF|TRANSFER|CONTEST|JUVENILE/,
  },
];

/** Classify `code` + `description` into a distress family, or null to skip. */
export function classifyHillsDoc(
  code: string,
  description: string,
): HillsDocFamily | null {
  const text = `${code} ${description}`.toUpperCase();
  for (const r of FAMILY_RULES) {
    if (r.match.test(text) && !(r.exclude && r.exclude.test(text))) {
      return r.family;
    }
  }
  return null;
}

/** Lien sub-category, mirroring acclaim/landmark classifyLien conventions. */
function classifyLienCategory(family: HillsDocFamily, text: string): string {
  if (family === "lis_pendens") return "lis_pendens";
  if (family === "judgment") return "judgment";
  const t = text.toLowerCase();
  if (/mechan|construction|materialman/.test(t)) return "mechanics";
  if (/hoa|homeowner|association|condo/.test(t)) return "hoa";
  if (/tax/.test(t)) return "tax";
  if (/judgment/.test(t)) return "judgment";
  return "other";
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface HillsDocRow {
  instrument: string;
  docType: string;
  docDescription: string;
  legal: string;
  bookType: string | null;
  bookNumber: string | null;
  pageNumber: string | null;
  recordingDate: Date | null;
  consideration: number | null;
}

export interface HillsPartyRow {
  instrument: string;
  /** "FRM" (grantor/direct) | "TO" (grantee/reverse). */
  fromTo: string;
  name: string;
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseConsideration(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRecDate(s: string | undefined): Date | null {
  if (!s) return null;
  // MM/DD/YYYY → noon UTC to avoid TZ day-shift.
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], 12, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse a D-file (document index) into rows for FACC county 29 only. */
export function parseDocumentFile(text: string): HillsDocRow[] {
  const out: HillsDocRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const f = line.split("|");
    // Skip trailer (EOF|...) and deletes (DDD = delete doc).
    if (f[0] !== "DDA") continue;
    if (f[1] !== FACC_COUNTY) continue;
    const instrument = (f[2] ?? "").trim();
    if (!instrument) continue;
    out.push({
      instrument,
      docType: (f[3] ?? "").trim(),
      docDescription: (f[4] ?? "").trim(),
      legal: (f[5] ?? "").trim(),
      bookType: (f[6] ?? "").trim() || null,
      bookNumber: (f[7] ?? "").trim() || null,
      pageNumber: (f[8] ?? "").trim() || null,
      recordingDate: parseRecDate(f[11]),
      consideration: parseConsideration(f[13]),
    });
  }
  return out;
}

/** Parse a P-file (party index) into rows for FACC county 29 only. */
export function parsePartyFile(text: string): HillsPartyRow[] {
  const out: HillsPartyRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const f = line.split("|");
    if (f[0] !== "DPA") continue; // skip DPD deletes + EOF
    if (f[1] !== FACC_COUNTY) continue;
    const instrument = (f[2] ?? "").trim();
    const name = (f[5] ?? "").trim();
    if (!instrument || !name) continue;
    out.push({ instrument, fromTo: (f[4] ?? "").trim().toUpperCase(), name });
  }
  return out;
}

/** Group party rows by instrument into { grantors[], grantees[] }. */
export function groupParties(
  parties: HillsPartyRow[],
): Map<string, { grantors: string[]; grantees: string[] }> {
  const map = new Map<string, { grantors: string[]; grantees: string[] }>();
  for (const p of parties) {
    let e = map.get(p.instrument);
    if (!e) {
      e = { grantors: [], grantees: [] };
      map.set(p.instrument, e);
    }
    if (p.fromTo === "FRM") e.grantors.push(p.name);
    else if (p.fromTo === "TO") e.grantees.push(p.name);
  }
  return map;
}

// ---------------------------------------------------------------------------
// File discovery + download (bulk-file ingester; NOT a scraper search loop)
// ---------------------------------------------------------------------------

/** A discovered file-pair vintage (a single recording/correction date export). */
interface FileVintage {
  dateKey: string; // YYYYMMDD
  docFile: string; // D2026052901id.29
  partyFile: string | null; // P2026052901id.29 (may be absent)
}

/**
 * List the directory and pair up D + P files by their YYYYMMDD+NN stem. The
 * IIS dir listing renders `HREF="/OfficialRecords/DailyIndexes/<name>"`.
 */
export async function listVintages(useProxy = false): Promise<FileVintage[]> {
  const res = await politeFetch(`${BASE_URL}/`, {
    method: "GET",
    useProxy,
    rateLimitMs: 2000,
    timeoutMs: 45_000,
    headers: { "User-Agent": CHROME_UA, Accept: "text/html,*/*" },
  });
  const html = await res.text();
  if (!res.ok) throw new Error(`[hills-or] dir listing HTTP ${res.status}`);

  const names = new Set<string>();
  const re = /HREF="[^"]*\/(?:OfficialRecords\/DailyIndexes\/)?([DPM]\d{8}\d{2}(?:id|d)\.29)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.add(m[1]);

  // Index by the D-file stem (YYYYMMDD+NN). P shares the stem with "id" suffix.
  const docs = [...names].filter((n) => /^D\d{8}\d{2}id\.29$/.test(n));
  const partySet = new Set([...names].filter((n) => /^P\d{8}\d{2}id\.29$/.test(n)));

  const vintages: FileVintage[] = [];
  for (const d of docs.sort()) {
    const stem = d.slice(1).replace(/id\.29$/, ""); // YYYYMMDDNN
    const dateKey = stem.slice(0, 8);
    const p = `P${stem}id.29`;
    vintages.push({
      dateKey,
      docFile: d,
      partyFile: partySet.has(p) ? p : null,
    });
  }
  return vintages;
}

async function downloadFile(
  name: string,
  useProxy: boolean,
): Promise<string> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const dest = path.join(DATA_DIR, name);
  const res = await politeFetch(`${BASE_URL}/${name}`, {
    method: "GET",
    useProxy,
    rateLimitMs: 2000,
    timeoutMs: 90_000,
    headers: { "User-Agent": CHROME_UA, Accept: "*/*" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[hills-or] download ${name} HTTP ${res.status}`);
  await fs.writeFile(dest, text, "latin1"); // ASCII files; keep a local copy
  return text;
}

// ---------------------------------------------------------------------------
// APN join (single conservative tier — unique compressed owner name)
// ---------------------------------------------------------------------------

function normAlnum(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

interface ClassifiedDoc {
  doc: HillsDocRow;
  family: HillsDocFamily;
  recordingDate: Date;
  grantors: string[];
  grantees: string[];
  /** Owner-side party name used for the name-join (null when no owner party). */
  ownerName: string | null;
  apn: string | null;
  apnTier: "unique-name" | "ambiguous" | "none";
}

/** Resolve APNs in place: compressed owner-name → exactly one distinct parcel. */
async function resolveApns(rows: ClassifiedDoc[]): Promise<void> {
  const nameKeys = new Set<string>();
  for (const r of rows) {
    if (!r.ownerName) continue;
    const key = normAlnum(r.ownerName);
    if (key.length >= 5) nameKeys.add(key);
  }
  if (nameKeys.size === 0) return;

  // Single county-scoped read-only aggregate (bounded; not a big UPDATE — the
  // Railway-proxy chunking landmine in OPERATIONS.md applies to multi-100K
  // writes, not this seq-scan SELECT).
  const keys = [...nameKeys];
  const hits = await prisma.$queryRaw<
    Array<{ key: string; apn: string; n: number }>
  >`
    SELECT t.key, MIN(t.apn) AS apn, COUNT(DISTINCT t.apn)::int AS n
    FROM (
      SELECT regexp_replace(upper("ownerName"), '[^A-Z0-9]', '', 'g') AS key, apn
      FROM flipops."Parcel"
      WHERE "countyFips" = ${COUNTY_FIPS} AND "ownerName" IS NOT NULL
    ) t
    WHERE t.key = ANY(${keys})
    GROUP BY t.key`;

  const byKey = new Map(hits.map((h) => [h.key, h]));
  for (const r of rows) {
    if (!r.ownerName) continue;
    const hit = byKey.get(normAlnum(r.ownerName));
    if (!hit) continue;
    if (hit.n === 1) {
      r.apn = hit.apn;
      r.apnTier = "unique-name";
    } else {
      r.apnTier = "ambiguous";
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistMortgage(r: ClassifiedDoc): Promise<boolean> {
  const doc = r.doc.instrument;
  const isAssignment = r.family === "assignment";
  try {
    await prisma.mortgage.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: COUNTY_FIPS,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: COUNTY_FIPS,
        apn: r.apn,
        recordingDate: r.recordingDate,
        loanAmount: r.doc.consideration,
        // Assignment: FRM=assignor, TO=assignee — no borrower party.
        borrowerName: isAssignment ? null : r.grantors[0] ?? null,
        lenderName: r.grantees[0] ?? null,
        mortgageType: r.doc.docDescription || r.doc.docType || null,
        documentNumber: doc,
        orBook: r.doc.bookNumber,
        orPage: r.doc.pageNumber,
        source: SOURCE,
      },
      update: {
        loanAmount: r.doc.consideration ?? undefined,
        borrowerName: isAssignment ? undefined : r.grantors[0] ?? undefined,
        lenderName: r.grantees[0] ?? undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[hills-or] mortgage persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

async function persistLien(r: ClassifiedDoc): Promise<boolean> {
  const doc = r.doc.instrument;
  const text = `${r.doc.docType} ${r.doc.docDescription}`;
  try {
    await prisma.lien.upsert({
      where: {
        countyFips_documentNumber_source: {
          countyFips: COUNTY_FIPS,
          documentNumber: doc,
          source: SOURCE,
        },
      },
      create: {
        countyFips: COUNTY_FIPS,
        apn: r.apn,
        lienCategory: classifyLienCategory(r.family, text),
        recordingDate: r.recordingDate,
        amount: r.doc.consideration,
        plaintiffName: r.grantors[0] ?? null, // claimant (FRM)
        defendantName: r.grantees[0] ?? null, // owner (TO)
        lienTypeCode: r.doc.docDescription || r.doc.docType || null,
        documentNumber: doc,
        orBook: r.doc.bookNumber,
        orPage: r.doc.pageNumber,
        source: SOURCE,
      },
      update: {
        amount: r.doc.consideration ?? undefined,
        plaintiffName: r.grantors[0] ?? undefined,
        defendantName: r.grantees[0] ?? undefined,
        ...(r.apn ? { apn: r.apn } : {}),
      },
    });
    return true;
  } catch (err) {
    console.warn(`[hills-or] lien persist failed doc=${doc}:`, (err as Error).message);
    return false;
  }
}

/**
 * Apply a satisfaction/release: find the UNIQUE open Mortgage (then Lien) whose
 * owner-side name exactly matches the satisfaction's reverse party (TO) and was
 * recorded before the satisfaction. Ambiguous (0 or 2+) → skip.
 */
async function applySatisfaction(r: ClassifiedDoc): Promise<boolean> {
  const owner = r.grantees[0]?.trim() || r.grantors[0]?.trim();
  if (!owner) return false;
  const releaseDocNum = r.doc.instrument;

  const mortgages = await prisma.mortgage.findMany({
    where: {
      countyFips: COUNTY_FIPS,
      releasedAt: null,
      borrowerName: { equals: owner, mode: "insensitive" },
      recordingDate: { lt: r.recordingDate },
    },
    select: { id: true },
    take: 2,
  });
  if (mortgages.length === 1) {
    await prisma.mortgage.update({
      where: { id: mortgages[0].id },
      data: { releasedAt: r.recordingDate, releaseDocNum },
    });
    return true;
  }
  if (mortgages.length > 1) return false;

  const liens = await prisma.lien.findMany({
    where: {
      countyFips: COUNTY_FIPS,
      releasedAt: null,
      defendantName: { equals: owner, mode: "insensitive" },
      recordingDate: { lt: r.recordingDate },
    },
    select: { id: true },
    take: 2,
  });
  if (liens.length === 1) {
    await prisma.lien.update({
      where: { id: liens[0].id },
      data: { releasedAt: r.recordingDate, releaseDocNum },
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main entry — ingest one vintage (one day's D + P files).
// ---------------------------------------------------------------------------

export interface HillsIngestResult {
  dateKey: string;
  docFile: string;
  /** Document rows in the file (FACC county 29). */
  docsTotal: number;
  /** Rows classified into a distress family. */
  distress: number;
  byFamily: Record<string, number>;
  persistedMortgages: number;
  persistedLiens: number;
  satisfactionsApplied: number;
  satisfactionsSkipped: number;
  apnJoin: { uniqueName: number; ambiguous: number; none: number };
  bytes: number;
}

export async function ingestHillsboroughVintage(opts: {
  vintage: FileVintage;
  useProxy?: boolean;
}): Promise<HillsIngestResult> {
  const useProxy = opts.useProxy ?? false;
  const { vintage } = opts;

  const docText = await downloadFile(vintage.docFile, useProxy);
  const partyText = vintage.partyFile
    ? await downloadFile(vintage.partyFile, useProxy)
    : "";

  const docs = parseDocumentFile(docText);
  const parties = parsePartyFile(partyText);
  const partyMap = groupParties(parties);

  // Classify + attach parties.
  const byFamily: Record<string, number> = {};
  const classified: ClassifiedDoc[] = [];
  for (const doc of docs) {
    const family = classifyHillsDoc(doc.docType, doc.docDescription);
    if (!family) continue;
    if (!doc.recordingDate) continue;
    const grp = partyMap.get(doc.instrument) ?? { grantors: [], grantees: [] };
    byFamily[family] = (byFamily[family] ?? 0) + 1;
    // Owner side for the name-join: mortgage→grantor(borrower owns);
    // lien/judgment/LP→grantee(defendant owns); assignment/sat→none.
    const ownerName =
      family === "mortgage"
        ? grp.grantors[0] ?? null
        : family === "lien" || family === "judgment" || family === "lis_pendens"
          ? grp.grantees[0] ?? null
          : null;
    classified.push({
      doc,
      family,
      recordingDate: doc.recordingDate,
      grantors: grp.grantors,
      grantees: grp.grantees,
      ownerName,
      apn: null,
      apnTier: "none",
    });
  }

  const joinable = classified.filter((c) => c.family !== "satisfaction");
  await resolveApns(joinable);

  const result: HillsIngestResult = {
    dateKey: vintage.dateKey,
    docFile: vintage.docFile,
    docsTotal: docs.length,
    distress: classified.length,
    byFamily,
    persistedMortgages: 0,
    persistedLiens: 0,
    satisfactionsApplied: 0,
    satisfactionsSkipped: 0,
    apnJoin: { uniqueName: 0, ambiguous: 0, none: 0 },
    bytes: docText.length + partyText.length,
  };

  for (const c of joinable) {
    if (c.apnTier === "unique-name") result.apnJoin.uniqueName++;
    else if (c.apnTier === "ambiguous") result.apnJoin.ambiguous++;
    else result.apnJoin.none++;

    if (c.family === "mortgage" || c.family === "assignment") {
      if (await persistMortgage(c)) result.persistedMortgages++;
    } else {
      if (await persistLien(c)) result.persistedLiens++;
    }
  }

  // Satisfactions LAST so same-file originals are already persisted.
  for (const c of classified) {
    if (c.family !== "satisfaction") continue;
    if (await applySatisfaction(c)) result.satisfactionsApplied++;
    else result.satisfactionsSkipped++;
  }

  // Bronze: per-row APN join confidence (Mortgage/Lien have no metadata column).
  void captureRaw({
    entityType: "parcel",
    source: "hillsborough-or",
    sourceTag: `${SOURCE}-${vintage.dateKey}`,
    category: "clerk_recordings_bulk",
    countyFips: COUNTY_FIPS,
    requestParams: {
      baseUrl: BASE_URL,
      docFile: vintage.docFile,
      partyFile: vintage.partyFile,
      useProxy,
    },
    rawResponse: {
      docsTotal: docs.length,
      distress: classified.length,
      byFamily,
      apnJoins: joinable.map((c) => ({
        documentNumber: c.doc.instrument,
        family: c.family,
        apn: c.apn,
        tier: c.apnTier,
        confidence: c.apnTier === "unique-name" ? 0.85 : 0,
      })),
    },
    legalRisk: "yellow",
  });

  return result;
}

/**
 * Ingest the most recent `days` vintages available in the public directory.
 * Returns one result per ingested vintage. This is a FILE-INGESTER (not a
 * date-search adapter): the integration lane should register it with a daily/
 * incremental cadence keyed on the directory's available file dates.
 */
export async function ingestHillsboroughRecords(opts: {
  /** Max number of most-recent vintages to ingest (default 5). */
  maxVintages?: number;
  /** Only ingest vintages with dateKey strictly greater than this (YYYYMMDD). */
  sinceDateKey?: string;
  useProxy?: boolean;
}): Promise<{ vintages: HillsIngestResult[]; latestDateKey: string | null }> {
  const useProxy = opts.useProxy ?? false;
  const all = await listVintages(useProxy);
  let selected = all;
  if (opts.sinceDateKey) {
    selected = selected.filter((v) => v.dateKey > opts.sinceDateKey!);
  }
  const maxV = opts.maxVintages ?? 5;
  // Take the most-recent N (list is sorted ascending by dateKey).
  selected = selected.slice(Math.max(0, selected.length - maxV));

  const out: HillsIngestResult[] = [];
  for (const v of selected) {
    const r = await ingestHillsboroughVintage({ vintage: v, useProxy });
    out.push(r);
    console.log(
      `[hills-or] ${v.dateKey}: docs=${r.docsTotal} distress=${r.distress} mtg=${r.persistedMortgages} lien=${r.persistedLiens} sat=${r.satisfactionsApplied} apn(name=${r.apnJoin.uniqueName})`,
    );
  }
  const latestDateKey =
    all.length > 0 ? all[all.length - 1].dateKey : null;
  return { vintages: out, latestDateKey };
}
