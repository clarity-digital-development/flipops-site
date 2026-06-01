/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// smoke-politefetch.ts — verify that lib/scrapers/base/http-client.ts
// picks up PROXY_URL (the new provider-agnostic env var) and that production
// scrapers using `useProxy: true` will route through DataImpulse correctly.
//
// Runs two probes through politeFetch + useProxy:true:
//   1. GET httpbin.org/ip — confirms the proxy is wired and reports the IP.
//   2. POST netapps.ocfl.net (the exact POST that BD's residential network
//      blocked with 402) — confirms the production-scraper code path.
//
// Run:
//   PROXY_URL=... npx tsx scripts/smoke-politefetch.ts
// ---------------------------------------------------------------------------

import { politeFetch } from "../lib/scrapers/base/http-client";

async function main() {
  console.log("PROXY_URL set:", !!process.env.PROXY_URL);
  console.log("BRIGHT_DATA_PROXY_URL set:", !!process.env.BRIGHT_DATA_PROXY_URL);

  // Probe 1: generic GET
  console.log("\n[1/2] GET httpbin.org/ip via politeFetch+useProxy");
  const r1 = await politeFetch("https://httpbin.org/ip", {
    useProxy: true,
    rateLimitMs: 100,
    timeoutMs: 15_000,
  });
  console.log("      HTTP", r1.status);
  if (r1.ok) {
    const body = (await r1.json()) as { origin: string };
    console.log("      Egress IP:", body.origin);
  } else {
    console.log("      Body:", (await r1.text()).slice(0, 200));
  }

  // Probe 2: production-scraper POST pattern
  console.log("\n[2/2] POST netapps.ocfl.net/BestJail/Home/getInmates/SMITH via politeFetch+useProxy");
  const r2 = await politeFetch("https://netapps.ocfl.net/BestJail/Home/getInmates/SMITH", {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: "id=",
    useProxy: true,
    rateLimitMs: 100,
    timeoutMs: 15_000,
  });
  console.log("      HTTP", r2.status);
  if (r2.ok) {
    const data = (await r2.json()) as Array<{ bookingNumber: string; inmateName: string }>;
    console.log("      Got", data.length, "inmate records via politeFetch.");
    if (data[0]) console.log("      Sample:", JSON.stringify(data[0]));
  } else {
    const bdCode = r2.headers.get("x-brd-err-code");
    const bdMsg = r2.headers.get("x-brd-err-msg");
    console.log("      BD err code:", bdCode);
    console.log("      BD err msg :", bdMsg);
    console.log("      Body:", (await r2.text()).slice(0, 200));
  }

  console.log("\nDone.");
  process.exit(r1.ok && r2.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
