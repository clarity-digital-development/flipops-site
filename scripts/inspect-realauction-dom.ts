/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// inspect-realauction-dom.ts — re-probe a live realforeclose.com county auction
// page and capture the DOM around the data landmarks ("Auction Starts", APN,
// Final Judgment Amount, Plaintiff Max Bid).
//
// Probe shape (verified 2026-06-03):
//   1. realforeclose.com sites are CFML-driven. The PREVIEW landing URL
//      `/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AuctionDate=mm/dd/yyyy`
//      ships a SCAFFOLD only — the auction rows are loaded via XHR into
//      `<div id="Area_W" class="Auct_Area" arid="W">` (waiting) and
//      `<div id="Area_R" arid="R">` (running) AFTER page load.
//   2. The XHR endpoint is
//      `/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=W&AuctionDate=...`
//      It REQUIRES a session cookie obtained from the splash page (cfid +
//      AWSALB), otherwise it returns the empty-body sentinel
//      `{"retHTML":"", "rlist":""}` (the 201-byte response seen in the
//      first failed probes).
//   3. The retHTML payload is COMPRESSED via single-letter macros
//      (@A@→`<div class="`, @B@→`</div>`, @C@→`class="`, @D@→`<div>`,
//      @E@→`AUCTION`, @F@→`</td><td`, @G@→`</td></tr>`, @H@→`<tr><td `,
//      @I@→`table`, @J→p_back="NextCheck=`, @K→style="Display:none"`,
//      @L→`/index.cfm?zaction=auction&zmethod=details&AID=`). Map taken
//      verbatim from /CORE/System/JS/auction.js (lines 8-20).
//
// Output:
//   scripts/probe-artifacts/realforeclose-<county>-<date>.html   (decoded HTML)
//   scripts/probe-artifacts/realforeclose-<county>-<date>-raw.json (raw XHR)
// ---------------------------------------------------------------------------
import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";
import { politeFetch } from "@/lib/scrapers/base/http-client";

const COUNTY = process.env.COUNTY_SUBDOMAIN ?? "duval";
const AUCTION_DATE = process.env.AUCTION_DATE ?? "06/04/2026"; // tomorrow has data per the splash "Next Auction" link
const TODAY = "2026-06-03";
const OUT_DIR = path.join(process.cwd(), "scripts", "probe-artifacts");
const HTML_PATH = path.join(OUT_DIR, `realforeclose-${COUNTY}-${TODAY}.html`);
const RAW_PATH = path.join(OUT_DIR, `realforeclose-${COUNTY}-${TODAY}-raw.json`);

const SPLASH_URL = `https://${COUNTY}.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AuctionDate=${AUCTION_DATE}`;
const ENC_DATE = encodeURIComponent(AUCTION_DATE);

// Replicates the decode in /CORE/System/JS/auction.js. Order matters because
// `@A`/`@B`/`@C` etc. are prefixes of one another in JS replace order — but
// here we use a single pass over the raw string with a non-overlapping map.
function decodeRetHTML(rH: string): string {
  return rH
    .replace(/@A/g, '<div class="')
    .replace(/@B/g, "</div>")
    .replace(/@C/g, 'class="')
    .replace(/@D/g, "<div>")
    .replace(/@E/g, "AUCTION")
    .replace(/@F/g, "</td><td")
    .replace(/@G/g, "</td></tr>")
    .replace(/@H/g, "<tr><td ")
    .replace(/@I/g, "table")
    .replace(/@J/g, 'p_back="NextCheck=')
    .replace(/@K/g, 'style="Display:none"')
    .replace(/@L/g, "/index.cfm?zaction=auction&zmethod=details&AID=");
}

const LANDMARKS = [
  "Auction Starts",
  "Parcel ID",
  "Final Judgment Amount",
  "Plaintiff Max Bid",
  "Case #",
  "Auction Type",
  "Property Appraiser", // Hillsborough bug surface — confirms when parser grabs a label cell
];

function describeNode($: cheerio.CheerioAPI, el: cheerio.AnyNode): string {
  if (el.type === "text") return `#text "${($(el).text() || "").trim().slice(0, 60)}"`;
  if (el.type !== "tag") return `(${el.type})`;
  const tag = el.tagName;
  const id = el.attribs?.id ? `#${el.attribs.id}` : "";
  const cls = el.attribs?.class ? `.${el.attribs.class.split(/\s+/).join(".")}` : "";
  return `<${tag}${id}${cls}>`;
}

function ancestorChain($: cheerio.CheerioAPI, el: cheerio.AnyNode): string {
  const chain: string[] = [];
  let cur: cheerio.AnyNode | null = el;
  while (cur && (cur as { parent?: cheerio.AnyNode }).parent) {
    chain.unshift(describeNode($, cur));
    cur = (cur as { parent?: cheerio.AnyNode }).parent ?? null;
    if (chain.length > 8) break;
  }
  return chain.join(" > ");
}

function snapshotAround($: cheerio.CheerioAPI, needle: string, contextChars = 600): string[] {
  const out: string[] = [];
  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    const ownText = $(el).clone().children().remove().end().text();
    if (!ownText) return;
    if (!ownText.toLowerCase().includes(needle.toLowerCase())) return;
    const chain = ancestorChain($, el);
    const html = $.html(el) ?? "";
    const snippet = html.length > contextChars ? html.slice(0, contextChars) + "...[truncated]" : html;
    out.push(`\nMATCH "${needle}"\n  PATH: ${chain}\n  OWN_TEXT: ${ownText.trim().slice(0, 200)}\n  HTML: ${snippet.replace(/\s+/g, " ").trim()}`);
  });
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[probe] county=${COUNTY} date=${AUCTION_DATE}`);
  console.log(`[probe] proxy: ${process.env.PROXY_URL ? "YES (" + process.env.PROXY_URL.split("@")[1] + ")" : "NO"}`);
  const useProxy = !!process.env.PROXY_URL;

  // ----- Step 1: fetch splash to capture cfid + AWSALB cookies -----
  const t0 = Date.now();
  const splashRes = await politeFetch(SPLASH_URL, {
    useProxy,
    rotateFingerprint: true,
    timeoutMs: 45_000,
    headers: { accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" },
  });
  const splashSetCookies = splashRes.headers.getSetCookie?.() ?? [];
  // Build a Cookie header from Set-Cookie. We only need name=value pairs.
  const cookiePairs: string[] = [];
  for (const sc of splashSetCookies) {
    const m = sc.match(/^([^=]+)=([^;]+)/);
    if (m) cookiePairs.push(`${m[1]}=${m[2]}`);
  }
  const cookieHeader = cookiePairs.join("; ");
  console.log(`[probe] splash HTTP ${splashRes.status} in ${Date.now() - t0}ms — got ${cookiePairs.length} cookies (${cookiePairs.map((c) => c.split("=")[0]).join(",")})`);
  await splashRes.text(); // drain

  // ----- Step 2: fetch AREA=W (waiting) AJAX with cookies -----
  const xhrUrlW = `https://${COUNTY}.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=W&AuctionDate=${ENC_DATE}`;
  const t1 = Date.now();
  const xhrRes = await politeFetch(xhrUrlW, {
    useProxy,
    rotateFingerprint: true,
    timeoutMs: 45_000,
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
      referer: SPLASH_URL,
      cookie: cookieHeader,
    },
  });
  const xhrBody = await xhrRes.text();
  console.log(`[probe] AREA=W HTTP ${xhrRes.status} in ${Date.now() - t1}ms (body=${xhrBody.length} bytes)`);

  fs.writeFileSync(RAW_PATH, xhrBody, "utf8");
  console.log(`[probe] saved raw XHR -> ${RAW_PATH}`);

  // Parse the JSON envelope and decode retHTML
  // The body has padding whitespace before the JSON; trim.
  const jsonStart = xhrBody.indexOf("{");
  const jsonStr = jsonStart >= 0 ? xhrBody.slice(jsonStart) : xhrBody;
  let payload: { retHTML?: string; rlist?: string } = {};
  try {
    payload = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`[probe] JSON parse failed: ${(err as Error).message}`);
    console.error(`[probe] body sample:\n${xhrBody.slice(0, 400)}`);
    process.exit(2);
  }
  const decoded = decodeRetHTML(payload.retHTML ?? "");
  console.log(`[probe] rlist (auction IDs): ${payload.rlist}`);
  console.log(`[probe] decoded retHTML: ${decoded.length} bytes`);

  // ALSO need the "Auction Starts" header — that lives in the splash, not the
  // XHR. The AJAX response is JUST the .ad_tab rows. The "Auction Starts
  // mm/dd/yyyy hh:mm AM ET" string is rendered server-side into the splash
  // <div class="AuctionNav_Main"> + per-Area headers OR is derived from the
  // AuctionDate URL param. Verify by inspecting the splash.

  // Save the fully-rendered fixture: splash skeleton + injected XHR content.
  // Replace the empty Area_W placeholder div with the decoded HTML so the
  // saved fixture is a faithful single-page representation of what a browser
  // would render after JS executes.
  const splashHtml = await (await politeFetch(SPLASH_URL, {
    useProxy,
    rotateFingerprint: true,
    timeoutMs: 30_000,
    headers: { cookie: cookieHeader, accept: "text/html" },
  })).text();
  const injected = splashHtml.replace(
    /(<div\s+id="Area_W"[^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1${decoded}$3`,
  );
  fs.writeFileSync(HTML_PATH, injected, "utf8");
  console.log(`[probe] saved injected fixture -> ${HTML_PATH}`);

  // ----- Step 3: analyze landmarks against decoded retHTML -----
  const $ = cheerio.load(decoded);
  const adTabs = $("table.ad_tab");
  console.log(`[probe] table.ad_tab in decoded payload: ${adTabs.length}`);
  console.log(`[probe] AITEM containers: ${$("[id^=AITEM_]").length}`);

  for (const lm of LANDMARKS) {
    console.log(`\n================ Landmark: "${lm}" ================`);
    const hits = snapshotAround($, lm);
    if (!hits.length) { console.log("  (no matches)"); continue; }
    hits.slice(0, 2).forEach((h) => console.log(h));
    if (hits.length > 2) console.log(`  ...and ${hits.length - 2} more`);
  }

  console.log(`\n================ First .ad_tab full row dump ================`);
  const firstTab = adTabs.first();
  if (firstTab.length) {
    console.log(`Path: ${ancestorChain($, firstTab.get(0) as cheerio.AnyNode)}`);
    firstTab.find("tr").each((i, tr) => {
      const cells = $(tr).find("td").map((_, td) => {
        const cls = (td.attribs?.class ?? "").trim();
        const text = $(td).text().trim().replace(/\s+/g, " ").slice(0, 100);
        const links = $(td).find("a").map((_, a) => $(a).text().trim()).get();
        return `td.${cls || "(noclass)"} text="${text}"${links.length ? ` [a=${links.join("|")}]` : ""}`;
      }).get();
      console.log(`  row[${i}]: ${cells.join("  ||  ")}`);
    });
  }

  // ----- Step 4: look for "Auction Starts" in the splash (it's NOT in the XHR) -----
  console.log(`\n================ "Auction Starts" search in splash HTML ================`);
  const $$ = cheerio.load(splashHtml);
  const startHits = $$("*").filter((_, el) => {
    if (el.type !== "tag") return false;
    const t = $$(el).clone().children().remove().end().text();
    return /Auction Starts/i.test(t);
  });
  console.log(`[probe] "Auction Starts" hits in splash: ${startHits.length}`);
  startHits.slice(0, 3).each((_, el) => {
    const node = el as cheerio.AnyNode;
    console.log(`  PATH: ${ancestorChain($$, node)}`);
    console.log(`  TEXT: ${$$(el).text().trim().slice(0, 200)}`);
    console.log(`  HTML: ${($$.html(node) ?? "").slice(0, 400).replace(/\s+/g, " ")}`);
  });

  // ALSO check the BLHeaderDateDisplay (splash banner shows "Wednesday June 3, 2026")
  console.log(`\n[probe] BLHeaderDateDisplay text: "${$$(".BLHeaderDateDisplay").text().trim()}"`);
  console.log(`[probe] BLHeaderToday text: "${$$(".BLHeaderToday").text().trim()}"`);
  console.log(`[probe] Sub_Title sections in splash: ${$$(".Sub_Title").map((_, e) => $$(e).text().trim()).get().join(" | ")}`);
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
