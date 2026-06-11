import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { politeFetch } from "@/lib/scrapers/base/http-client";
import { captureCookiesFromUrl } from "@/lib/scrapers/base/cookie-fetch";
import { decodeMacroHtml } from "@/lib/scrapers/vendors/realauction-macros";

// ---------------------------------------------------------------------------
// LANE B5 probe: does *.realforeclose.com pin the auction date to the CF
// session at SPLASH time (ignoring the XHR AuctionDate param), the way
// *.realtaxdeed.com verifiably does (realtaxdeed.ts landmine (a),
// verified live 2026-06-10)?
//
// Method (one county, default hillsborough):
//   0. Calendar GET(s) -> find two distinct future auction dates D1 < D2.
//   1. Jar A: fresh cookie mint at splash?AuctionDate=D1.
//   2. XHR AREA=W AuctionDate=D1 with jar A  -> cases A_D1  (baseline D1)
//   3. XHR AREA=W AuctionDate=D2 with jar A  -> cases A_D2  (STALE-jar D2)
//   4. Jar B: fresh cookie mint at splash?AuctionDate=D2.
//   5. XHR AREA=W AuctionDate=D2 with jar B  -> cases B_D2  (FRESH-jar D2)
//   6. XHR AREA=W AuctionDate=D1 with jar B  -> cases B_D1  (STALE-jar D1,
//      reverse direction — mirrors the bidirectional taxdeed verification)
//
// Verdict:
//   CONFIRMED pinning  if A_D2 == A_D1 != B_D2   (stale jar returns splash-
//                      date rows regardless of the XHR param)
//   REFUTED            if A_D2 == B_D2 != A_D1   (XHR param is honored)
//   INCONCLUSIVE       otherwise (empty sets / identical calendars)
//
// Direct egress (useProxy:false) — RealAuction WAF 403s DataImpulse pool.
// Total requests: ~2 calendar + 2 splash + 4 XHR = 8, politeFetch-paced.
//
// USAGE: npx tsx scripts/probe-realforeclose-date-pinning.ts [subdomain]
// ---------------------------------------------------------------------------

const SUBDOMAIN = process.argv[2] ?? "hillsborough";
const HOST = `${SUBDOMAIN}.realforeclose.com`;
const REPORT_PATH = join(process.cwd(), ".gstack", "qa-reports", "realauction-date-pinning-probe.md");

function splashUrl(auctionDate: string): string {
  return `https://${HOST}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AuctionDate=${encodeURIComponent(auctionDate)}`;
}

function xhrUrl(area: "W" | "R" | "C", auctionDate: string): string {
  return `https://${HOST}/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=${area}&AuctionDate=${encodeURIComponent(auctionDate)}`;
}

function calendarUrl(firstOfMonth?: Date): string {
  const base = `https://${HOST}/index.cfm?zaction=USER&zmethod=CALENDAR`;
  if (!firstOfMonth) return base;
  const y = firstOfMonth.getUTCFullYear();
  const m = String(firstOfMonth.getUTCMonth() + 1).padStart(2, "0");
  return `${base}&selCalDate=${encodeURIComponent(`{ts '${y}-${m}-01 00:00:00'}`)}`;
}

async function get(url: string, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  const res = await politeFetch(url, {
    method: "GET",
    useProxy: false,
    rotateFingerprint: true,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...extraHeaders,
    },
  });
  return { status: res.status, body: await res.text() };
}

/** Calendar day boxes with sales carry dayid='MM/DD/YYYY'. */
function parseCalendarDates(html: string): Array<{ date: string; text: string }> {
  const $ = cheerio.load(html);
  const out: Array<{ date: string; text: string }> = [];
  $("[dayid]").each((_, el) => {
    const dayid = ($(el).attr("dayid") ?? "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dayid)) return;
    out.push({ date: dayid, text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 60) });
  });
  return out;
}

interface XhrResult {
  httpStatus: number;
  retHTMLBytes: number;
  cases: string[];
  bodyFirst120: string;
}

async function xhrCases(area: "W" | "R" | "C", auctionDate: string, cookieHeader: string, refererDate: string): Promise<XhrResult> {
  const res = await politeFetch(xhrUrl(area, auctionDate), {
    method: "GET",
    useProxy: false,
    rotateFingerprint: true,
    headers: {
      Cookie: cookieHeader,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json,text/javascript,*/*;q=0.01",
      Referer: splashUrl(refererDate),
    },
  });
  const body = await res.text();
  let retHTML = "";
  try {
    const env = JSON.parse(body) as { retHTML?: string };
    retHTML = typeof env.retHTML === "string" ? env.retHTML : "";
  } catch {
    retHTML = "";
  }
  const cases: string[] = [];
  if (retHTML) {
    const $ = cheerio.load(decodeMacroHtml(retHTML));
    $("div[id^='AITEM_']").each((_, item) => {
      $(item)
        .find("table.ad_tab > tbody > tr")
        .each((__, tr) => {
          const label = $(tr).find("td.AD_LBL").first().text().trim().replace(/:$/, "");
          if (label !== "Case #") return;
          const $data = $(tr).find("td.AD_DTA").first();
          const v = ($data.find("a").first().text().trim() || $data.text().trim()).trim();
          if (v) cases.push(v);
        });
    });
  }
  return { httpStatus: res.status, retHTMLBytes: retHTML.length, cases: cases.sort(), bodyFirst120: body.slice(0, 120) };
}

const eq = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const fmt = (r: XhrResult) =>
  `status=${r.httpStatus} retHTMLBytes=${r.retHTMLBytes} cases(${r.cases.length})=[${r.cases.slice(0, 12).join(", ")}${r.cases.length > 12 ? ", ..." : ""}]`;

async function main() {
  console.log(`Probing ${HOST} for splash-time date pinning...\n`);

  // (0) Discover auction dates from the calendar (current + next month).
  const now = new Date();
  const allDays: Array<{ date: string; text: string }> = [];
  for (let i = 0; i <= 1; i++) {
    const first = i === 0 ? undefined : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const { status, body } = await get(calendarUrl(first));
    console.log(`calendar month+${i}: HTTP ${status}, ${body.length} bytes`);
    if (status === 200) allDays.push(...parseCalendarDates(body));
  }
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const toMs = (d: string) => {
    const [mm, dd, yy] = d.split("/").map((x) => parseInt(x, 10));
    return Date.UTC(yy, mm - 1, dd);
  };
  const future = [...new Map(allDays.map((d) => [d.date, d])).values()]
    .filter((d) => toMs(d.date) > todayMs)
    .sort((a, b) => toMs(a.date) - toMs(b.date));
  console.log(`future auction days found: ${future.map((d) => `${d.date}('${d.text}')`).join(" | ") || "(none)"}\n`);
  if (future.length < 2) {
    console.error("Need >=2 future auction dates to probe — aborting.");
    process.exit(2);
  }
  const D1 = future[0].date;
  // Prefer a D2 several days out so the row sets can't accidentally coincide.
  const D2 = (future.find((d) => toMs(d.date) >= toMs(D1) + 5 * 86400_000) ?? future[1]).date;
  console.log(`D1=${D1}  D2=${D2}\n`);

  // (1) Jar A minted at D1 splash.
  const jarA = await captureCookiesFromUrl(splashUrl(D1), { useProxy: false });
  console.log(`jar A (splash D1): ${jarA.split("; ").map((c) => c.split("=")[0]).join(", ")}`);

  // (2) Baseline: D1 via jar A.
  const A_D1 = await xhrCases("W", D1, jarA, D1);
  console.log(`A_D1 (jar A, XHR D1): ${fmt(A_D1)}`);

  // (3) STALE: D2 via jar A (jar minted at D1).
  const A_D2 = await xhrCases("W", D2, jarA, D2);
  console.log(`A_D2 (jar A, XHR D2): ${fmt(A_D2)}`);

  // (4) Jar B minted at D2 splash.
  const jarB = await captureCookiesFromUrl(splashUrl(D2), { useProxy: false });
  console.log(`jar B (splash D2): ${jarB.split("; ").map((c) => c.split("=")[0]).join(", ")}`);

  // (5) FRESH: D2 via jar B.
  const B_D2 = await xhrCases("W", D2, jarB, D2);
  console.log(`B_D2 (jar B, XHR D2): ${fmt(B_D2)}`);

  // (6) Reverse STALE: D1 via jar B (jar minted at D2).
  const B_D1 = await xhrCases("W", D1, jarB, D1);
  console.log(`B_D1 (jar B, XHR D1): ${fmt(B_D1)}\n`);

  const staleEqualsSplash = eq(A_D2.cases, A_D1.cases);
  const staleEqualsFresh = eq(A_D2.cases, B_D2.cases);
  const calendarsDiffer = !eq(A_D1.cases, B_D2.cases);
  const reverseStaleEqualsSplash = eq(B_D1.cases, B_D2.cases);
  const reverseStaleEqualsFresh = eq(B_D1.cases, A_D1.cases);

  let verdict: string;
  if (!calendarsDiffer || A_D1.cases.length === 0 || B_D2.cases.length === 0) {
    verdict = "INCONCLUSIVE — D1/D2 row sets identical or empty; pick different dates/county.";
  } else if (staleEqualsSplash && !staleEqualsFresh) {
    verdict = "CONFIRMED — the CF session pins the auction date at SPLASH time; the XHR AuctionDate param is IGNORED on realforeclose.com.";
  } else if (staleEqualsFresh && !staleEqualsSplash) {
    verdict = "REFUTED — the XHR AuctionDate param IS honored on realforeclose.com; cross-date cookie reuse is safe.";
  } else {
    verdict = "INCONCLUSIVE — mixed signals; inspect raw sets below.";
  }
  console.log(`VERDICT: ${verdict}`);
  console.log(`  forward:  stale(A,D2)==splash(A,D1): ${staleEqualsSplash} | stale(A,D2)==fresh(B,D2): ${staleEqualsFresh}`);
  console.log(`  reverse:  stale(B,D1)==splash(B,D2): ${reverseStaleEqualsSplash} | stale(B,D1)==fresh(A,D1): ${reverseStaleEqualsFresh}`);

  const report = `# RealAuction (realforeclose.com) date-pinning probe — LANE B5

- **Date:** ${new Date().toISOString()}
- **Host:** ${HOST} (direct egress, useProxy:false)
- **Question:** does the ColdFusion session pin the auction date at SPLASH/cookie-mint time, ignoring the XHR \`AuctionDate\` param? (Verified TRUE on *.realtaxdeed.com 2026-06-10 by the tax-deed lane.)
- **Probe dates:** D1=${D1}, D2=${D2} (from auction calendar; ${future.length} future sale days visible)

## Method
1. Jar A minted fresh at \`PREVIEW&AuctionDate=${D1}\` splash.
2. XHR \`AREA=W&AuctionDate=${D1}\` with jar A -> baseline D1 case set.
3. XHR \`AREA=W&AuctionDate=${D2}\` with jar A -> **stale-jar D2** case set.
4. Jar B minted fresh at \`PREVIEW&AuctionDate=${D2}\` splash.
5. XHR \`AREA=W&AuctionDate=${D2}\` with jar B -> **fresh-jar D2** case set.
6. XHR \`AREA=W&AuctionDate=${D1}\` with jar B -> reverse-direction stale check.

## Evidence (AREA=W, sorted case numbers)
| fetch | jar minted at | XHR AuctionDate | HTTP | retHTML bytes | n | cases |
|---|---|---|---|---|---|---|
| A_D1 (baseline) | ${D1} | ${D1} | ${A_D1.httpStatus} | ${A_D1.retHTMLBytes} | ${A_D1.cases.length} | ${A_D1.cases.join(", ") || "(empty)"} |
| A_D2 (STALE) | ${D1} | ${D2} | ${A_D2.httpStatus} | ${A_D2.retHTMLBytes} | ${A_D2.cases.length} | ${A_D2.cases.join(", ") || "(empty)"} |
| B_D2 (fresh) | ${D2} | ${D2} | ${B_D2.httpStatus} | ${B_D2.retHTMLBytes} | ${B_D2.cases.length} | ${B_D2.cases.join(", ") || "(empty)"} |
| B_D1 (STALE, reverse) | ${D2} | ${D1} | ${B_D1.httpStatus} | ${B_D1.retHTMLBytes} | ${B_D1.cases.length} | ${B_D1.cases.join(", ") || "(empty)"} |

## Comparisons
- forward: stale-jar D2 == splash-date (D1) rows: **${staleEqualsSplash}** ; stale-jar D2 == fresh-jar D2 rows: **${staleEqualsFresh}**
- reverse: stale-jar D1 == splash-date (D2) rows: **${reverseStaleEqualsSplash}** ; stale-jar D1 == fresh-jar D1 rows: **${reverseStaleEqualsFresh}**
- D1 vs D2 calendars actually differ: **${calendarsDiffer}**

## VERDICT
**${verdict}**

## Implication for lib/scrapers/vendors/realauction-playwright.ts
The production foreclosure scraper caches cookies per \`(subdomain, track-root)\` for 25 min ACROSS date iterations (the dispatch adapter iterates ~14 weekdays per county). If CONFIRMED above, every date after the first within a county's 25-min cookie window returned the FIRST date's rows, and \`persistAsForeclosure\` stamped those rows with the WRONG \`auctionDate\` (the iterated date, threaded from the request param). Fix: mint cookies fresh per (county, date) — the same posture realtaxdeed.ts ships with.
`;
  mkdirSync(join(process.cwd(), ".gstack", "qa-reports"), { recursive: true });
  writeFileSync(REPORT_PATH, report, "utf8");
  console.log(`\nReport written to ${REPORT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
