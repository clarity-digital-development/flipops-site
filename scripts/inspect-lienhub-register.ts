/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    console.log("=== /user/register ===");
    await page.goto("https://lienhub.com/user/register", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    // Get full body text first
    const text = await page.evaluate(() => document.body.innerText);
    console.log("\n--- Body text ---");
    console.log(text.slice(0, 4000));

    // Form fields
    const forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll("form")).map((f) => ({
        action: f.action,
        method: f.method,
        inputs: Array.from(f.querySelectorAll("input, select, textarea")).map((i) => {
          const e = i as HTMLInputElement;
          return {
            name: e.name,
            type: e.type ?? e.tagName.toLowerCase(),
            required: e.required,
            placeholder: e.getAttribute("placeholder"),
            label: e.getAttribute("aria-label") ?? "",
          };
        }),
      }))
    );
    console.log("\n--- Forms ---");
    forms.forEach((f) => {
      console.log(`action=${f.action} method=${f.method}`);
      f.inputs.forEach((i) => console.log(`  ${i.type.padEnd(10)} name=${i.name} required=${i.required} placeholder="${i.placeholder ?? ""}" label="${i.label}"`));
    });

    // Look for any cost language
    const costMentions = text.match(/\$[0-9.,]+|free|no\s*charge|no\s*cost|subscription|monthly|annual|fee/gi);
    console.log("\n--- Cost mentions ---");
    if (costMentions) costMentions.forEach((c) => console.log(`  "${c}"`));
    else console.log("  (none in registration page)");

    // Check Terms / User Agreement which may list fees
    console.log("\n=== User Agreement / Terms ===");
    for (const link of ["/user-agreement", "/terms", "/disclaimer", "/pricing", "/help/fees"]) {
      try {
        const r = await page.goto(`https://lienhub.com${link}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(1000);
        const t = await page.title();
        const u = page.url();
        const body = await page.evaluate(() => document.body.innerText);
        const fees = body.match(/\$[0-9.,]+|free|fee|charge|cost|subscription/gi) ?? [];
        console.log(`  ${link} → ${u} title="${t.slice(0, 50)}" body=${body.length}b fees=${fees.length}`);
        if (fees.length > 0 && fees.length < 30) console.log(`    samples: ${fees.slice(0, 10).join(" | ")}`);
      } catch (e) {
        console.log(`  ${link} → ERROR ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
