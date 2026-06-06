/* eslint-disable no-console */
/**
 * Probe: Miami-Dade Corrections (MDCR) Inmate Search
 * URL: https://www.miamidade.gov/Apps/mdcr/inmateSearch/
 *
 * Findings summary (see PROBE_SCHEMA return at bottom of report):
 *   - ASP.NET WebForms + DevExpress (DXR.axd, dxbs-gridview) backend
 *   - Cloudflare in front (cf-cache-status: DYNAMIC, NOT challenged)
 *   - reCAPTCHA Enterprise v3 INVISIBLE mode — token MUST be present at postback
 *     (site key: 6LeMreYsAAAAABiQ8y8CSG41sZQ0eHO7DmGvml4d, action="search")
 *   - SEARCH-ONLY interface: requires Last Name (>=3 chars) + First Name (>=3 chars)
 *     There is NO public "browse roster" / no date picker / no "show all" mode.
 *     To enumerate the population we MUST iterate a surname dictionary.
 *   - Postback chain: __VIEWSTATE + __EVENTVALIDATION + hdnRecaptchaToken +
 *     hdnRecaptchaMode='Invisible' + ctl00$Content$txtLastName + …$txtFirstName
 *     → __doPostBack('ctl00$Content$btnSearch','')
 *
 * Probe budget: <=5 requests total (per task brief; site is not built for scraper
 * discovery traffic). Anti-bot posture is CAPTCHA-gated, which makes stealth-only
 * probing low-yield without Bright Data + a real reCAPTCHA solve. We document
 * the form structure from the landing HTML (already fetched via curl) and run
 * ONE stealth-chromium attempt to confirm whether grecaptcha-enterprise.execute()
 * succeeds invisibly under stealth conditions.
 */

import { PlaywrightSession } from "../lib/scrapers/base/playwright-session";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const URL_BASE = "https://www.miamidade.gov/Apps/mdcr/inmateSearch/";
const ARTIFACT_DIR = join(process.cwd(), "scripts", "_probe-artifacts", "mdcr");

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  // ---------------------------------------------------------------------
  // STEP 1 — confirm landing page reachable + capture form schema (no JS).
  //          (Already done out-of-band via curl; included here for the
  //           reproducible artifact path. We do NOT re-fetch — count: 0)
  // ---------------------------------------------------------------------
  console.log("[mdcr] curl baseline already captured (HTTP 200, Cloudflare DYNAMIC, ASP.NET)");
  console.log("[mdcr] form schema: txtLastName + txtFirstName (>=3 chars) + invisible recaptcha");

  // ---------------------------------------------------------------------
  // STEP 2 — single stealth-chromium probe. Try a common surname ("SMITH")
  //          with a common first name ("JOHN") and see whether:
  //            (a) grecaptcha-enterprise.execute() resolves silently
  //            (b) postback returns a results grid
  //            (c) result row HTML structure
  //          BUDGET: 1 navigation + 1 form submit = 2 server hits.
  // ---------------------------------------------------------------------
  const session = new PlaywrightSession({
    engine: "stealth-chromium",
    headless: true,
    navTimeoutMs: 60_000,
    // Do NOT useProxy on first attempt — we want to see how the bare stealth
    // posture fares. Bright Data adds friction for grecaptcha (it sees a
    // datacenter-class IP through US residential edge — variable).
    useProxy: false,
  });

  let usedRequests = 1; // the navigation below
  try {
    const page = await session.newPage();
    console.log(`[mdcr] navigating to landing (req ${usedRequests}/5)`);
    await page.goto(URL_BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Give grecaptcha-enterprise time to download + warm up
    await page.waitForTimeout(4000);

    // Capture stealth fingerprint
    const fp = await page.evaluate(() => ({
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver,
      plugins: navigator.plugins.length,
      userAgent: navigator.userAgent,
      grecaptchaPresent: typeof (window as unknown as { grecaptcha?: unknown }).grecaptcha !== "undefined",
      grecaptchaEnterprisePresent:
        typeof (window as unknown as { grecaptcha?: { enterprise?: unknown } }).grecaptcha?.enterprise !== "undefined",
    }));
    console.log("[mdcr] fingerprint:", JSON.stringify(fp));

    // Fill the form. Inputs have placeholder text ("Enter Last Name") that
    // DevExpress treats as nullText — we must use .fill() to overwrite it.
    await page.fill("#Content_txtLastName_I", "SMITH");
    await page.fill("#Content_txtFirstName_I", "JOHN");
    await page.waitForTimeout(500 + Math.random() * 500);

    // Submit. The JS click handler triggers grecaptcha.enterprise.execute() →
    // sets #hdnRecaptchaToken → calls __doPostBack. We just click and wait.
    usedRequests++;
    console.log(`[mdcr] submitting search SMITH/JOHN (req ${usedRequests}/5)`);
    const respWait = page
      .waitForResponse((r) => r.url().startsWith(URL_BASE) && r.request().method() === "POST", {
        timeout: 30_000,
      })
      .catch(() => null);
    await page.click("#Content_btnSearch");
    const resp = await respWait;
    console.log("[mdcr] postback resp status:", resp?.status() ?? "(none)");

    await page.waitForTimeout(4000);

    // Capture the post-search HTML
    const postSearchHtml = await page.content();
    writeFileSync(join(ARTIFACT_DIR, "mdcr-post-search.html"), postSearchHtml);

    // Try to extract the results-grid structure
    const state = await page.evaluate(() => {
      const resultsDiv = document.getElementById("Content_dvSearchResults");
      const lblmsg = document.getElementById("Content_lblmsg")?.innerText ?? "";
      const gmsg = document.getElementById("Content_gmsg")?.innerText ?? "";
      const grid = resultsDiv?.querySelector("table.dxbs-gridview, .dxbs-gridview table");
      const headerCells = grid ? Array.from(grid.querySelectorAll("thead th, thead td")).map((c) => (c as HTMLElement).innerText.trim()) : [];
      const dataRows = grid ? Array.from(grid.querySelectorAll("tbody tr")) : [];
      const firstRowHtml = dataRows[0]?.outerHTML?.slice(0, 4000) ?? null;
      const firstRowCells = dataRows[0]
        ? Array.from(dataRows[0].querySelectorAll("td")).map((c) => (c as HTMLElement).innerText.trim())
        : [];
      const pager = document.querySelector(".dxbs-pager")?.outerHTML?.slice(0, 2000) ?? null;
      return {
        resultsDivExists: !!resultsDiv,
        gridExists: !!grid,
        rowCount: dataRows.length,
        headerCells,
        firstRowCells,
        firstRowHtml,
        lblmsg,
        gmsg,
        pager,
        bodySample: document.body.innerText.slice(0, 800),
      };
    });
    console.log("[mdcr] results state:", JSON.stringify({
      ...state,
      firstRowHtml: state.firstRowHtml ? "(captured to artifact)" : null,
      pager: state.pager ? "(captured to artifact)" : null,
    }, null, 2));
    writeFileSync(join(ARTIFACT_DIR, "mdcr-state.json"), JSON.stringify(state, null, 2));

    // Network log for the chain
    const reqs = await page.evaluate(() =>
      Array.from(performance.getEntriesByType("resource"))
        .map((r) => ({ name: r.name, type: (r as PerformanceResourceTiming).initiatorType }))
        .filter((r) => r.name.includes("miamidade") || r.name.includes("recaptcha") || r.name.includes("google"))
    );
    writeFileSync(join(ARTIFACT_DIR, "mdcr-network.json"), JSON.stringify(reqs, null, 2));
    console.log("[mdcr] captured", reqs.length, "miamidade/recaptcha/google resource entries");
  } catch (e) {
    console.error("[mdcr] probe error:", (e as Error).message);
  } finally {
    await session.close();
  }

  console.log(`[mdcr] DONE. Requests used: ${usedRequests}/5`);
  console.log(`[mdcr] artifacts: ${ARTIFACT_DIR}`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
