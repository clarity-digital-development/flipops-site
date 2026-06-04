/**
 * Probe RealAuction cookie-authenticated XHR contract.
 *
 * Goal: empirically validate the GET /index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD
 * endpoint identified in scripts/probe-artifacts/realauction-dom-analysis-2026-06-03.md.
 *
 * Flow per county:
 *   1. PlaywrightSession (stealth-chromium, useProxy:true) -> splash URL
 *   2. Capture session cookies (cfid, AWSALB, etc.) via session.cookies()
 *   3. Close session
 *   4. politeFetch -> XHR endpoint for AREA = W, R, C with Cookie header
 *   5. Decode the 12 macros (@A..@L) longest-first
 *   6. cheerio parse, count div[id^='AITEM_']
 *   7. Save raw envelope JSON + decoded HTML to scripts/probe-artifacts/
 *
 * Usage:
 *   PROXY_URL='...' npx tsx scripts/probe-realauction-xhr.ts            # hillsborough
 *   PROXY_URL='...' npx tsx scripts/probe-realauction-xhr.ts pasco      # pasco
 */

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import { politeFetch } from "../lib/scrapers/base/http-client";

interface CookieRecord {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface XhrEnvelope {
  retHTML?: string;
  rlist?: string;
  [k: string]: unknown;
}

interface AreaResult {
  area: "W" | "R" | "C";
  httpStatus: number;
  retHTMLBytes: number;
  aitemCount: number;
  sampleCases: Array<{ aid: string; caseNumber: string; apn: string }>;
  bodyFirst200: string;
}

const COUNTIES: Record<string, { subdomain: string; fips: string; name: string }> = {
  hillsborough: { subdomain: "hillsborough", fips: "12057", name: "Hillsborough" },
  pasco:        { subdomain: "pasco",        fips: "12101", name: "Pasco" },
};

// Macros must be applied longest-first to avoid partial collisions (e.g. @L
// is 39 chars and the longest; @A and @C are 13 and 7 chars but both start
// the same prefix `<div class="`). Sort by replacement-length DESC.
const MACROS: Array<[string, string]> = [
  ["@L", "/index.cfm?zaction=auction&zmethod=details&AID="], // 47
  ["@A", '<div class="'],                                    // 12
  ["@J", 'p_back="NextCheck='],                              // 18
  ["@K", 'style="Display:none"'],                            // 20
  ["@H", "<tr><td "],                                        // 8
  ["@G", "</td></tr>"],                                      // 10
  ["@F", "</td><td"],                                        // 8
  ["@C", 'class="'],                                         // 7
  ["@B", "</div>"],                                          // 6
  ["@D", "<div>"],                                           // 5
  ["@E", "AUCTION"],                                         // 7
  ["@I", "table"],                                           // 5
].sort((a, b) => b[1].length - a[1].length);

function decodeMacros(s: string): string {
  let out = s;
  for (const [token, replacement] of MACROS) {
    out = out.split(token).join(replacement);
  }
  return out;
}

function buildCookieHeader(cookies: CookieRecord[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Parse a Set-Cookie response header into our CookieRecord list.
 *
 * Set-Cookie may arrive as a single string with multiple cookies joined by
 * comma — but commas also legally appear inside Expires=... dates. Split on
 * `, ` ONLY when followed by `<name>=` (a fresh cookie start).
 */
function parseSetCookieHeader(raw: string | null): CookieRecord[] {
  if (!raw) return [];
  const parts = raw.split(/,\s*(?=[A-Za-z0-9_\-]+=)/);
  const out: CookieRecord[] = [];
  for (const part of parts) {
    const [head] = part.split(";");
    const eq = head.indexOf("=");
    if (eq <= 0) continue;
    const name = head.slice(0, eq).trim();
    const value = head.slice(eq + 1).trim();
    if (!name) continue;
    out.push({ name, value });
  }
  return out;
}

/**
 * Capture session cookies via a direct fetch of the splash URL. Simpler and
 * far more reliable than driving Playwright through the proxy — the splash
 * page does NOT require JS to issue Set-Cookie headers (verified: cfid,
 * cftoken, AWSALB, AWSALBCORS, CF_CLIENT_* all come straight from the
 * response of a no-cookie GET).
 *
 * Toggle PROBE_USE_PROXY=false to bypass the proxy (DataImpulse IPs are
 * currently 403'd by RealAuction's WAF — see probe verdict).
 */
async function captureCookies(splashUrl: string): Promise<{ cookies: CookieRecord[]; cookieHeader: string; pageTitle: string; pageStatus: number | null; bodySnippet: string }> {
  const useProxy = process.env.PROBE_USE_PROXY !== "false";
  const res = await politeFetch(splashUrl, {
    useProxy,
    rotateFingerprint: true,
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const setCookie = res.headers.get("set-cookie");
  const cookies = parseSetCookieHeader(setCookie);
  const body = await res.text();
  const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : "";
  const bodySnippet = body.slice(0, 200);
  return {
    cookies,
    cookieHeader: buildCookieHeader(cookies),
    pageTitle,
    pageStatus: res.status,
    bodySnippet,
  };
}

async function probeArea(args: {
  subdomain: string;
  area: "W" | "R" | "C";
  auctionDate: string;          // MM/DD/YYYY
  cookieHeader: string;
  splashUrl: string;
}): Promise<{ result: AreaResult; envelope: XhrEnvelope; decodedHtml: string }> {
  const xhrUrl = `https://${args.subdomain}.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=${args.area}&AuctionDate=${encodeURIComponent(args.auctionDate)}`;
  const res = await politeFetch(xhrUrl, {
    useProxy: process.env.PROBE_USE_PROXY !== "false",
    rotateFingerprint: true,
    headers: {
      "Cookie": args.cookieHeader,
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json,text/javascript,*/*;q=0.01",
      "Referer": args.splashUrl,
    },
  });

  const body = await res.text();
  let envelope: XhrEnvelope = {};
  try {
    envelope = JSON.parse(body);
  } catch {
    envelope = { retHTML: "", rlist: "", _parseError: true, _rawBody: body.slice(0, 500) };
  }

  const retHTML = typeof envelope.retHTML === "string" ? envelope.retHTML : "";
  const decoded = decodeMacros(retHTML);

  const $ = cheerio.load(decoded);
  const items = $("div[id^='AITEM_']");
  const aitemCount = items.length;

  const sampleCases: AreaResult["sampleCases"] = [];
  items.slice(0, 3).each((_, el) => {
    const $el = $(el);
    const aid = $el.attr("aid") ?? "";
    let caseNumber = "";
    let apn = "";
    $el.find("table.ad_tab > tbody > tr").each((__, tr) => {
      const $tr = $(tr);
      const label = $tr.find("td.AD_LBL").first().text().trim().replace(/:$/, "");
      const $data = $tr.find("td.AD_DTA").first();
      const linkText = $data.find("a").first().text().trim();
      const value = linkText || $data.text().trim();
      if (label === "Case #") caseNumber = value;
      if (label === "Parcel ID") apn = value;
    });
    sampleCases.push({ aid, caseNumber, apn });
  });

  return {
    result: {
      area: args.area,
      httpStatus: res.status,
      retHTMLBytes: retHTML.length,
      aitemCount,
      sampleCases,
      bodyFirst200: body.slice(0, 200),
    },
    envelope,
    decodedHtml: decoded,
  };
}

async function main() {
  const countyKey = (process.argv[2] ?? "hillsborough").toLowerCase();
  const county = COUNTIES[countyKey];
  if (!county) {
    console.error(`Unknown county: ${countyKey}. Known: ${Object.keys(COUNTIES).join(", ")}`);
    process.exit(1);
  }
  // 2026-06-04 (today) or 2026-06-05 — try 06/05 first as 06/04 may be empty calendar.
  const auctionDate = process.argv[3] ?? "06/05/2026";
  const dateTag = auctionDate.replace(/\//g, "-");

  const splashUrl = `https://${county.subdomain}.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW`;
  const artifactDir = path.resolve(__dirname, "probe-artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });

  console.log(`[probe] county=${county.name} fips=${county.fips} date=${auctionDate}`);
  console.log(`[probe] splash: ${splashUrl}`);

  const t0 = Date.now();
  const { cookies, cookieHeader, pageTitle, pageStatus, bodySnippet } = await captureCookies(splashUrl);
  console.log(`[probe] splash navigation: status=${pageStatus} title="${pageTitle}" took=${Date.now() - t0}ms`);
  console.log(`[probe] body snippet: ${JSON.stringify(bodySnippet)}`);
  console.log(`[probe] captured ${cookies.length} cookies: ${cookies.map((c) => `${c.name}@${c.domain ?? "?"}`).join(", ")}`);
  console.log(`[probe] cookie header (${cookieHeader.length} chars): ${cookieHeader.slice(0, 160)}${cookieHeader.length > 160 ? "..." : ""}`);

  const artifactPathsCreated: string[] = [];
  const results: Record<string, AreaResult> = {};

  for (const area of ["W", "R", "C"] as const) {
    console.log(`[probe] --- AREA=${area} ---`);
    try {
      const { result, envelope, decodedHtml } = await probeArea({
        subdomain: county.subdomain,
        area,
        auctionDate,
        cookieHeader,
        splashUrl,
      });
      results[`AREA_${area}`] = result;
      console.log(`[probe] status=${result.httpStatus} retHTMLBytes=${result.retHTMLBytes} aitemCount=${result.aitemCount}`);
      console.log(`[probe] body[0:200]= ${result.bodyFirst200}`);

      const jsonPath = path.join(artifactDir, `realforeclose-xhr-${countyKey}-AREA-${area}-${dateTag}.json`);
      const htmlPath = path.join(artifactDir, `realforeclose-xhr-${countyKey}-AREA-${area}-${dateTag}.html`);
      fs.writeFileSync(jsonPath, JSON.stringify(envelope, null, 2), "utf8");
      fs.writeFileSync(htmlPath, decodedHtml, "utf8");
      artifactPathsCreated.push(jsonPath, htmlPath);

      if (result.sampleCases.length > 0) {
        console.log(`[probe] sample cases:`);
        for (const s of result.sampleCases) {
          console.log(`  aid=${s.aid} case=${s.caseNumber} apn=${s.apn}`);
        }
      }
    } catch (err) {
      console.error(`[probe] AREA=${area} FAILED: ${(err as Error).message}`);
      results[`AREA_${area}`] = {
        area,
        httpStatus: 0,
        retHTMLBytes: 0,
        aitemCount: 0,
        sampleCases: [],
        bodyFirst200: `ERROR: ${(err as Error).message}`,
      };
    }
  }

  const summary = {
    county: county.name,
    fips: county.fips,
    auctionDate,
    cookiesCaptured: cookies.map((c) => c.name),
    AREA_W: results.AREA_W,
    AREA_R: results.AREA_R,
    AREA_C: results.AREA_C,
    artifactPathsCreated,
  };
  console.log(`\n[probe] SUMMARY:\n${JSON.stringify(summary, null, 2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
