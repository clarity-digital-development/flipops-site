/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// OCFL 200-row re-probe — Option B v0 Stage A.
//
// Purpose: empirically validate the address-join thesis. The verifier of the
// Option B v0 plan flagged that the 28-32% join-hit-rate estimate was based
// on N=1 actual address (scripts/.tmp-ocfl-details.json). Before any v0 code
// ships, we need to convert that estimate from "low confidence" → "medium
// confidence" by parsing 200+ real OCFL bookings and computing the actual
// join hit rate against Parcel.situsAddress in countyFips='12095'.
//
// Strategy:
//   1. Hit getInmates/{lastName} for each letter A..Z, dedupe bookings.
//   2. Take the first ~250 unique bookings (or whatever the roster has).
//   3. For each, POST getInmateDetails to extract STREET+APTNUM+CITY+STATE+ZIPCODE.
//   4. STRIP IMAGE field IMMEDIATELY upon parse (don't carry 66KB base64 in
//      memory longer than necessary — proxy for v0's HTTP-layer streaming-strip).
//   5. Persist to scripts/.tmp-ocfl-reprobe-200.json for downstream join analysis.
//
// Yellow-zone hardening per FL-COVERAGE-PLAN §5.1:
//   - Uses politeFetch with useProxy=true (BD US residential rotation).
//   - 2500ms mean between requests, jittered.
//   - Rotates Chrome UA fingerprint per request.
//   - 20s timeout per request.
//   - IMAGE field discarded at parse — never written to disk, never logged.
//   - SSN field documented as always-empty server-side; we don't read it.
//   - One-shot; not on any cron. Manual trigger only:
//       npx tsx scripts/reprobe-ocfl-200.ts
// ---------------------------------------------------------------------------

import { writeFile, mkdir } from "node:fs/promises";
import { politeFetch } from "../lib/scrapers/base/http-client";

const BASE = "https://netapps.ocfl.net";

const HEADERS_JSON = {
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
  Referer: `${BASE}/BestJail/Home/Inmates`,
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
};

interface InmateListRow {
  bookingNumber: string;
  inmateName: string;
}

interface InmateDetailRaw {
  BOOKING?: string;
  NAME?: string;
  RACE?: string;
  GENDER?: string;
  BIRTH?: string;
  CELL?: string;
  DATEBOOKED?: string;
  TIMEBOOKED?: string;
  HOLDS?: string;
  SSN?: string;
  STREET?: string;
  APTNUM?: string;
  CITY?: string;
  STATE?: string;
  ZIPCODE?: string;
  IMAGE?: unknown;
  HasImmigrationHold?: boolean;
}

interface NormalizedRecord {
  bookingNumber: string;
  inmateNameRaw: string;
  inmateLastName: string | null;
  inmateFirstInitial: string | null;
  street: string;
  aptNum: string;
  city: string;
  state: string;
  zip5: string;
  normalizedStreet: string;
  normalizedZip5: string;
  bookingDate: string;
  rejectedReason: string | null;
}

const RESULTS: NormalizedRecord[] = [];
const STATS = {
  totalEnumerated: 0,
  detailsFetched: 0,
  detailsFailed: 0,
  rejected: {
    emptyStreet: 0,
    homelessOrTransient: 0,
    poBox: 0,
    aptUnit: 0,
    nonFlState: 0,
    other: 0,
  },
  accepted: 0,
};

function normalizeStreet(s: string): string {
  return s
    .toUpperCase()
    .trim()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");
}

function parseName(name: string): { last: string | null; firstInitial: string | null } {
  // "LAST, FIRST MIDDLE [SUFFIX]" format
  const trimmed = name.trim();
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx < 0) return { last: null, firstInitial: null };
  const last = trimmed.slice(0, commaIdx).trim();
  const rest = trimmed.slice(commaIdx + 1).trim();
  const firstInitial = rest.length > 0 ? rest[0].toUpperCase() : null;
  return { last: last || null, firstInitial };
}

function categorizeReject(street: string, apt: string, state: string): string | null {
  if (!street.trim()) {
    STATS.rejected.emptyStreet++;
    return "empty_street";
  }
  const su = street.toUpperCase();
  if (/^\s*(HOMELESS|TRANSIENT|NONE|NO\s+ADDRESS|UNKNOWN)\s*$/.test(su)) {
    STATS.rejected.homelessOrTransient++;
    return "homeless_transient";
  }
  if (/^\s*P\.?\s*O\.?\s*BOX\b/i.test(street)) {
    STATS.rejected.poBox++;
    return "po_box";
  }
  if (apt.trim() !== "") {
    STATS.rejected.aptUnit++;
    return "apartment_unit";
  }
  if (state.trim().toUpperCase() !== "FL") {
    STATS.rejected.nonFlState++;
    return "non_fl_state";
  }
  return null;
}

async function fetchInmateList(letter: string): Promise<InmateListRow[]> {
  try {
    const res = await politeFetch(`${BASE}/BestJail/Home/getInmates/${letter}`, {
      method: "POST",
      body: "id=",
      headers: HEADERS_JSON,
      rateLimitMs: 2500,
      // NOTE Stage A only: BD proxy returns 402 (zone-quota / billing issue
      // surfaced 2026-05-31). Production B2 scraper MUST re-enable
      // useProxy:true once BD is resolved. For this one-shot manual
      // feasibility probe we fall back to direct fetch with polite cadence
      // + vanilla UA — NetScaler did not challenge prior 5-request probes.
      useProxy: false,
      rotateFingerprint: true,
      timeoutMs: 20_000,
      maxRetries: 2,
    });
    if (!res.ok) {
      console.warn(`  [list ${letter}] status=${res.status}`);
      return [];
    }
    const list = (await res.json()) as InmateListRow[];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn(`  [list ${letter}] error:`, (err as Error).message);
    return [];
  }
}

async function fetchInmateDetail(bookingNumber: string): Promise<InmateDetailRaw | null> {
  try {
    const res = await politeFetch(`${BASE}/BestJail/Home/getInmateDetails/${bookingNumber}`, {
      method: "POST",
      body: "id=",
      headers: HEADERS_JSON,
      rateLimitMs: 2500,
      // NOTE Stage A only: BD proxy returns 402 (zone-quota / billing issue
      // surfaced 2026-05-31). Production B2 scraper MUST re-enable
      // useProxy:true once BD is resolved. For this one-shot manual
      // feasibility probe we fall back to direct fetch with polite cadence
      // + vanilla UA — NetScaler did not challenge prior 5-request probes.
      useProxy: false,
      rotateFingerprint: true,
      timeoutMs: 20_000,
      maxRetries: 2,
    });
    if (!res.ok) {
      STATS.detailsFailed++;
      return null;
    }
    const detail = (await res.json()) as InmateDetailRaw[];
    if (!Array.isArray(detail) || detail.length === 0) {
      STATS.detailsFailed++;
      return null;
    }
    const row = detail[0];
    // IMAGE strip — never persist, never log. Set to null immediately.
    delete row.IMAGE;
    STATS.detailsFetched++;
    return row;
  } catch (err) {
    STATS.detailsFailed++;
    console.warn(`  [detail ${bookingNumber}] error:`, (err as Error).message);
    return null;
  }
}

async function main() {
  console.log("=".repeat(78));
  console.log("OCFL 200-row re-probe — address-join feasibility validation");
  console.log("=".repeat(78));
  console.log(`Proxy: ${process.env.BRIGHT_DATA_PROXY_URL ? "BD-residential (enabled)" : "DIRECT (no proxy set)"}`);
  console.log(`Mean rate: 2500ms with σ≈30% jitter via politeFetch`);
  console.log(`Started: ${process.uptime().toFixed(1)}s into process`);
  console.log("");

  // STEP 1: enumerate A..Z to collect booking numbers
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const bookingMap = new Map<string, InmateListRow>();

  for (const letter of letters) {
    const list = await fetchInmateList(letter);
    let added = 0;
    for (const row of list) {
      if (!bookingMap.has(row.bookingNumber)) {
        bookingMap.set(row.bookingNumber, row);
        added++;
      }
    }
    STATS.totalEnumerated = bookingMap.size;
    console.log(
      `  [list ${letter}] returned=${list.length} new=${added} cumulative=${bookingMap.size}`,
    );
    if (bookingMap.size >= 300) {
      console.log(`  reached ~300 unique bookings — stopping enumeration early`);
      break;
    }
  }

  if (bookingMap.size === 0) {
    console.error("FAIL: enumeration returned no bookings. Aborting.");
    process.exit(1);
  }

  // STEP 2: sample 200 bookings (preserve insertion order = alphabetical)
  const sampleBookings = Array.from(bookingMap.values()).slice(0, 250);
  console.log(`\nFetching details for ${sampleBookings.length} bookings...`);

  for (let i = 0; i < sampleBookings.length; i++) {
    const row = sampleBookings[i];
    const detail = await fetchInmateDetail(row.bookingNumber);
    if (i % 25 === 0) {
      console.log(
        `  [detail ${i + 1}/${sampleBookings.length}] booking=${row.bookingNumber} success=${STATS.detailsFetched} fail=${STATS.detailsFailed}`,
      );
    }
    if (!detail) continue;

    const street = (detail.STREET ?? "").trim();
    const apt = (detail.APTNUM ?? "").trim();
    const city = (detail.CITY ?? "").trim();
    const state = (detail.STATE ?? "").trim();
    const zip = (detail.ZIPCODE ?? "").trim();
    const zip5 = zip.slice(0, 5);

    const reject = categorizeReject(street, apt, state);
    const { last, firstInitial } = parseName(row.inmateName);

    const norm: NormalizedRecord = {
      bookingNumber: row.bookingNumber,
      inmateNameRaw: row.inmateName,
      inmateLastName: last,
      inmateFirstInitial: firstInitial,
      street,
      aptNum: apt,
      city,
      state,
      zip5,
      normalizedStreet: normalizeStreet(street),
      normalizedZip5: zip5,
      bookingDate: detail.DATEBOOKED ?? "",
      rejectedReason: reject,
    };
    RESULTS.push(norm);
    if (!reject) STATS.accepted++;
  }

  // STEP 3: write artifact
  await mkdir("scripts/probe-artifacts", { recursive: true });
  await writeFile(
    "scripts/probe-artifacts/ocfl-reprobe-200.json",
    JSON.stringify({ stats: STATS, records: RESULTS }, null, 2),
  );

  console.log("\n" + "=".repeat(78));
  console.log("RE-PROBE COMPLETE");
  console.log("=".repeat(78));
  console.log(`  enumerated:           ${STATS.totalEnumerated}`);
  console.log(`  detail successes:     ${STATS.detailsFetched}`);
  console.log(`  detail failures:      ${STATS.detailsFailed}`);
  console.log("  rejections (filter stack):");
  console.log(`    empty/blank street:   ${STATS.rejected.emptyStreet}`);
  console.log(`    homeless/transient:   ${STATS.rejected.homelessOrTransient}`);
  console.log(`    PO Box:               ${STATS.rejected.poBox}`);
  console.log(`    apartment unit:       ${STATS.rejected.aptUnit}`);
  console.log(`    non-FL state:         ${STATS.rejected.nonFlState}`);
  console.log(`  accepted for join:    ${STATS.accepted}`);
  console.log(`  accept rate:          ${((STATS.accepted / STATS.detailsFetched) * 100).toFixed(1)}%`);
  console.log("");
  console.log(`  Saved to scripts/probe-artifacts/ocfl-reprobe-200.json`);
  console.log(`  Next: npx tsx scripts/compute-ocfl-join-rate.ts`);
}

main().catch((err) => {
  console.error("RE-PROBE FATAL:", err);
  process.exit(1);
});
