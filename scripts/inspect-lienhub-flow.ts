/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// LienHub / TaxSys are Grant Street Group platforms. Typical county
// subdomains: {county}.lienhub.com (certificate sales) /
// {county}.taxsys.com (unified tax interface). Counties known/observed
// to use: Pinellas, Hillsborough, Lee, Pasco, Manatee, Sarasota, ~30 FL
// counties total. Each may use one or both subdomains.

const CANDIDATE_URLS = [
  // Root domains to discover real structure
  "https://lienhub.com/",
  "https://www.lienhub.com/",
  "https://taxsys.com/",
  "https://www.grantstreet.com/",
  // Known FL county tax-collector sites (LienHub usually integrated here)
  "https://www.pcpao.gov/",
  "https://www.taxcollector.com/",
  "https://www.duvaltaxcollect.net/",
  "https://www.broward.org/RecordsTaxesTreasury/Pages/Default.aspx",
  "https://www.hillstax.org/",
  // GovHub / Grant Street SaaS endpoints
  "https://govhub.com/",
  "https://www.govhub.com/",
];

async function main() {
  const sess = new PlaywrightSession({ useProxy: false, headless: true, navTimeoutMs: 45_000 });
  try {
    const page = await sess.newPage();
    for (const url of CANDIDATE_URLS) {
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(1500);
        const title = await page.title();
        const finalUrl = page.url();
        const hasLogin = await page.evaluate(() => /user\s*name|password|sign\s*in|log\s*in/i.test(document.body.innerText));
        const hasTaxContent = await page.evaluate(() => /certificate|delinquen|tax|sale|auction|parcel|search/i.test(document.body.innerText));
        const bodyLen = await page.evaluate(() => document.body.innerText.length);
        console.log(`${url}`);
        console.log(`  → ${finalUrl} status=${r?.status() ?? "?"} title="${title.slice(0, 60)}"`);
        console.log(`  hasLoginForm=${hasLogin} hasTaxContent=${hasTaxContent} bodyLen=${bodyLen}`);
      } catch (e) {
        console.log(`${url} → ERROR ${(e as Error).message.split("\n")[0]}`);
      }
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
