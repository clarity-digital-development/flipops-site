/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    console.log("=== /re_tax/retax_search.php ===");
    await page.goto("https://legals.jaxdailyrecord.com/re_tax/retax_search.php", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("URL:", page.url(), "title:", await page.title());

    const body = await page.evaluate(() => document.body.innerText);
    console.log("\nBody[0:2500]:");
    console.log(body.slice(0, 2500));

    // Inspect search form
    const forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll("input, select, textarea, button")).map((i) => {
          const e = i as HTMLInputElement;
          return { name: e.name, type: e.type, id: e.id, value: e.value?.slice(0, 30), placeholder: e.getAttribute("placeholder") };
        }),
      }))
    );
    console.log("\nForms:");
    forms.forEach((f) => {
      console.log(`  action=${f.action} method=${f.method}`);
      f.inputs.forEach((i) => console.log(`    ${i.type.padEnd(10)} name=${i.name} id=${i.id} value="${i.value ?? ""}" placeholder="${i.placeholder ?? ""}"`));
    });

    // Look for links / navigation
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text)
    );
    console.log("\nLinks (first 20):");
    links.slice(0, 20).forEach((l) => console.log(`  "${l.text}" → ${l.href}`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
