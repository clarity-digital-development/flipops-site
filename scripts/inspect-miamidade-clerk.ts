/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// Miami-Dade clerk OR records — figure out the platform + search URL.
// Common Miami-Dade clerk URLs:
//   onlineservices.miamidadeclerk.gov
//   www2.miamidadeclerk.gov
//   www.miami-dadeclerk.gov

const CANDIDATES = [
  "https://www2.miami-dadeclerk.com/officialrecords/",
  "https://www2.miami-dadeclerk.com/officialrecords/StandardSearch.aspx",
  "https://www2.miami-dadeclerk.com/OfficialRecords/StandardSearch.aspx",
  "https://onlineservices.miamidadeclerk.gov/officialrecords/",
  "https://onlineservices.miamidadeclerk.gov/OfficialRecords/",
  "https://www.miami-dadeclerk.com/",
  "https://www.miamidadeclerk.com/",
  "https://miamidadeclerk.com/",
];

async function main() {
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();
    console.log("=== Iterating known landing pages ===");
    for (const url of CANDIDATES) {
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(1500);
        const t = await page.title();
        const u = page.url();
        console.log(`${url}`);
        console.log(`  → ${u} status=${r?.status() ?? "?"} title="${t.slice(0, 80)}"`);

        // Look for "official records" or "OR records" links
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => ({ text: (a.textContent || "").trim().slice(0, 80), href: (a as HTMLAnchorElement).href }))
            .filter((l) => /(official\s*record|search\s*record|or\s*record|record\s*search|land\s*record)/i.test(l.text + l.href));
        });
        if (links.length > 0) {
          console.log(`  Records-related links:`);
          links.slice(0, 5).forEach((l) => console.log(`    "${l.text}" → ${l.href}`));
        }
      } catch (e) {
        console.log(`  ✗ ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
