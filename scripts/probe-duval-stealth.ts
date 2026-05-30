/* eslint-disable no-console */
import { chromium, firefox } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Stealth plugin patches the obvious automation tells:
// navigator.webdriver = undefined, navigator.plugins length, etc.
chromium.use(StealthPlugin());
firefox.use(StealthPlugin());

// Try three configurations against Duval clerk:
//   A) Vanilla Playwright (control — known broken)
//   B) Stealth Chromium with BD residential proxy
//   C) Stealth Firefox with BD residential proxy
async function probe(label: string, engine: typeof chromium | typeof firefox, useProxy: boolean) {
  console.log(`\n=== ${label} ===`);
  const proxyUrl = useProxy ? process.env.BRIGHT_DATA_PROXY_URL : undefined;
  const launchOpts: Parameters<typeof engine.launch>[0] = {
    headless: true,
    proxy: proxyUrl ? (() => {
      const u = new URL(proxyUrl);
      return {
        server: `${u.protocol}//${u.host}`,
        username: u.username ? decodeURIComponent(u.username) : undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
      };
    })() : undefined,
  };
  const browser = await engine.launch(launchOpts);
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      ignoreHTTPSErrors: useProxy,
    });
    const page = await ctx.newPage();

    // Session warming — visit a couple other pages first to look human
    await page.goto("https://or.duvalclerk.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);
    await page.goto("https://or.duvalclerk.com/Support", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);

    // Now the actual search
    await page.goto("https://or.duvalclerk.com/search/SearchTypeRecordDate", { waitUntil: "domcontentloaded" });
    await page.click("#btnButton", { timeout: 10_000 }).catch(() => {});
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });
    await page.waitForTimeout(1500);

    const target = "5/22/2026";
    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", target);
    await page.waitForTimeout(500 + Math.random() * 500);

    // Click + wait for AJAX
    const respWait = page.waitForResponse((r) => /\/Search\/PartialGrid|HasResults/i.test(r.url()), { timeout: 60_000 }).catch(() => null);
    await page.click("#btnSearch");
    await respWait;
    await page.waitForTimeout(4000);

    const state = await page.evaluate(() => {
      const rows = document.querySelectorAll("#RsltsGrid tbody tr, .k-grid-content tbody tr, .gridDiv tr");
      const text = document.body.innerText;
      const noItems = /No items to display/i.test(text);
      const itemCount = (text.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/) ?? [])[3];
      return { rowCount: rows.length, noItems, itemCount, bodySample: text.slice(0, 500) };
    });
    console.log("  rowCount:", state.rowCount);
    console.log("  noItems:", state.noItems);
    console.log("  itemCount:", state.itemCount ?? "(n/a)");
    if (state.rowCount === 0) console.log("  bodySample:", state.bodySample.slice(0, 300));

    // Detect bot indicators
    const stealth = await page.evaluate(() => ({
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver,
      plugins: navigator.plugins.length,
      userAgent: navigator.userAgent,
      language: navigator.language,
    }));
    console.log("  fingerprint:", JSON.stringify(stealth));
  } finally {
    await browser.close();
  }
}

async function main() {
  await probe("A) Vanilla Chromium (control)", chromium, false);
  await probe("B) Stealth Chromium + BD proxy", chromium, true);
  await probe("C) Stealth Firefox + BD proxy", firefox, true);
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
