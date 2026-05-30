/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 45_000 });
  try {
    const page = await sess.newPage();

    console.log("=== Find signup link from landing ===");
    await page.goto("https://lienhub.com/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Try sign-in link to see registration path
    await page.goto("https://lienhub.com/ssosp/check_authenticated/r/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("Sign-in flow URL:", page.url());
    console.log("Title:", await page.title());

    const text = await page.evaluate(() => document.body.innerText);
    console.log("\nBody text (first 2000):");
    console.log(text.slice(0, 2000));

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ text: (a.textContent || "").trim().slice(0, 60), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.text && /sign\s*up|register|create|new\s*account|join/i.test(l.text + l.href))
    );
    console.log("\nSignup-related links:");
    links.forEach((l) => console.log(`  ${l.text} → ${l.href}`));

    // Inspect form
    const forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll("input, select")).map((i) => {
          const e = i as HTMLInputElement;
          return { name: e.name, type: e.type, required: e.required, placeholder: e.getAttribute("placeholder") };
        }),
      }))
    );
    console.log("\nForms:");
    forms.forEach((f) => {
      console.log(`  action=${f.action} method=${f.method}`);
      f.inputs.forEach((i) => console.log(`    input name=${i.name} type=${i.type} required=${i.required} placeholder="${i.placeholder ?? ""}"`));
    });
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
