/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    await page.goto("https://onlineservices.miamidadeclerk.gov/officialrecords/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("Title:", await page.title());
    console.log("URL:", page.url());

    // Body sample
    const body = await page.evaluate(() => document.body.innerText);
    console.log("\nBody text [0:1500]:");
    console.log(body.slice(0, 1500));

    // Look for forms
    const forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll("input, select, button")).map((i) => {
          const e = i as HTMLInputElement;
          return { name: e.name, type: e.type, id: e.id, placeholder: e.getAttribute("placeholder"), value: e.value?.slice(0, 30) };
        }),
      }))
    );
    console.log("\nForms:");
    forms.forEach((f) => {
      console.log(`  action=${f.action} method=${f.method}`);
      f.inputs.forEach((i) => console.log(`    ${i.type.padEnd(10)} name=${i.name} id=${i.id} placeholder="${i.placeholder ?? ""}" value="${i.value ?? ""}"`));
    });

    // Look for search/navigation links
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && /search|date|record|advanced/i.test(l.text + " " + l.href))
    );
    console.log("\nSearch-related links:");
    links.slice(0, 10).forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

    // Detect platform
    const scripts = await page.evaluate(() =>
      Array.from(document.scripts).map((s) => s.src).filter((s) => s)
    );
    console.log("\nScripts (first 10):");
    scripts.slice(0, 10).forEach((s) => console.log(`  ${s}`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
