/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 90_000 });
  try {
    const page = await sess.newPage();

    await page.goto("https://or.duvalclerk.com/");
    await page.waitForTimeout(1500);
    await page.goto("https://or.duvalclerk.com/Support");
    await page.waitForTimeout(1500);
    await page.goto("https://or.duvalclerk.com/search/SearchTypeRecordDate");
    await page.click("#btnButton").catch(() => {});
    await page.waitForSelector("#RecordDate", { timeout: 30_000 });
    await page.waitForTimeout(1500);
    await page.fill("#RecordDate", "");
    await page.fill("#RecordDate", "5/22/2026");
    await page.waitForTimeout(500);
    const respP = page.waitForResponse((r) => /\/Search\/(PartialGrid|HasResults)/i.test(r.url()), { timeout: 60_000 }).catch(() => null);
    await page.click("#btnSearch");
    await respP;
    await page.waitForTimeout(4000);

    console.log("Initial state:", await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/) ?? [])[0]));

    // Try several page-size change approaches:

    // 1) Kendo dropdownlist via window.kendo
    console.log("\n--- 1) window.kendo + dropdownlist.value('500') ---");
    const result1 = await page.evaluate(() => {
      // @ts-expect-error global kendo
      const w = window as { kendo?: { jQuery?: (sel: string) => { data: (k: string) => unknown } } };
      const dd = w.kendo?.jQuery?.(".k-pager-sizes select")?.data?.("kendoDropDownList") as {
        value: (v: string) => void;
        trigger: (e: string) => void;
      } | undefined;
      if (!dd) return "kendoDropDownList not found";
      dd.value("500");
      dd.trigger("change");
      return "called value+change";
    });
    console.log("Result:", result1);
    await page.waitForTimeout(5000);
    console.log("State:", await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/) ?? [])[0]));

    // Find the actual page-size widget structure
    console.log("\n--- Inspect pager wrap children ---");
    const pagerChildren = await page.evaluate(() => {
      const wrap = document.querySelector(".k-pager-wrap, .k-grid-pager");
      if (!wrap) return "no .k-pager-wrap";
      const children = Array.from(wrap.children).map((c) => ({
        tag: c.tagName,
        cls: c.className.slice(0, 100),
        text: (c.textContent ?? "").slice(0, 80),
      }));
      return children;
    });
    console.log(JSON.stringify(pagerChildren, null, 2));

    // Drill into k-pager-sizes
    console.log("\n--- Inspect .k-pager-sizes children deeply ---");
    const sizesInner = await page.evaluate(() => {
      const root = document.querySelector(".k-pager-sizes");
      if (!root) return "no .k-pager-sizes";
      const all = root.querySelectorAll("*");
      return Array.from(all).slice(0, 15).map((el) => ({
        tag: el.tagName,
        cls: el.className.slice(0, 80),
        id: el.id,
        role: el.getAttribute("role"),
        text: (el.textContent ?? "").slice(0, 30),
      }));
    });
    console.log(JSON.stringify(sizesInner, null, 2));

    // 2) Click the dropdown trigger then the option
    console.log("\n--- 2) Click dropdown then click '500' option ---");
    const trigger = await page.$(".k-pager-sizes .k-dropdown-wrap, .k-pager-sizes .k-input").catch(() => null);
    console.log("Trigger element exists:", !!trigger);
    if (trigger) {
      await trigger.click();
      await page.waitForTimeout(1500);
      // Look for the open dropdown listbox
      const listVisible = await page.evaluate(() => {
        const lists = Array.from(document.querySelectorAll(".k-list, .k-animation-container .k-list-container, .k-list-container"));
        return lists.map((l) => ({ cls: l.className.slice(0, 80), visible: (l as HTMLElement).offsetHeight > 0, text: (l.textContent ?? "").slice(0, 100) }));
      });
      console.log("Dropdown lists:", listVisible);

      // Click the 500 option
      const r = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".k-list-item, .k-item, li.k-item")) as HTMLElement[];
        for (const li of items) {
          if (li.textContent?.trim() === "500") { li.click(); return "clicked 500"; }
        }
        return `no 500 option, found: ${items.map((i) => i.textContent?.trim()).join(",")}`;
      });
      console.log("Click result:", r);
      await page.waitForTimeout(5000);
      console.log("State:", await page.evaluate(() => (document.body.innerText.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/) ?? [])[0]));
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
