/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { readFileSync } from "node:fs";

// Hunt for gaps in LienHub's auth model:
//  1. Capture all network requests during a logged-in county-page visit
//  2. Probe each as a direct fetch — many SaaS apps only check auth at
//     page-render time, not on the actual data API
//  3. Try sister sites (DeedAuction, etc) under the same Grant Street umbrella
//  4. Try mobile / embed / iframe URL patterns

async function main() {
  const creds = JSON.parse(readFileSync(".lienhub-credentials.json", "utf8"));
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    if (creds.cookies) await sess.restoreCookies(JSON.stringify(creds.cookies));
    const page = await sess.newPage();

    // 1) Capture every network request to a Grant Street / LienHub domain
    const captured: { method: string; url: string; status: number; ctype: string; size: number }[] = [];
    page.on("response", async (resp) => {
      const u = resp.url();
      if (!/lienhub\.com|grantstreet|govhub|deedauction|taxsys/i.test(u)) return;
      try {
        const headers = resp.headers();
        const size = parseInt(headers["content-length"] ?? "0", 10) || 0;
        captured.push({
          method: resp.request().method(),
          url: u,
          status: resp.status(),
          ctype: headers["content-type"] ?? "",
          size,
        });
      } catch { /* tolerate */ }
    });

    // Walk through several county pages logged-in to trigger AJAX
    console.log("=== Walking authed pages to capture network calls ===");
    for (const path of [
      "/",
      "/county/duval",
      "/county/duval/auction",
      "/county/duval/county-held",
      "/user/profile",
      "/cert-sale-schedules",
    ]) {
      try {
        await page.goto(`https://lienhub.com${path}`, { waitUntil: "domcontentloaded", timeout: 25_000 });
        await page.waitForTimeout(2500);
      } catch (e) {
        console.log(`  goto ${path} → ${(e as Error).message.split("\n")[0]}`);
      }
    }

    // Filter to data-shaped responses (json, xml, > 200b) likely carrying real data
    const dataResponses = captured.filter((c) =>
      c.status === 200 && (/json|xml|csv/i.test(c.ctype) || (c.size > 1000 && !/image|font/i.test(c.ctype)))
    );
    const uniqByUrl = Array.from(new Map(dataResponses.map((c) => [c.url, c])).values());
    console.log(`\nCaptured ${captured.length} responses total; ${uniqByUrl.length} unique data-shaped:`);
    uniqByUrl.forEach((c) => console.log(`  ${c.method.padEnd(4)} ${c.status} ${c.ctype.padEnd(35)} ${c.size}b  ${c.url}`));

    // 2) Try Grant Street sister sites — same SSO might give us data
    console.log("\n=== Grant Street sister sites ===");
    for (const url of [
      "https://deedauction.net/",
      "https://www.deedauction.net/",
      "https://florida.deedauction.net/",
      "https://www.govhub.com/",
      "https://landlist.com/",
      "https://www.grantstreet.com/products/lien-management",
    ]) {
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(1500);
        const title = await page.title();
        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        console.log(`  ${url} → ${page.url()} [${r?.status() ?? "?"}] "${title.slice(0, 50)}" ${bodyLen}b`);
      } catch (e) {
        console.log(`  ${url} → ${(e as Error).message.split("\n")[0]}`);
      }
    }

    // 3) Try LienHub direct API patterns
    console.log("\n=== Direct API patterns ===");
    for (const url of [
      "https://lienhub.com/api/county/duval/auction",
      "https://lienhub.com/api/county/duval",
      "https://lienhub.com/api/counties",
      "https://lienhub.com/county/duval/auction.json",
      "https://lienhub.com/county/duval/county-held.json",
      "https://lienhub.com/feed/auction/duval",
      "https://lienhub.com/data/county/duval",
    ]) {
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
        const t = await page.evaluate(() => document.body.innerText);
        console.log(`  ${url} → [${r?.status() ?? "?"}] ${t.length}b "${t.slice(0, 80)}"`);
      } catch (e) {
        console.log(`  ${url} → ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
