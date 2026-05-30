/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

interface Creds {
  login: string;
  password: string;
  email: string;
  registeredAt: string;
  cookies?: unknown[];
  authenticatedAt?: string;
}

async function main() {
  const credsFile = ".lienhub-credentials.json";
  const creds: Creds = JSON.parse(readFileSync(credsFile, "utf8"));
  console.log(`Logging in as: ${creds.login} (${creds.email})`);

  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true, navTimeoutMs: 60_000 });
  try {
    const page = await sess.newPage();

    // Land on sign-in page
    await page.goto("https://lienhub.com/user/signin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("On signin page:", page.url(), "title:", await page.title());

    // Fill credentials
    await page.fill("input[name='login']", creds.login);
    await page.fill("input[name='password']", creds.password);
    await page.waitForTimeout(500);

    // Submit login form
    await page.click("input[type='submit']");
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const postUrl = page.url();
    const postTitle = await page.title();
    console.log("\nPost-login URL:", postUrl);
    console.log("Title:", postTitle);

    const body = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log("Body[0:600]:", body);

    // Check for login errors
    const stillOnLogin = /sign\s*in/i.test(postTitle) && /password|login/i.test(body);
    if (stillOnLogin) {
      console.log("\n⚠ Still on login page — credentials may have been rejected.");
      const errors = await page.evaluate(() => {
        const errs: string[] = [];
        document.querySelectorAll(".error, .alert, .alert-danger, [class*='error']").forEach((e) => {
          const t = (e.textContent ?? "").trim();
          if (t && t.length < 200) errs.push(t.replace(/\s+/g, " "));
        });
        return errs;
      });
      errors.forEach((e) => console.log("  err:", e));
      process.exit(1);
    }

    // Verify we have authenticated session: try visiting a county page that
    // requires login to see real data.
    await page.goto("https://lienhub.com/county/duval", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const duvalBody = await page.evaluate(() => document.body.innerText.slice(0, 800));
    console.log("\n--- Duval county page after login ---");
    console.log(duvalBody);

    // Stash cookies for the scraper to consume
    const cookies = await sess.cookies();
    const updated: Creds = { ...creds, cookies: JSON.parse(cookies), authenticatedAt: new Date().toISOString() };
    writeFileSync(credsFile, JSON.stringify(updated, null, 2), { mode: 0o600 });
    try { chmodSync(credsFile, 0o600); } catch { /* Windows ACL quirks */ }
    console.log(`\n✓ Updated ${credsFile} with authenticated cookies`);
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
