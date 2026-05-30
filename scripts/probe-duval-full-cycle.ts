/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";
import * as cheerio from "cheerio";

async function main() {
  const sess = new ClerkSession();

  console.log("Step 1: GET search page (establishes session)");
  await sess.get("https://or.duvalclerk.com/search/SearchTypeRecordDate");

  console.log("Step 2: POST disclaimer accept");
  await sess.postForm("https://or.duvalclerk.com/Search/Disclaimer?st=/search/SearchTypeRecordDate", {
    disclaimer: "true",
  });

  console.log("Step 3: POST search via /search/SearchTypeRecordDate?Length=6 (the form action)");
  const r3 = await sess.postForm(
    "https://or.duvalclerk.com/search/SearchTypeRecordDate?Length=6",
    {
      RecordDate: "5/22/2026",
      btnSearch: "Search",
    },
    {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate",
    },
  );
  console.log("  POST status:", r3.status, "bytes:", r3.html.length);
  // Look for any data hint
  const docNumPattern = /\b20\d{8,10}\b/.test(r3.html);
  console.log("  Has doc-number pattern:", docNumPattern);

  console.log("\nStep 4: GET /Search/HasResults");
  const r4 = await sess.get("https://or.duvalclerk.com/Search/HasResults");
  console.log("  HasResults body:", r4.html);

  console.log("\nStep 5: GET /Search/PartialGrid");
  const r5 = await sess.get("https://or.duvalclerk.com/Search/PartialGrid", { Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate" });
  console.log("  PartialGrid status:", r5.status, "bytes:", r5.html.length);

  // Parse for data rows
  const $ = cheerio.load(r5.html);
  const allRows = $("tr").toArray();
  console.log(`  Total <tr> elements: ${allRows.length}`);
  let dataRows = 0;
  for (const tr of allRows) {
    const text = $(tr).text().replace(/\s+/g, " ").trim();
    if (text.length > 20 && /\d/.test(text)) {
      if (dataRows < 5) {
        console.log(`    row: ${text.slice(0, 250)}`);
      }
      dataRows++;
    }
  }
  console.log(`  Data-like rows: ${dataRows}`);

  // Show body text
  const text = $.root().text().replace(/\s+/g, " ").trim();
  console.log(`\n  PartialGrid text [0:600]:\n  ${text.slice(0, 600)}`);
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
