/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    const url = "https://duval.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW";
    console.log(`Fetching: ${url}\n`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    console.log("Title:", await page.title());

    // Dump the visible body text
    const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
    console.log("Body text length:", bodyText.length);
    console.log("\nBody text [0:2500]:");
    console.log(bodyText.slice(0, 2500));

    // Look for any AJAX URLs invoked
    const scripts = await page.evaluate(() =>
      Array.from(document.scripts).map((s) => ({ src: s.src, inline: s.textContent?.slice(0, 200) }))
    );
    console.log("\nScripts on page:", scripts.length);

    // Look for tables / data structures
    const tables = await page.evaluate(() => {
      const tbls = document.querySelectorAll("table");
      return Array.from(tbls).map((t, i) => ({
        idx: i,
        id: t.id,
        cls: t.className,
        rowCount: t.rows.length,
        firstRowText: t.rows[0]?.innerText?.slice(0, 100),
      }));
    });
    console.log("\nTables:", JSON.stringify(tables, null, 2));

    // Look for any data attributes hinting at AJAX endpoints
    const dataUrls = await page.evaluate(() => {
      const els = document.querySelectorAll("[data-url], [data-href], [data-action], [data-link]");
      return Array.from(els).map((e) => ({
        tag: e.tagName,
        dataUrl: e.getAttribute("data-url") || e.getAttribute("data-href") || e.getAttribute("data-action") || e.getAttribute("data-link"),
      }));
    });
    console.log("\nData-URL attributes:", dataUrls.slice(0, 10));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
