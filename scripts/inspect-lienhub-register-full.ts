/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    await page.goto("https://lienhub.com/user/register", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // ALL form inputs in detail
    const detail = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return null;
      return {
        action: (form as HTMLFormElement).action,
        method: (form as HTMLFormElement).method,
        allInputs: Array.from(form.querySelectorAll("input, select, textarea, button")).map((e) => {
          const el = e as HTMLInputElement;
          return {
            tag: el.tagName,
            type: el.type ?? "(none)",
            name: el.name,
            id: el.id,
            value: el.value?.slice(0, 60),
            checked: (el as HTMLInputElement).checked,
            readOnly: el.readOnly,
            required: el.required,
            label: (() => {
              if (el.labels?.[0]) return el.labels[0].textContent?.trim().slice(0, 60);
              const lbl = document.querySelector(`label[for='${el.id}']`);
              return lbl?.textContent?.trim().slice(0, 60);
            })(),
          };
        }),
      };
    });

    console.log("Form action:", detail?.action, "method:", detail?.method);
    console.log("\nAll form fields:");
    detail?.allInputs?.forEach((i, idx) => {
      console.log(`  [${idx.toString().padStart(2)}] ${i.tag.padEnd(8)} type=${(i.type ?? "").padEnd(10)} name="${i.name}" id="${i.id}" checked=${i.checked} readonly=${i.readOnly} req=${i.required} label="${i.label ?? ""}" value="${i.value}"`);
    });

    // Find specifically the terms checkbox
    const termsBox = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("input[type='checkbox']"));
      return all.map((cb) => {
        const e = cb as HTMLInputElement;
        const parent = e.parentElement;
        const sibling = parent?.querySelector("label, span");
        return {
          name: e.name,
          id: e.id,
          checked: e.checked,
          nearbyText: (parent?.textContent ?? "").trim().slice(0, 200),
        };
      });
    });
    console.log("\nAll checkboxes with context:");
    termsBox.forEach((b, i) => console.log(`  [${i}] name="${b.name}" id="${b.id}" checked=${b.checked} context="${b.nearbyText}"`));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
