/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// Grant Street has a public auctions index. Both deedauction.net and
// www.deedauction.net redirect to https://www.grantstreet.com/auctions.
// That suggests a public-facing aggregator. Let's see what data is on it.

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    await page.goto("https://www.grantstreet.com/auctions", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    const body = await page.evaluate(() => document.body.innerText);
    console.log("\nBody[0:3000]:");
    console.log(body.slice(0, 3000));

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && l.href && !/^javascript:|^#/.test(l.href))
    );
    console.log("\nAll links:");
    links.slice(0, 50).forEach((l) => console.log(`  "${l.text}" → ${l.href}`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
