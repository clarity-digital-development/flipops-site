/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// Inspect Duval RealForeclose to understand:
//   1. Does the splash page have a public "View Auctions" path?
//   2. What does the login form expect (field names, hidden tokens)?
//   3. What is the auction-calendar URL after login?
//   4. Any "trial" / "guest" path that bypasses registration?

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    console.log("=== Step 1: Visit splash page ===");
    await page.goto("https://duval.realforeclose.com/index.cfm", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    // Inspect form structure on splash
    const splashForms = await page.evaluate(() => {
      const forms = document.querySelectorAll("form");
      return Array.from(forms).map((f) => ({
        action: f.getAttribute("action"),
        method: f.getAttribute("method"),
        id: f.id,
        inputs: Array.from(f.querySelectorAll("input,select")).map((i) => {
          const e = i as HTMLInputElement;
          return { name: e.name, type: e.type, id: e.id, value: e.value?.slice(0, 50), placeholder: e.getAttribute("placeholder") };
        }),
      }));
    });
    console.log("Forms on splash:", JSON.stringify(splashForms, null, 2));

    // Look for "View Auctions" / "Guest" / "Continue" buttons or links
    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll("a, button, input[type='submit'], input[type='button']");
      return Array.from(anchors).map((a) => {
        const e = a as HTMLAnchorElement;
        return {
          tag: e.tagName,
          text: (e.textContent || (e as unknown as HTMLInputElement).value || "").trim().slice(0, 60),
          href: e.getAttribute("href"),
          id: e.id,
          name: (e as unknown as HTMLInputElement).name,
        };
      }).filter((l) => l.text);
    });
    const interesting = links.filter((l) =>
      /(view|auction|guest|continue|register|login|access|sign|preview|calendar)/i.test(l.text + " " + l.href)
    );
    console.log("\nInteresting buttons/links:");
    interesting.forEach((l) => console.log(`  ${l.tag} text="${l.text}" href=${l.href || "(none)"} id=${l.id || "(none)"} name=${l.name || "(none)"}`));

    console.log("\n=== Step 2: Try to access auction calendar URL patterns ===");
    const candidates = [
      "https://duval.realforeclose.com/index.cfm?zaction=AUCTION&Zmethod=PREVIEW",
      "https://duval.realforeclose.com/index.cfm?ZACTION=AUCTION&ZMETHOD=PREVIEW",
      "https://duval.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR",
      "https://duval.realforeclose.com/index.cfm?zaction=Calendar",
    ];
    for (const url of candidates) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      const t = await page.title();
      const u = page.url();
      const bodyHasAuction = await page.evaluate(() => /auction|sale date|opening bid|case number/i.test(document.body.innerText));
      console.log(`  ${url} → ${u} | title="${t.slice(0, 50)}" | hasAuctionContent=${bodyHasAuction}`);
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
