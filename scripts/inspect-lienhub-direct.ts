/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 45_000 });
  try {
    const page = await sess.newPage();

    console.log("=== lienhub.com landing ===");
    await page.goto("https://lienhub.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("title:", await page.title());

    // Get links + nav
    const links = await page.evaluate(() => {
      const out: Array<{ text: string; href: string }> = [];
      document.querySelectorAll("a[href]").forEach((a) => {
        out.push({ text: (a.textContent || "").trim().slice(0, 50), href: (a as HTMLAnchorElement).href });
      });
      return out;
    });
    console.log(`\nLinks (${links.length}):`);
    links.slice(0, 25).forEach((l) => console.log(`  ${l.text.padEnd(40)} ${l.href}`));

    // Inspect forms
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll("input, select")).map((i) => {
          const e = i as HTMLInputElement;
          return { name: e.name, type: e.type, value: e.value?.slice(0, 30), placeholder: e.getAttribute("placeholder") };
        }),
      }));
    });
    console.log("\nForms:", JSON.stringify(forms, null, 2).slice(0, 1500));

    // Full body text
    const body = await page.evaluate(() => document.body.innerText);
    console.log("\nBody text:");
    console.log(body);

    // Try the county selector / search endpoint
    console.log("\n=== Try /counties or /search endpoints ===");
    for (const path of ["/counties", "/county", "/search", "/login", "/help", "/training"]) {
      try {
        await page.goto(`https://lienhub.com${path}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(1000);
        const t = await page.title();
        const u = page.url();
        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        console.log(`  ${path} → ${u} title="${t.slice(0, 60)}" body=${bodyLen}b`);
      } catch (e) {
        console.log(`  ${path} → ERROR ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
