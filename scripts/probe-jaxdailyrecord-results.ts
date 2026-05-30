/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import * as cheerio from "cheerio";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    // First visit search page to establish session
    await page.goto("https://legals.jaxdailyrecord.com/re_tax/retax_search.php", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Submit with all-empty criteria → should return ALL delinquent properties
    const searchUrl = "https://legals.jaxdailyrecord.com/re_tax/retax.php?mode=search&REnumber=&PropDesc=&Name=&incrementby=50&sort=SeqNo&submit=Search+RE";
    console.log("Hitting:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    console.log("URL:", page.url(), "title:", await page.title());
    const body = await page.evaluate(() => document.body.innerText);
    console.log("Body length:", body.length);

    // Look for total result count
    const ofMatches = body.match(/(\d+)[\s-]+(\d+)\s*of\s*(\d+)|total[\s:]+(\d+)|(\d{4,})\s*results?|(\d{4,})\s*records?|(\d{4,})\s*notices?/gi);
    console.log("Count patterns:", ofMatches);

    // Look at the first ~2500 chars
    console.log("\nBody[0:2500]:");
    console.log(body.slice(0, 2500));

    // Look for table structure
    const tables = await page.evaluate(() => {
      const tbls = document.querySelectorAll("table");
      return Array.from(tbls).map((t, i) => ({
        idx: i,
        id: t.id,
        cls: t.className.slice(0, 60),
        rowCount: t.rows.length,
        firstRowText: t.rows[0]?.innerText?.slice(0, 150),
        secondRowText: t.rows[1]?.innerText?.slice(0, 150),
      }));
    });
    console.log("\nTables:");
    console.log(JSON.stringify(tables, null, 2));

    // Pagination indicators
    const paginationLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 30), href: (a as HTMLAnchorElement).href }))
        .filter((l) => /next|prev|page|>|<|\d+/.test(l.text) && /retax/.test(l.href))
    );
    console.log("\nPagination links:");
    paginationLinks.slice(0, 10).forEach((l) => console.log(`  "${l.text}" → ${l.href.slice(0, 200)}`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
