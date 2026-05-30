/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { readFileSync } from "node:fs";

async function main() {
  const creds = JSON.parse(readFileSync(".lienhub-credentials.json", "utf8"));
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    if (creds.cookies) await sess.restoreCookies(JSON.stringify(creds.cookies));
    const page = await sess.newPage();

    // 1) Cert Sale Schedules (public from landing page nav)
    console.log("=== /cert-sale-schedules ===");
    await page.goto("https://lienhub.com/cert-sale-schedules", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("URL:", page.url(), "title:", await page.title());
    const csch = await page.evaluate(() => document.body.innerText);
    console.log("Body[0:2000]:");
    console.log(csch.slice(0, 2000));

    // 2) Look at all county-specific URLs by probing what each county exposes
    console.log("\n=== /county/duval/cert-sale ===");
    await page.goto("https://lienhub.com/county/duval/cert-sale", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("URL:", page.url(), "title:", await page.title());
    const csale = await page.evaluate(() => document.body.innerText);
    console.log("Body[0:1500]:");
    console.log(csale.slice(0, 1500));

    // 3) Look at links available on county page when logged in
    console.log("\n=== /county/duval (all links) ===");
    await page.goto("https://lienhub.com/county/duval", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const allLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 80), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && l.href && /duval/.test(l.href))
    );
    allLinks.forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

    // 4) Probe for public/non-bidder data endpoints
    console.log("\n=== Public-ish data endpoints ===");
    const publicPaths = [
      "https://lienhub.com/county/duval/auction/results",
      "https://lienhub.com/county/duval/auction/preview",
      "https://lienhub.com/county/duval/auction/list",
      "https://lienhub.com/county/duval/calendar",
      "https://lienhub.com/county/duval/schedule",
      "https://lienhub.com/county/duval/sale_results",
      "https://lienhub.com/county/duval/sales",
      "https://lienhub.com/cert-sales",
      "https://lienhub.com/cert_sales",
      "https://lienhub.com/auction/duval",
      "https://lienhub.com/help/cert-sale-schedules",
    ];
    for (const u of publicPaths) {
      const r = await page.goto(u, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
      await page.waitForTimeout(800);
      if (!r) { console.log(`  ${u} → ERROR`); continue; }
      const final = page.url();
      const title = await page.title();
      const text = await page.evaluate(() => document.body.innerText);
      const bodyLen = text.length;
      const hasParcel = /parcel|certificate\s*\#|amount\s*due/i.test(text);
      const hasDate = /\d{1,2}\/\d{1,2}\/\d{4}/.test(text);
      console.log(`  ${u}`);
      console.log(`    → ${final.replace("https://lienhub.com", "")} [${r.status()}] "${title.slice(0, 35)}" ${bodyLen}b parcel=${hasParcel} date=${hasDate}`);
    }

    // 5) Look at the "auction" tab in the sidebar (LienHub has a navigation sidebar after login)
    console.log("\n=== Sidebar nav links ===");
    const sidebarLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".sidebar a, nav a, .menu a, [class*='nav'] a"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 80), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text)
    );
    sidebarLinks.slice(0, 30).forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
