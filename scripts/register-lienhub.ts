/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";

// LienHub account registration driver.
//
// Fields needed (set via env or paste into REGISTRATION_DATA below):
//   - login (User ID; e.g. "flipops", "tanner-flipops")
//   - email (tannercarlson@vvsvault.com per user)
//   - first_name, last_name
//   - corporate_name (business entity, e.g. "FlipOps")
//   - address, city, state, zip, country
//   - telephone
//   - security_question_id (1=Mother's Maiden, 2=Father's Middle, 3=Favorite Pet, 4=High School Mascot)
//   - security_answer
//
// Password: generated automatically (16 chars meeting LienHub's complexity req)
// and saved to .lienhub-credentials.json (gitignored).

interface RegData {
  login: string;
  email: string;
  first_name: string;
  last_name: string;
  corporate_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  telephone: string;
  security_question_id: string;
  security_answer: string;
}

// === EDIT THESE WHEN USER PROVIDES DETAILS ===
const REGISTRATION_DATA: RegData = {
  login: process.env.LIENHUB_LOGIN ?? "",
  email: process.env.LIENHUB_EMAIL ?? "tannercarlson@vvsvault.com",
  first_name: process.env.LIENHUB_FIRST ?? "Tanner",
  last_name: process.env.LIENHUB_LAST ?? "Carlson",
  corporate_name: process.env.LIENHUB_CORP ?? "FlipOps",
  address: process.env.LIENHUB_ADDRESS ?? "",
  city: process.env.LIENHUB_CITY ?? "",
  state: process.env.LIENHUB_STATE ?? "FL",
  zip: process.env.LIENHUB_ZIP ?? "",
  country: process.env.LIENHUB_COUNTRY ?? "US",
  telephone: process.env.LIENHUB_PHONE ?? "",
  security_question_id: process.env.LIENHUB_SECQ ?? "3", // 3 = Favorite Pet (default)
  security_answer: process.env.LIENHUB_SECA ?? "",
};

function generatePassword(): string {
  // LienHub requires: 8+ chars, lower + upper + number + symbol
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const syms = "!@#$%^&*";
  // 4 chars per group + 4 more random for length 20
  const allChars = lower + upper + nums + syms;
  const rand = (s: string) => s[randomBytes(1)[0] % s.length];
  let p = rand(lower) + rand(upper) + rand(nums) + rand(syms);
  while (p.length < 20) p += rand(allChars);
  // shuffle
  return p.split("").sort(() => randomBytes(1)[0] - 128).join("");
}

async function main() {
  // Validate required fields
  const missing = Object.entries(REGISTRATION_DATA).filter(([_, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error("Missing fields:", missing.join(", "));
    console.error("\nProvide via env vars (LIENHUB_LOGIN, LIENHUB_ADDRESS, etc.) or edit REGISTRATION_DATA in this script.");
    process.exit(1);
  }

  const password = generatePassword();
  console.log("=== LienHub registration ===");
  console.log("Login:", REGISTRATION_DATA.login);
  console.log("Email:", REGISTRATION_DATA.email);
  console.log("Generated password (will be saved):", password);

  // Open the registration page
  const sess = new PlaywrightSession({
    engine: "stealth-chromium",
    headless: false, // headed so user can see / intervene if needed
    navTimeoutMs: 60_000,
  });

  try {
    const page = await sess.newPage();
    await page.goto("https://lienhub.com/user/register", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Fill form
    await page.fill("input[name='login_name']", REGISTRATION_DATA.login);
    await page.fill("input[name='password_1']", password);
    await page.fill("input[name='password_2']", password);
    await page.fill("input[name='first_name']", REGISTRATION_DATA.first_name);
    await page.fill("input[name='last_name']", REGISTRATION_DATA.last_name);
    await page.fill("input[name='corporate_name']", REGISTRATION_DATA.corporate_name);
    await page.fill("input[name='address']", REGISTRATION_DATA.address);
    await page.fill("input[name='city']", REGISTRATION_DATA.city);
    await page.fill("input[name='state']", REGISTRATION_DATA.state);
    await page.fill("input[name='zip']", REGISTRATION_DATA.zip);
    await page.fill("input[name='country']", REGISTRATION_DATA.country);
    await page.fill("input[name='telephone']", REGISTRATION_DATA.telephone);
    await page.fill("input[name='email']", REGISTRATION_DATA.email);
    await page.fill("input[name='email_2']", REGISTRATION_DATA.email);

    // Security question — select the option then fill answer
    await page.selectOption("select[name='security_question_id']", REGISTRATION_DATA.security_question_id).catch(() => {});
    await page.fill("input[name='security_answer']", REGISTRATION_DATA.security_answer);

    // Check the terms checkbox
    await page.check("input[type='checkbox']").catch(() => {});

    console.log("\nForm filled. PRESS ENTER to submit (or Ctrl-C to abort)…");
    await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));

    // Submit
    await page.click("input[type='submit']");
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    // After submit, capture cookies + state
    const cookies = await sess.cookies();
    const credsFile = ".lienhub-credentials.json";
    // Owner-only permissions (0o600 = rw for owner, nothing for group/other).
    // On Unix this is enforced by the OS. On Windows, ACLs work differently —
    // chmodSync sets the file's read-only bit but doesn't restrict other
    // users; for full Windows restriction we'd need to use icacls. The Windows
    // umask still narrows the surface, and the file is also in gitignore.
    writeFileSync(credsFile, JSON.stringify({
      login: REGISTRATION_DATA.login,
      password,
      email: REGISTRATION_DATA.email,
      registeredAt: new Date().toISOString(),
      cookies: JSON.parse(cookies),
    }, null, 2), { mode: 0o600 });
    // Re-apply 0o600 in case the platform's umask widened it at create time.
    try { chmodSync(credsFile, 0o600); } catch { /* tolerate Windows ACL quirks */ }
    console.log(`\nCredentials saved to ${credsFile} (gitignored, owner-only perms).`);
    console.log("\nPost-submit URL:", page.url());
    console.log("Title:", await page.title());
    console.log("Body[0:500]:", (await page.evaluate(() => document.body.innerText)).slice(0, 500));
  } finally {
    await sess.close();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
