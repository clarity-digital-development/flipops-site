/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";

async function main() {
  const sess = new ClerkSession({ useProxy: false });

  console.log("Step 1: GET /search/SearchTypeRecordDate...");
  const r1 = await sess.get("https://or.duvalclerk.com/search/SearchTypeRecordDate");
  console.log("  status:", r1.status, "html bytes:", r1.html.length);
  console.log("  title:", (r1.html.match(/<title>([^<]+)<\/title>/) || ["", "?"])[1].trim().slice(0, 60));
  console.log("  cookies stashed:", await sess.dumpCookies("https://or.duvalclerk.com/"));

  console.log("\nStep 2: POST /Search/Disclaimer with disclaimer=true...");
  const r2 = await sess.postForm("https://or.duvalclerk.com/Search/Disclaimer?st=/search/SearchTypeRecordDate", {
    disclaimer: "true",
  });
  console.log("  status:", r2.status, "html bytes:", r2.html.length);
  console.log("  title:", (r2.html.match(/<title>([^<]+)<\/title>/) || ["", "?"])[1].trim().slice(0, 60));
  console.log("  cookies after:", await sess.dumpCookies("https://or.duvalclerk.com/"));

  // Inspect form
  const forms = [...r2.html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)];
  console.log(`\n  Forms in response: ${forms.length}`);
  forms.forEach((f, i) => {
    const tag = f[0].slice(0, f[0].indexOf(">") + 1);
    console.log(`  Form[${i}] ${tag.slice(0, 200)}`);
    const inputs = [...f[1].matchAll(/<input[^>]*>/gi)].slice(0, 12).map((m) => m[0]);
    inputs.forEach((inp) => console.log(`    `, inp.slice(0, 200)));
  });

  // Find any anti-forgery / hidden inputs in the form
  const allHidden = [...r2.html.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)].map((m) => m[0]);
  console.log("\n  All hidden inputs in page:");
  allHidden.forEach((h) => console.log("    " + h.slice(0, 250)));

  // Compute target date
  const d = new Date();
  d.setDate(d.getDate() - 5);
  const targetDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

  console.log(`\nStep 3: POST search with RecordDate=${targetDate}...`);
  const r3 = await sess.postForm("https://or.duvalclerk.com/search/SearchTypeRecordDate?Length=6", {
    RecordDate: targetDate,
  }, {
    "X-Requested-With": "XMLHttpRequest", // ASP.NET MVC AsyncForm typically expects this
    Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate",
  });
  console.log("  status:", r3.status, "html bytes:", r3.html.length);
  console.log("  title:", (r3.html.match(/<title>([^<]+)<\/title>/) || ["", "?"])[1].trim().slice(0, 60));

  // Look at the response structure
  const scripts = [...r3.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  console.log(`  Script blocks: ${scripts.length}`);

  // Look for hints about how results are loaded
  const ajaxHints = r3.html.match(/Sys\.Mvc[^"';]+|kendoGrid|\.ajax\(|getJSON|loadJSON|search\/\w+/gi) || [];
  console.log(`  AJAX hints (first 8):`);
  ajaxHints.slice(0, 8).forEach((h) => console.log(`    ${h.slice(0, 100)}`));

  // Look for any URLs referencing search results or grids
  const interestingUrls = [...r3.html.matchAll(/(?:href|src|action|url|Url)\s*=\s*["']([^"']+search[^"']*)["']/gi)].map((m) => m[1]);
  console.log(`  Search URLs in response (first 10):`);
  interestingUrls.slice(0, 10).forEach((u) => console.log(`    ${u.slice(0, 120)}`));

  // Sample body around any "result" or "grid" or "loading" indicator
  const bodyText = r3.html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`\n  Body text first 800 chars:\n  ${bodyText.slice(0, 800)}`);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
