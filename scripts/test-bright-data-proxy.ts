/* eslint-disable no-console */
import { politeFetch } from "@/lib/scrapers/base/http-client";

// ---------------------------------------------------------------------------
// Bright Data Web Unlocker — end-to-end verification through our own
// http-client. Confirms:
//   1. BRIGHT_DATA_PROXY_URL env wires through getProxyAgent()
//   2. Undici ProxyAgent's TLS posture works (strict proxy-TLS, MITM-relaxed
//      target-TLS) — neither rejects
//   3. -country-us in the username forces a US residential egress IP
//   4. The full chain works against (a) BD's own welcome page,
//      (b) a generic US-only test endpoint, (c) a real county clerk site
//
// Run: npx tsx -r dotenv/config scripts/test-bright-data-proxy.ts dotenv_config_path=.env.local
// ---------------------------------------------------------------------------

async function test(name: string, url: string, opts?: Parameters<typeof politeFetch>[1]) {
  console.log(`\n▶ ${name}\n  ${url}`);
  const start = Date.now();
  try {
    const res = await politeFetch(url, {
      useProxy: true,
      rotateFingerprint: true,
      timeoutMs: 60_000,
      maxRetries: 1,
      ...opts,
    });
    const elapsed = Date.now() - start;
    const text = await res.text();
    console.log(`  ✓ HTTP ${res.status} in ${elapsed}ms — ${text.length} bytes`);
    if (text.length < 600) console.log("  body:\n" + text.split(/\n/).map(l => "    " + l).join("\n"));
    else console.log("  body[0:200]: " + text.slice(0, 200).replace(/\s+/g, " "));
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    console.log(`  ✗ ${(err as Error).message}`);
    return { ok: false, status: 0, body: "" };
  }
}

async function main() {
  console.log("=== Bright Data Web Unlocker — end-to-end through http-client.ts ===");
  console.log("BRIGHT_DATA_PROXY_URL configured:", !!process.env.BRIGHT_DATA_PROXY_URL);

  // 1. BD's own welcome page — confirms auth chain
  await test("BD welcome page (auth + IP info)", "https://geo.brdtest.com/welcome.txt");

  // 2. US-only check: ipinfo.io echo
  const ipResult = await test("ipinfo.io (egress IP detection)", "https://ipinfo.io/json");
  if (ipResult.ok && ipResult.body) {
    try {
      const j = JSON.parse(ipResult.body);
      console.log(`  → egress: ${j.ip} / ${j.city}, ${j.region}, ${j.country} (${j.org})`);
      if (j.country !== "US") console.log("  ⚠️ Expected US country, got:", j.country);
    } catch { /* not json */ }
  }

  // 3. A real county clerk landing page (Duval — known target)
  await test(
    "Duval Clerk landing (real yellow-zone target)",
    "https://www.duvalclerk.com/",
  );

  // 4. Compare: same request WITHOUT proxy (should still work for non-blocked target)
  console.log("\n▶ Same Duval Clerk landing WITHOUT proxy (control)\n");
  const noProxy = await politeFetch("https://www.duvalclerk.com/", {
    useProxy: false,
    rotateFingerprint: false,
    timeoutMs: 30_000,
    maxRetries: 1,
  });
  console.log(`  HTTP ${noProxy.status} (control fetch direct from this host)`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exit(1);
});
