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

  // Compute target date — 5 days back (clerks post 1-2 day lag)
  const d = new Date();
  d.setDate(d.getDate() - 5);
  const targetDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

  console.log(`\nStep 3: POST search via /search/SearchResults with RecordDate=${targetDate}...`);
  const r3 = await sess.postForm("https://or.duvalclerk.com/search/SearchResults", {
    RecordDate: targetDate,
  }, {
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate",
  });
  console.log("  status:", r3.status, "html bytes:", r3.html.length);
  console.log("  Body[0:300]:", r3.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300));

  console.log(`\nStep 4: GET /Search/HasResults...`);
  const r4 = await sess.get("https://or.duvalclerk.com/Search/HasResults");
  console.log("  status:", r4.status, "body:", r4.html.slice(0, 200));

  console.log(`\nStep 5: GET /Search/PartialGrid...`);
  const r5 = await sess.get("https://or.duvalclerk.com/Search/PartialGrid", { Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate" });
  console.log("  status:", r5.status, "html bytes:", r5.html.length);

  // Inspect the grid response
  const trs = [...r5.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  console.log(`  TR rows in PartialGrid: ${trs.length}`);
  const substantive = trs.filter((t) => {
    const text = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > 30 && /\d/.test(text);
  });
  console.log(`  Substantive rows: ${substantive.length}`);
  substantive.slice(0, 5).forEach((s, i) => {
    const text = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`    row[${i}]: ${text.slice(0, 250)}`);
  });

  if (substantive.length === 0) {
    console.log(`\n  Body text first 500 of PartialGrid:`);
    console.log(`  ${r5.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)}`);
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
