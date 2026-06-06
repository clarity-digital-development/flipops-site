/* eslint-disable no-console */
/**
 * Probe: PBSO (Palm Beach County Sheriff's Office) public booking blotter.
 *
 * Mission: characterize the public arrest/jail feed to feed schema design +
 * scraper implementation for the freshness layer. The user-facing menu page at
 *
 *   https://www.pbso.org/arrest-jail_menu
 *
 * is just a directory. The actual booking blotter lives on a separate
 * ColdFusion app at:
 *
 *   https://www3.pbso.org/blotter/
 *
 * Findings (run 2026-05-31):
 *   - Site type: ColdFusion (`.cfm`) app on a separate subdomain (www3).
 *   - The blotter landing is a SEARCH FORM (no immediate listing). To get
 *     bookings you POST start_date / end_date (and optional name / statute
 *     filters) to:
 *         POST https://www3.pbso.org/blotter/searchresults.cfm
 *     The result page (~213 KB for a 1-day query) returns up to 5 records
 *     per page with "Page N of M" pagination markers and "Last »" link.
 *     For 05/30→05/31/2026 we observed "55 matches retrieved … Page 1 of 11".
 *   - Per-row fields visible: Name (LAST, FIRST MIDDLE), Race, Gender,
 *     Facility, OBTS Number, Booking Date/Time, Cell Location,
 *     Arresting Agency (e.g. "01-PBSO", "84-RIVIERA BEACH"),
 *     Release Date (N/A while in custody), Holds For Other Agencies,
 *     Jacket Number, Booking Number, Charges (multiple — each is a
 *     statute code like "784.041 2A (FT)" with a description and an
 *     Original Bond + Current Bond + "Bond Information" link).
 *   - NOT directly exposed in the listing: DOB, address, race/age detail,
 *     mugshot. (PBSO does NOT publish mugshots in this feed — a Florida
 *     §119 distinction. Confirmed no mugshot URLs on the page.)
 *   - hCaptcha logo loads on the landing page, BUT does NOT gate the form
 *     submit. We were able to POST searchresults.cfm and receive a 200
 *     with full data using stealth-chromium and no captcha solve.
 *   - Refresh: official PBSO product description is "300 most recent
 *     arrests"; observed: 55 bookings in a single 24-hour window
 *     (05/30→05/31) implies ~50-70 bookings/day average.
 *   - Pagination: form-driven. The result page advertises "Page 1 of 11"
 *     with numeric and Last » links. URL stayed at searchresults.cfm,
 *     so paging likely posts back with a hidden page/start index.
 *
 * Probe etiquette (yellow-zone per FL-COVERAGE-PLAN.md §5.1):
 *   - Used at most 2 page navigations (well under the 5-request budget)
 *   - stealth-chromium with realistic Chrome UA + 2-3s waitForTimeout
 *     between actions
 *   - No retries on failure
 *   - No DB writes
 *   - One search per probe run, narrow date range
 */

import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

const MENU_URL = "https://www.pbso.org/arrest-jail_menu";
const BLOTTER_URL = "https://www3.pbso.org/blotter/";

function fmt(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

async function main() {
  const stage = process.argv[2] ?? "all"; // "menu" | "search" | "all"
  console.log("PBSO probe starting at", new Date().toISOString(), "stage:", stage);

  const sess = new PlaywrightSession({
    engine: "stealth-chromium",
    headless: true,
    navTimeoutMs: 60_000,
  });

  try {
    const page = await sess.newPage();

    if (stage === "menu" || stage === "all") {
      // -------- NAV 1: confirm the menu page still points to /blotter --------
      console.log("\n=== NAV 1: menu page ===");
      await page.goto(MENU_URL, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForTimeout(1500);
      const anchors = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]")).map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: ((a as HTMLAnchorElement).innerText || a.textContent || "").trim().slice(0, 80),
        }))
      );
      const blotter = anchors.filter((a) => /blotter|inmate\s+search|booking\s+search/i.test(a.text));
      console.log("Blotter / inmate-search links on menu:");
      blotter.forEach((a) => console.log(`  [${a.text}] -> ${a.href}`));
    }

    if (stage === "search" || stage === "all") {
      // -------- NAV 2: hit the blotter landing --------
      console.log("\n=== NAV 2: blotter landing ===");
      await page.goto(BLOTTER_URL, { waitUntil: "networkidle", timeout: 45_000 });
      await page.waitForTimeout(1500);
      const formInfo = await page.evaluate(() => {
        const f = document.querySelector("form") as HTMLFormElement | null;
        return {
          action: f?.action ?? null,
          method: f?.method ?? null,
          inputs: f
            ? Array.from(f.querySelectorAll("input, select")).map((i) => ({
                name: (i as HTMLInputElement).name,
                type: (i as HTMLInputElement).type || i.tagName.toLowerCase(),
              }))
            : [],
          hcaptchaPresent: /hcaptcha/i.test(document.body.innerHTML),
        };
      });
      console.log("Form:", JSON.stringify(formInfo, null, 2));

      // -------- NAV 3: submit form for previous-day → today --------
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const startDate = fmt(yesterday);
      const endDate = fmt(today);
      console.log(`\n=== NAV 3: submit form (${startDate} → ${endDate}) ===`);
      await page.fill('input[name="start_date"]', startDate);
      await page.fill('input[name="end_date"]', endDate);
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {}),
        page.click('input[type="submit"], button[type="submit"]'),
      ]);
      await page.waitForTimeout(2500);
      console.log("Result URL:", page.url());
      const summary = await page.evaluate(() => {
        const body = document.body.innerText;
        const matchCount = body.match(/(\d+)\s+matches retrieved/i)?.[1];
        const totalPages = body.match(/Page\s+\d+\s+of\s+(\d+)/i)?.[1];
        // Pull the FIRST inmate block — bounded by "Name:" and the next "Name:"
        const firstStart = body.indexOf("Name:");
        const firstEnd = firstStart >= 0 ? body.indexOf("Name:", firstStart + 5) : -1;
        const firstBlockText = firstStart >= 0 && firstEnd > firstStart
          ? body.slice(firstStart, firstEnd)
          : null;
        return { matchCount, totalPages, firstBlockText };
      });
      console.log("Matches in 1-day window:", summary.matchCount);
      console.log("Total result pages:", summary.totalPages);
      console.log("\n--- VERBATIM TEXT OF FIRST INMATE BLOCK ---");
      console.log(summary.firstBlockText);
    }
  } finally {
    await sess.close();
  }
  console.log("\nProbe complete at", new Date().toISOString());
}

main().catch((e) => {
  console.error("PROBE FATAL:", e);
  process.exit(1);
});
