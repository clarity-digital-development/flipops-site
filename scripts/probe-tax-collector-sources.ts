/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// Survey the top-5 metros' tax collector sites + a couple of mid-tier to
// verify the delinquent-property data publication.
//
// FL § 197.402: county tax collectors MUST publish the delinquent tax
// list at least 3x in a newspaper of general circulation, AND maintain
// a public list available for inspection. Most counties post it on
// their tax collector website annually.

const TARGETS = [
  // Top-5 metros
  { county: "Duval",         url: "https://jaxtaxcollector.com/" },
  { county: "Duval-alt",     url: "https://www.duvaltaxcollect.net/" },
  { county: "Miami-Dade",    url: "https://www.miamidade.gov/global/finance/tax-collector/home.page" },
  { county: "Broward",       url: "https://broward.county-taxes.com/" },
  { county: "Broward-alt",   url: "https://www.browardtaxcollector.com/" },
  { county: "Hillsborough",  url: "https://www.hillstax.org/" },
  { county: "Hillsborough-alt", url: "https://hillsboroughtax.com/" },
  { county: "Palm Beach",    url: "https://www.pbctax.com/" },
  // Mid-tier check
  { county: "Pinellas",      url: "https://www.pinellastaxcollector.com/" },
  { county: "Pinellas-alt",  url: "https://pinellascountytaxcollector.com/" },
  { county: "Orange",        url: "https://www.octaxcol.com/" },
  // Legal newspapers (FL mandatory publication channels)
  { county: "Jax Daily Record (legal)", url: "https://legals.jaxdailyrecord.com/" },
];

async function main() {
  // Use a fresh session per target so a navigation error doesn't pollute
  // the next request (we saw "Navigation interrupted" cascade through the
  // previous run because pages shared the queued nav state).
  for (const t of TARGETS) {
    const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
    try {
      const page = await sess.newPage();
      try {
        const r = await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 25_000 });
        await page.waitForTimeout(1500);
        const finalUrl = page.url();
        const title = await page.title();
        const status = r?.status() ?? 0;

        // Look for delinquent / cert sale / tax certificate links
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .map((a) => ({ text: (a.textContent || "").trim().slice(0, 80), href: (a as HTMLAnchorElement).href }))
            .filter((l) => l.text && /delinquent|tax\s*certificat|cert\s*sale|tax\s*sale|tax\s*deed|public\s*records|search|property\s*tax/i.test(l.text))
        );

        console.log(`\n${t.county.padEnd(20)} ${t.url}`);
        console.log(`  → ${finalUrl} [${status}] "${title.slice(0, 60)}"`);
        if (links.length > 0) {
          console.log(`  Relevant links (${links.length}):`);
          links.slice(0, 5).forEach((l) => console.log(`    "${l.text}" → ${l.href}`));
        }
      } catch (e) {
        console.log(`\n${t.county.padEnd(20)} ✗ ${(e as Error).message.split("\n")[0]}`);
      }
    } finally {
      await sess.close();
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
