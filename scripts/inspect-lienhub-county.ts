/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 45_000 });
  try {
    const page = await sess.newPage();

    console.log("=== Duval county page ===");
    await page.goto("https://lienhub.com/county/duval", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("Title:", await page.title());
    console.log("URL:", page.url());

    const body = await page.evaluate(() => document.body.innerText);
    console.log("\nBody text:");
    console.log(body.slice(0, 2500));

    console.log("\n=== Links + actions on county page ===");
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href], button"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href || "" }))
        .filter((l) => l.text)
    );
    links.slice(0, 30).forEach((l) => console.log(`  ${l.text.padEnd(50)} ${l.href}`));

    console.log("\n=== Cert Sale Schedules ===");
    await page.goto("https://lienhub.com/cert-sale-schedules", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("Title:", await page.title(), "URL:", page.url());
    const body2 = await page.evaluate(() => document.body.innerText);
    console.log("Body:");
    console.log(body2.slice(0, 2500));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
