/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 90_000 });
  try {
    const page = await sess.newPage();

    await page.goto("https://or.duvalclerk.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.goto("https://or.duvalclerk.com/Support", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await page.goto("https://or.duvalclerk.com/search/SearchTypeRecordDate");
    await page.click("#btnButton").catch(() => {});
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });
    await page.waitForTimeout(1500);

    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", "5/22/2026");
    await page.waitForTimeout(500);

    const respP = page.waitForResponse((r) => /\/Search\/(PartialGrid|HasResults)/i.test(r.url()), { timeout: 60_000 }).catch(() => null);
    await page.click("#btnSearch");
    await respP;
    await page.waitForTimeout(4000);
    await page.waitForSelector("#RsltsGrid tbody tr, .gridDiv tr", { timeout: 10_000 }).catch(() => {});

    // What does the pager bar say?
    const pagerState = await page.evaluate(() => {
      const pager = document.querySelector(".k-pager-info, .k-pager-numbers, .k-pager-input")?.textContent ?? "";
      const select = document.querySelector(".k-pager-sizes select") as HTMLSelectElement | null;
      const sizeOptions = select ? Array.from(select.options).map((o) => o.value) : [];
      const currentSize = select?.value;
      const allBars = Array.from(document.querySelectorAll("[class*='pager']")).map((e) => ({
        cls: e.className.slice(0, 80),
        text: (e.textContent ?? "").slice(0, 100),
      })).slice(0, 8);
      // Also find total count somewhere on page
      const allText = document.body.innerText;
      const ofMatches = allText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/g);
      return { pager, currentSize, sizeOptions, allBars, ofMatches };
    });
    console.log("Pager bar text:", pagerState.pager);
    console.log("Page-size select value:", pagerState.currentSize);
    console.log("Page-size options:", pagerState.sizeOptions);
    console.log("'of' matches:", pagerState.ofMatches);
    console.log("All pager-class elements:");
    pagerState.allBars.forEach((b, i) => console.log(`  [${i}] class="${b.cls}" text="${b.text}"`));

    // Count actual rows
    const rowCount = await page.evaluate(() => document.querySelectorAll("#RsltsGrid tbody tr, .k-grid-content tbody tr").length);
    console.log("Visible row count:", rowCount);

    // Try increasing page size
    console.log("\nTrying to bump page size to 500…");
    const result = await page.selectOption(".k-pager-sizes select", "500").catch((e) => `FAIL: ${e.message}`);
    console.log("selectOption result:", result);
    await page.waitForTimeout(5000);
    const rowCount2 = await page.evaluate(() => document.querySelectorAll("#RsltsGrid tbody tr, .k-grid-content tbody tr").length);
    console.log("Row count after bump:", rowCount2);
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
