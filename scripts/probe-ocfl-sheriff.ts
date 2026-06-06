/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// OCFL (Orange County Sheriff / Orange County Corrections) inmate roster probe
//
// Source URL: https://netapps.ocfl.net/BestJail/Home/Inmates
// FIPS: 12095 (Orange County, FL — Orlando metro)
// Refresh cadence (documented on page): "This information is updated every
//   30 minutes."
//
// Architecture discovered during probing (2026-05-31):
//   The visible page is a search-form ONLY: last name required. Results
//   render into #list1 / #list2 via three AJAX endpoints. All three return
//   clean application/json — no HTML scraping required.
//
//   Endpoints (ASP.NET MVC routes; verb is POST with empty body `id=`):
//     1. POST /BestJail/Home/getInmates/{lastNameOrLastFirst}
//          -> [{ bookingNumber: string, inmateName: "LAST, FIRST MIDDLE [SUFFIX]" }]
//          -> Returns ALL currently-incarcerated inmates whose last name
//             STARTS WITH the search term. "S" returns everyone S*. The
//             system caps at the database's natural list (no documented
//             pagination); single-letter enumeration A..Z would cover the
//             full current population. (Polite alternative: enumerate the
//             PDF instead — see (4) below.)
//
//     2. POST /BestJail/Home/getInmateDetails/{bookingNumber}
//          -> [{
//               BOOKING: "26018993",           // == bookingNumber
//               NAME: "SMITH, JASON EUGENE ",
//               RACE: "BLACK",
//               GENDER: "MALE",
//               BIRTH: "53",                   // AGE (not DOB — site mislabels)
//               CELL: "BRCTRANS7",
//               DATEBOOKED: "05/30/2026",
//               TIMEBOOKED: "02:20PM",
//               HOLDS: "1",
//               SSN: "",                       // ALWAYS blank — site suppresses (good)
//               STREET: "1713 LONDON CREST DR",// FULL street address EXPOSED
//               APTNUM: "",
//               CITY: "ORLANDO",
//               STATE: "FL",
//               ZIPCODE: "32818         ",     // padded; trim()
//               IMAGE: "<base64 PNG>",         // mugshot, ~50-66KB
//               HasImmigrationHold: false,
//               DBTYPE: null,
//               DBTYPE2: "000",
//               DBTYPE3: "000",
//             }]
//
//     3. POST /BestJail/Home/getCharges/{bookingNumber}
//          -> [{
//               CaseSequence: "248",
//               CaseStatus: "PRESENTENCED",    // also seen: SENTENCED, PRETRIAL, etc.
//               CaseStatusAdd: "",
//               BondAmount: "1000.00",         // string, dollars; "0.00" = no-bond/hold
//               ArrestingAgency: "ORANGE COUNTY SHERIFF OFFICE",
//               Charge: "BATTERY",             // statutory description
//               CourtCaseNumber: "482026MM404717AO",
//               CourtLocation: "CC1 - ORLANDO",
//               Note: ""
//             }, ...]                          // array — one row per charge
//
//     4. GET /BestJail/PDF/bookings.pdf
//          -> Static PDF, "Daily Booking List": ALL inmates booked during
//             the preceding 24-hour period (midnight-to-midnight). ~150KB,
//             ~15 pages, presumably ~150-250 bookings/day given Orange
//             County's size (population ~1.45M, 4th-largest FL metro). This
//             is the cleanest enumeration surface — no captcha, no search
//             gate, single static fetch per 24-hr window.
//
// §119.071 exempt handling:
//   - SSN field is present in the JSON but ALWAYS empty — the source itself
//     suppresses sensitive PII server-side. We should never need to handle
//     SSN removal client-side because the bytes never reach us.
//   - Juveniles do not appear (only adult corrections facility).
//   - Booking number prefix is year (24=2024, 25=2025, 26=2026) — recent
//     bookings sort naturally by string compare on bookingNumber.
//
// Anti-bot posture:
//   - Server: IIS 10 + ASP.NET MVC 5.2.
//   - Fronted by Citrix NetScaler (NSC_* and citrix_ns_id Set-Cookie). NetScaler
//     CAN do bot detection / rate limiting at the WAF layer, but during this
//     5-request probe (one HTML, one PDF, three JSON) we saw clean 200s with
//     no challenge interstitial.
//   - No Cloudflare, no Akamai, no Imperva.
//   - No documented rate limit headers (X-RateLimit-* absent).
//   - Strict-Transport-Security + frame-ancestors CSP enforced, but those
//     are end-user protections, not bot defenses.
//
// Access plan (yellow-zone hardening per FL-COVERAGE-PLAN.md §5.1):
//   - Direct HTTP works with realistic Chrome UA. No Playwright needed.
//   - Recommended cadence: 1 fetch of bookings.pdf every 30 min (matches
//     documented refresh) → then enrich NEW bookingNumbers via getInmateDetails
//     + getCharges. Spaced ≥ 2-3 sec apart, jittered.
//   - Use BD residential proxy on PDF fetches and detail enrichment to
//     distribute load across IPs; NetScaler may rate-limit by source IP.
//   - Steady-state: ~150 new bookings/day × 2 detail calls = ~300 calls/day,
//     spread over the day → 1 call every ~5 min, comfortably under any
//     reasonable rate limit.
// ---------------------------------------------------------------------------

import { writeFile } from "node:fs/promises";

const BASE = "https://netapps.ocfl.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const PROBE_HEADERS_JSON = {
  "User-Agent": UA,
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  "X-Requested-With": "XMLHttpRequest",
  Referer: `${BASE}/BestJail/Home/Inmates`,
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
};

const PROBE_HEADERS_HTML = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function probe() {
  console.log("=".repeat(78));
  console.log("OCFL Inmate Roster Probe — netapps.ocfl.net");
  console.log("=".repeat(78));

  // STEP 1: GET the landing page — establishes the HTML shell, no PII.
  console.log("\n[1/5] GET /BestJail/Home/Inmates (landing HTML)");
  const r1 = await fetch(`${BASE}/BestJail/Home/Inmates`, { headers: PROBE_HEADERS_HTML });
  console.log(`      status=${r1.status} bytes=${(await r1.clone().text()).length}`);
  console.log(`      server=${r1.headers.get("server")}`);
  console.log(`      x-aspnet-mvc=${r1.headers.get("x-aspnetmvc-version")}`);
  console.log(`      set-cookie hint: ${r1.headers.get("set-cookie")?.slice(0, 80)}...`);
  await delay(2500);

  // STEP 2: GET the daily-booking PDF — the canonical enumeration surface.
  console.log("\n[2/5] GET /BestJail/PDF/bookings.pdf (daily booking PDF)");
  const r2 = await fetch(`${BASE}/BestJail/PDF/bookings.pdf`, { headers: PROBE_HEADERS_HTML });
  const pdfBuf = Buffer.from(await r2.arrayBuffer());
  console.log(`      status=${r2.status} bytes=${pdfBuf.length} ct=${r2.headers.get("content-type")}`);
  console.log(`      pdf-version=${pdfBuf.slice(0, 8).toString()}`);
  console.log(`      approx pages: ${(pdfBuf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length}`);
  await delay(2500);

  // STEP 3: POST getInmates for a common last name — confirms enumeration shape.
  console.log("\n[3/5] POST /BestJail/Home/getInmates/SMITH (list AJAX)");
  const r3 = await fetch(`${BASE}/BestJail/Home/getInmates/SMITH`, {
    method: "POST",
    headers: PROBE_HEADERS_JSON,
    body: "id=",
  });
  const list = (await r3.json()) as Array<{ bookingNumber: string; inmateName: string }>;
  console.log(`      status=${r3.status} rows=${list.length}`);
  console.log(`      sample[0]: ${JSON.stringify(list[0])}`);
  console.log(`      booking-year prefixes seen: ${[...new Set(list.map((x) => x.bookingNumber.slice(0, 2)))].sort().join(",")}`);
  await delay(2500);

  if (list.length === 0) {
    console.log("      WARNING: no rows for SMITH — probe target was unexpected. Aborting.");
    return;
  }

  // STEP 4: POST getInmateDetails for one booking — confirms detail shape.
  //   IMPORTANT: we intentionally use the FIRST returned row, which is the
  //   alphabetically-first SMITH. This is public information already on the
  //   roster; we are not exfiltrating beyond what the public page shows.
  const sampleBooking = list[0].bookingNumber;
  console.log(`\n[4/5] POST /BestJail/Home/getInmateDetails/${sampleBooking} (detail AJAX)`);
  const r4 = await fetch(`${BASE}/BestJail/Home/getInmateDetails/${sampleBooking}`, {
    method: "POST",
    headers: PROBE_HEADERS_JSON,
    body: "id=",
  });
  const detail = (await r4.json()) as Array<Record<string, unknown>>;
  console.log(`      status=${r4.status} rows=${detail.length}`);
  if (detail[0]) {
    const redacted = { ...detail[0] };
    if (typeof redacted.IMAGE === "string") redacted.IMAGE = `[base64 png, ${(redacted.IMAGE as string).length} bytes]`;
    console.log(`      detail keys: ${Object.keys(detail[0]).join(", ")}`);
    console.log(`      detail (image-redacted):`);
    console.log(JSON.stringify(redacted, null, 2).split("\n").map((l) => "        " + l).join("\n"));
  }
  await delay(2500);

  // STEP 5: POST getCharges for the same booking.
  console.log(`\n[5/5] POST /BestJail/Home/getCharges/${sampleBooking} (charges AJAX)`);
  const r5 = await fetch(`${BASE}/BestJail/Home/getCharges/${sampleBooking}`, {
    method: "POST",
    headers: PROBE_HEADERS_JSON,
    body: "id=",
  });
  const charges = (await r5.json()) as Array<Record<string, unknown>>;
  console.log(`      status=${r5.status} charge-rows=${charges.length}`);
  if (charges[0]) {
    console.log(`      charge keys: ${Object.keys(charges[0]).join(", ")}`);
    console.log(`      sample charge: ${JSON.stringify(charges[0])}`);
  }

  // Persist samples for downstream schema design.
  await writeFile("scripts/.tmp-ocfl-getInmates.json", JSON.stringify(list, null, 2));
  await writeFile("scripts/.tmp-ocfl-details.json", JSON.stringify(detail, null, 2));
  await writeFile("scripts/.tmp-ocfl-charges.json", JSON.stringify(charges, null, 2));

  console.log("\n" + "=".repeat(78));
  console.log("Probe complete. 5 total requests issued. No DB writes.");
  console.log("=".repeat(78));
}

probe().catch((e) => {
  console.error("PROBE FAIL:", e);
  process.exit(1);
});
