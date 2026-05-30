/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 90_000 });
  try {
    const page = await sess.newPage();

    // Warm session
    await page.goto("https://or.duvalclerk.com/");
    await page.waitForTimeout(1500);
    await page.goto("https://or.duvalclerk.com/Support");
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

    // Try to find all next-page selectors
    const candidates = [
      "a.k-pager-nav[title='Go to the next page']",
      "a.k-pager-nav[aria-label='Go to the next page']",
      ".k-pager-nav[title*='next']",
      "[title='Go to the next page']",
      "[aria-label='Go to the next page']",
      ".k-i-arrow-end-right",
      ".k-i-arrow-60-right",
      ".k-i-arrow-e",
    ];
    console.log("Testing next-page selectors:");
    for (const sel of candidates) {
      const exists = await page.$(sel).then((e) => !!e).catch(() => false);
      const count = await page.$$(sel).then((arr) => arr.length).catch(() => 0);
      console.log(`  ${exists ? "✓" : "✗"} ${sel.padEnd(60)} (count=${count})`);
    }

    // Dump first 10 .k-pager-nav elements with full attributes
    const pagerLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".k-pager-nav, .k-link"))
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          title: e.getAttribute("title"),
          ariaLabel: e.getAttribute("aria-label"),
          text: (e.textContent ?? "").slice(0, 30),
        }))
        .slice(0, 20)
    );
    console.log("\nFirst 20 .k-pager-nav / .k-link elements:");
    pagerLinks.forEach((l, i) => console.log(`  [${i}] ${l.tag} cls="${l.cls}" title="${l.title}" aria="${l.ariaLabel}" text="${l.text}"`));

    // Find a NON-disabled one and click it
    console.log("\nTrying to click first non-disabled pager-nav…");
    const clickResult = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".k-pager-nav"));
      for (const l of links) {
        if (!l.classList.contains("k-disabled") && !l.classList.contains("k-state-disabled") &&
            !l.classList.contains("k-pager-first") && !l.classList.contains("k-pager-last")) {
          (l as HTMLElement).click();
          return { clicked: l.className, title: l.getAttribute("title"), ariaLabel: l.getAttribute("aria-label") };
        }
      }
      return null;
    });
    console.log("Click target:", clickResult);
    await page.waitForTimeout(5000);

    // Did the page change?
    const newPagerInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const m = text.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/);
      return m?.[0] ?? "(no match)";
    });
    console.log("New pager info:", newPagerInfo);

    // Sample current visible rows
    const newRowSample = await page.evaluate(() => {
      const rows = document.querySelectorAll("#RsltsGrid tbody tr, .k-grid-content tbody tr");
      return Array.from(rows).slice(0, 3).map((r) => (r.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100));
    });
    console.log("First 3 rows on this 'new' page:");
    newRowSample.forEach((s, i) => console.log(`  [${i}] ${s}`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
