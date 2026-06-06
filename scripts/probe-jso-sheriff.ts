/* eslint-disable no-console */
/**
 * Probe: JSO (Duval County) inmate roster
 *
 * Site: https://inmatesearch.jaxsheriff.org/   (Angular SPA, `<wic-root>`)
 * API:  https://inmatesearch-api.jaxsheriff.org:8443/
 * Auth: Google reCAPTCHA v2/v3 -> /Captcha/GetCaptchaResponse?captchaResponse=<token>
 *       -> server returns an authorization token that the SPA stores as `currentUser`
 *          and sends as the `Authorization` header on every subsequent /search/* call.
 *
 * Useful endpoints discovered from main.js:
 *   GET /search/searchByLastInitial?searchLetter=A&gender=M
 *   GET /Search/SearchByName?firstName=&lastName=&middleName=&inmateActive=
 *   GET /search/SearchByBookingNo?bookingNo=&inmateNumber=
 *   GET /search/RecentBookings?timediff=24      <-- KEY for freshness scrape
 *   GET /search/ReleaseLog?timediff=24
 *   GET /search/InmateDetails?incarcerationId=<id>
 *
 * Probe budget: <= 5 HTTP requests total.
 */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

const ROSTER_URL = "https://inmatesearch.jaxsheriff.org/";

async function main() {
  console.log("Step 1: Vanilla curl-style fetch already done (see jso-probe-raw.html).");
  console.log("  Result: HTTP 200, 1600 bytes, Angular SPA shell only.");
  console.log("  Roster is fully JS-rendered. Direct GET cannot reach data.");

  console.log("\nStep 2: Confirm SPA loads cleanly under stealth-chromium and capture network traffic.");
  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60000 });
  const page = await sess.newPage();

  type ReqRecord = { url: string; method: string; status?: number; type?: string };
  const reqs: ReqRecord[] = [];
  page.on("request", (req) => {
    reqs.push({ url: req.url(), method: req.method(), type: req.resourceType() });
  });
  page.on("response", (resp) => {
    const i = reqs.findIndex((r) => r.url === resp.url() && r.status === undefined);
    if (i >= 0) reqs[i].status = resp.status();
  });

  await page.goto(ROSTER_URL, { waitUntil: "domcontentloaded" });
  // Single soft wait for Angular bootstrap. Do not click "Recent Bookings" — that
  // would force a captcha solve which our budget can't afford.
  await page.waitForTimeout(4000);

  const title = await page.title();
  console.log("  title:", title);
  const tabs = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("a, button, mat-tab, .mat-tab-label, [role='tab']"))
      .map((el) => (el.textContent ?? "").trim())
      .filter((t) => t.length > 0 && t.length < 60);
    return Array.from(new Set(labels)).slice(0, 30);
  });
  console.log("  visible labels:", tabs);

  const apiCalls = reqs.filter((r) => /jaxsheriff\.org/.test(r.url) && r.type !== "image" && r.type !== "font" && r.type !== "stylesheet");
  console.log("\n  jaxsheriff.org traffic (filtered):");
  for (const r of apiCalls) console.log(`   ${r.method} ${r.status ?? "?"} ${r.url.slice(0, 140)}`);

  const recaptchaPresent = reqs.some((r) => /recaptcha|google\.com\/recaptcha/.test(r.url));
  console.log("\n  reCAPTCHA loaded:", recaptchaPresent);

  await sess.close();

  console.log("\nStep 3: Already fetched /assets/config.json via curl.");
  console.log("  apiUrl: https://inmatesearch-api.jaxsheriff.org:8443/");
  console.log("  siteKey: 6LeN5c8iAAAAANQZxRPp9ei_ZPTGZvCKw_1rZU_6 (reCAPTCHA v2 invisible)");
  console.log("  UseCaptcha: true  <-- HARD GATE");

  console.log("\nSummary:");
  console.log("  - Public roster is reachable. No Cloudflare, no Akamai, no IP block.");
  console.log("  - But the API requires an Authorization header derived from a server-validated");
  console.log("    Google reCAPTCHA token. Stealth-chromium can render the SPA, but cannot");
  console.log("    forge a valid recaptcha token — that requires a real solve (or a paid 2captcha/anti-captcha service).");
  console.log("  - For scraping: drive Playwright through the recaptcha solve once per session,");
  console.log("    capture the Authorization token, then replay /search/RecentBookings?timediff=N");
  console.log("    directly against the API for the rest of the session.");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
