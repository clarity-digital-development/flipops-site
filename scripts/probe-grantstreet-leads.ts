/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    // Find the "View upcoming sales" link href first
    await page.goto("https://www.grantstreet.com/auctions", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
    );
    const upcoming = links.find((l) => /upcoming\s*sales|view\s*upcoming/i.test(l.text));
    const devPortal = links.find((l) => /developer\s*portal|api/i.test(l.text));
    const auctionsPortal = links.find((l) => /auctions\s*portal/i.test(l.text));
    console.log("View upcoming sales →", upcoming?.href);
    console.log("Developer portal →", devPortal?.href);
    console.log("Auctions portal →", auctionsPortal?.href);

    // Visit each
    for (const link of [upcoming, devPortal, auctionsPortal].filter(Boolean) as { text: string; href: string }[]) {
      console.log(`\n=== ${link.text} → ${link.href} ===`);
      try {
        await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(2500);
        console.log("URL:", page.url(), "title:", await page.title());
        const body = await page.evaluate(() => document.body.innerText);
        console.log("Body[0:2500]:");
        console.log(body.slice(0, 2500));
      } catch (e) {
        console.log("✗", (e as Error).message.split("\n")[0]);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
