/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { readFileSync } from "node:fs";

async function main() {
  const creds = JSON.parse(readFileSync(".lienhub-credentials.json", "utf8"));

  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    // Restore authenticated cookies — skips re-login.
    if (creds.cookies) {
      await sess.restoreCookies(JSON.stringify(creds.cookies));
      console.log(`Restored ${creds.cookies.length} cookies`);
    }
    const page = await sess.newPage();

    // Inspect Duval county page in detail
    await page.goto("https://lienhub.com/county/duval", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("Duval URL:", page.url(), "title:", await page.title());

    // All links + text — find the data-accessible features
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && l.href && !/^javascript:/.test(l.href))
    );
    console.log("\nLinks on Duval county page:");
    links.slice(0, 30).forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

    // Try main data destinations
    const destinations = [
      "https://lienhub.com/county/duval/auction",
      "https://lienhub.com/county/duval/portfolio",
      "https://lienhub.com/county/duval/county-held",
      "https://lienhub.com/county/duval/cert-sale",
      "https://lienhub.com/county/duval/delinquent",
      "https://lienhub.com/county/duval/lien-list",
      "https://lienhub.com/county/duval/properties",
    ];
    console.log("\nProbing destination URLs:");
    for (const url of destinations) {
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(800);
        const t = await page.title();
        const u = page.url();
        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        const hasData = await page.evaluate(() => /certificate|parcel|owner|amount|\$\d/i.test(document.body.innerText));
        console.log(`  ${url} → ${u} [${r?.status() ?? "?"}] title="${t.slice(0, 40)}" body=${bodyLen}b hasData=${hasData}`);
      } catch (e) {
        console.log(`  ${url} → ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
