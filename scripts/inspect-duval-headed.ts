/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// Headless probe that mirrors the duval-clerk flow but logs intermediate
// state to figure out where the grid actually lands.

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 90_000 });
  try {
    const page = await sess.newPage();
    page.on("console", (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
    page.on("response", (resp) => {
      const u = resp.url();
      if (/duvalclerk/.test(u) && resp.status() !== 200) console.log(`[net ${resp.status()}]`, u);
      else if (/Search|search/.test(u) && !/jpg|png|css|js$/.test(u)) console.log(`[net ${resp.status()}]`, u);
    });

    await page.goto("https://or.duvalclerk.com/search/SearchTypeRecordDate", { waitUntil: "domcontentloaded" });
    console.log("=== Landed on:", page.url());
    await page.click("#btnButton", { timeout: 10_000 }).catch(() => console.log("(no disclaimer button to click)"));
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });
    console.log("=== Search form ready");

    const target = "5/22/2026";
    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", target);
    console.log("=== Date filled to:", target);

    // Inspect input value
    const inputValue = await page.inputValue("#RecordDate");
    console.log("=== #RecordDate value (verified):", inputValue);

    // Click and watch network
    const respWait = page.waitForResponse((r) => /Search|search/.test(r.url()) && (r.status() === 200 || r.status() === 302), { timeout: 60_000 });
    await page.click("#btnSearch");
    console.log("=== btnSearch clicked, waiting for response...");
    try {
      const r = await respWait;
      console.log("=== first matching response:", r.status(), r.url());
    } catch {
      console.log("=== no matching response in 60s");
    }

    await page.waitForTimeout(5000);

    // Final state
    console.log("=== Final URL:", page.url());
    const gridState = await page.evaluate(() => {
      const rsltGrid = document.querySelector("#RsltsGrid");
      const tbody = document.querySelector("#RsltsGrid tbody");
      const rows = document.querySelectorAll("#RsltsGrid tbody tr");
      const gridDivs = document.querySelectorAll(".gridDiv, .k-grid-content, .searchGridDiv");
      const visibleErrors = document.body.innerText.match(/error|no record|0 record|please enter|invalid/gi);
      return {
        hasRsltsGrid: !!rsltGrid,
        hasTbody: !!tbody,
        rowCount: rows.length,
        gridDivCount: gridDivs.length,
        visibleErrors: visibleErrors?.slice(0, 5),
        bodyText: document.body.innerText.slice(0, 2000),
      };
    });
    console.log("\nGrid state:", JSON.stringify(gridState, null, 2));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
