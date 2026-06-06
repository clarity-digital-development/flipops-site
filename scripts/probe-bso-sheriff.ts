/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Probe — Broward Sheriff's Office (BSO) arrest/inmate roster
//
// URL:           https://apps.sheriff.org/arrestsearch
// County FIPS:   12011 (Broward)
// Refresh:       "Returns are updated every 15 minutes" (documented)
// Risk zone:     YELLOW per feedback_scraping_risk_policy.md
//                — county sheriff site, public records under Ch. 119
//                — but reCAPTCHA v2 gate + IIS session cookie
//
// Tech stack identified from the landing page:
//   ASP.NET MVC 5.2 + IIS 10 + AngularJS (`ng-controller="ArrestCtrl"`)
//   Search endpoint:  POST /ArrestSearch/ArrestSearchJ  (body: {fn, ln, d})
//   Update endpoint:  GET  /ArrestSearch/GetUpdateTime  (no captcha — open)
//   Detail page:      /ArrestSearch/InmateDetail/{JMS_NUMBER}
//   reCAPTCHA site:   6LcvhlsUAAAAAE7_uaspDMF4dE76Im_KXaGSKBAE  (v2, visual)
//
// Key constraint discovered:
//   The Angular controller `vm.submit()` requires AT LEAST 2 letters of
//   first OR last name AND a solved reCAPTCHA v2 token (`vm.f.d`). Server
//   returns the bare string `"captcha"` if `d` is missing/invalid.
//   There is NO "list everyone booked today" mode. Iteration strategy must
//   sweep alphabet pairs (or last-name single-letter scans) per refresh,
//   with each request consuming one captcha solve.
//
// Captcha-solve options (downstream — NOT in this probe):
//   - 2Captcha / Anti-Captcha API ($1-3 per 1000 v2 solves)
//   - Bright Data Web Unlocker has a captcha-bypass tier; un-confirmed for
//     this specific site
//
// Probe budget:  ≤ 5 requests total. Used in this script:
//   1. GET   /arrestsearch                 (landing + form HTML)
//   2. GET   /Scripts/pages/arrest/arrest.js (Angular controller reverse-engineer)
//   3. GET   /ArrestSearch/GetUpdateTime   (data-freshness signal endpoint)
//   4. POST  /ArrestSearch/ArrestSearchJ   (intentional no-captcha probe → "captcha")
//   (slot 5 reserved — NOT used to avoid pinging InmateDetail with a
//   random JMS_NUMBER, which would either 404 or surface a stranger's record)
//
// Anti-bot posture:  none observed at the HTTP layer (no Cloudflare/Akamai
// edge, no JS challenge, no rate-limit headers). The wall is purely
// reCAPTCHA-v2 in the application. Direct fetch returns IIS 200 with a
// vanilla User-Agent.
// ---------------------------------------------------------------------------

import { promises as fs } from "fs";
import path from "path";

const BASE = "https://apps.sheriff.org";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SLEEP_MIN_MS = 3_000;
const SLEEP_JITTER_MS = 2_000;

const OUT_DIR = path.join(process.cwd(), "scripts", "probe-output", "bso");

async function gentleSleep(): Promise<void> {
  await new Promise((r) => setTimeout(r, SLEEP_MIN_MS + Math.random() * SLEEP_JITTER_MS));
}

async function save(name: string, body: string): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, name), body, "utf8");
}

async function step1_landing(): Promise<void> {
  console.log("\n[1/4] GET /arrestsearch — landing page (Angular form + reCAPTCHA marker)");
  const r = await fetch(`${BASE}/arrestsearch`, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  console.log(`  status=${r.status}  server=${r.headers.get("server")}  set-cookie=${r.headers.get("set-cookie")?.slice(0, 60)}`);
  const html = await r.text();
  await save("01-landing.html", html);

  // Cheap parse — confirm the Angular markers we depend on.
  const hasNgController = /ng-controller="ArrestCtrl as vm"/.test(html);
  const hasRecaptcha = /g-recaptcha[^>]*data-sitekey="([^"]+)"/.exec(html);
  const hasInmateDetailLink = /\/ArrestSearch\/InmateDetail\/\{\{row\.JMS_NUMBER\}\}/.test(html);
  console.log(`  ng-controller=ArrestCtrl: ${hasNgController}`);
  console.log(`  reCAPTCHA sitekey:        ${hasRecaptcha?.[1] ?? "(none)"}`);
  console.log(`  InmateDetail link tmpl:   ${hasInmateDetailLink}`);
}

async function step2_arrestjs(): Promise<void> {
  console.log("\n[2/4] GET /Scripts/pages/arrest/arrest.js — Angular controller source");
  const r = await fetch(`${BASE}/Scripts/pages/arrest/arrest.js`, {
    headers: { "User-Agent": UA, Accept: "application/javascript" },
  });
  const js = await r.text();
  await save("02-arrest.js", js);
  const searchEndpoint = /\$http\.post\(['"](\/ArrestSearch\/[^'"]+)['"]/.exec(js)?.[1];
  const updateEndpoint = /\$http\.get\(['"](\/ArrestSearch\/[^'"]+)['"]/.exec(js)?.[1];
  const minLenRule = /vm\.f\.fn\.length\s*>\s*(\d+)|vm\.f\.ln\.length\s*>\s*(\d+)/.exec(js);
  console.log(`  POST search endpoint:  ${searchEndpoint}`);
  console.log(`  GET  updtime endpoint: ${updateEndpoint}`);
  console.log(`  min name-prefix rule:  fn|ln length > ${minLenRule?.[1] ?? minLenRule?.[2] ?? "?"}`);
}

async function step3_updatetime(): Promise<void> {
  console.log("\n[3/4] GET /ArrestSearch/GetUpdateTime — public freshness signal (no captcha)");
  const r = await fetch(`${BASE}/ArrestSearch/GetUpdateTime`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  const json = await r.text();
  await save("03-updtime.json", json);
  console.log(`  status=${r.status}  body=${json.slice(0, 200)}`);

  // Parse the ASP.NET Date(epoch) format
  const m = /\\\/Date\((\d+)\)\\\//.exec(json);
  if (m) {
    const dt = new Date(parseInt(m[1], 10));
    const ageMin = Math.round((Date.now() - dt.getTime()) / 60000);
    console.log(`  decoded updTime:       ${dt.toISOString()}  (age: ${ageMin} min)`);
  }
}

async function step4_search_no_captcha(): Promise<void> {
  console.log("\n[4/4] POST /ArrestSearch/ArrestSearchJ — intentional no-captcha probe");
  const r = await fetch(`${BASE}/ArrestSearch/ArrestSearchJ`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify({ ln: "Smith", fn: null, d: "" }),
  });
  const body = await r.text();
  await save("04-search-nocaptcha.txt", body);
  console.log(`  status=${r.status}  content-type=${r.headers.get("content-type")}  body=${body}`);
  console.log(`  → confirms server short-circuits on missing captcha token; emits bare string "captcha"`);
}

async function main(): Promise<void> {
  console.log("=== BSO arrest roster probe (≤5 requests, ~3-5s spacing) ===");
  await step1_landing();
  await gentleSleep();
  await step2_arrestjs();
  await gentleSleep();
  await step3_updatetime();
  await gentleSleep();
  await step4_search_no_captcha();
  console.log("\n=== Probe complete. Artifacts in scripts/probe-output/bso/ ===");
  console.log("Slot 5 intentionally unused — InmateDetail/{JMS} requires a real ID we shouldn't");
  console.log("guess at, and ArrestSearchJ with a real captcha needs a paid solver. Both are");
  console.log("Phase-2 (scraper-build) probes, not Phase-1 (recon) probes.");
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
