/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";
import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

async function main() {
  const sess = new ClerkSession();
  await sess.get("https://or.duvalclerk.com/search/SearchTypeRecordDate");
  await sess.postForm("https://or.duvalclerk.com/Search/Disclaimer?st=/search/SearchTypeRecordDate", { disclaimer: "true" });

  const r = await sess.postForm("https://or.duvalclerk.com/search/SearchTypeRecordDate?Length=6", {
    RecordDate: "5/22/2026",
    btnSearch: "Search",
  }, {
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate",
  });
  writeFileSync("/tmp/duval-post-response.html", r.html);
  console.log("Wrote", r.html.length, "bytes to /tmp/duval-post-response.html");

  const $ = cheerio.load(r.html);
  // Find all elements with attribute containing "2026" + 8 digits (typical doc number)
  const docNumbers = (r.html.match(/\b202\d{8,10}\b/g) ?? []).slice(0, 20);
  console.log("Doc-number-like values in body:");
  docNumbers.forEach((d) => console.log(`  ${d}`));

  // Look for any element with class containing "row" or "data" or "result"
  const dataCells = $("[class*='row'], [class*='data'], [class*='result']").length;
  console.log("Cells with row/data/result class:", dataCells);

  // Inspect TABLE contents
  $("table").each((i, t) => {
    const id = $(t).attr("id") || "(none)";
    const cls = $(t).attr("class") || "(none)";
    const trCount = $(t).find("tr").length;
    console.log(`Table[${i}] id="${id}" class="${cls}" trs=${trCount}`);
    if (trCount > 1) {
      $(t).find("tr").each((j, tr) => {
        if (j < 3) console.log(`  tr[${j}]: ${$(tr).text().replace(/\s+/g, " ").trim().slice(0, 200)}`);
      });
    }
  });

  // Look for any inline data references — JSON in script tags?
  const scriptMatch = r.html.match(/<script[^>]*>[\s\S]*?(items|results|records)\s*[:=]\s*\[[\s\S]{0,500}\]/);
  if (scriptMatch) {
    console.log("\nInline data found in script:");
    console.log(scriptMatch[0].slice(0, 500));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
