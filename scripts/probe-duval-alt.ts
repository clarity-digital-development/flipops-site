/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";

// Try alternate endpoints based on Acclaim platform patterns + script
// references found in AcclaimSearchPages.js: SearchResults, PartialGrid,
// SearchResultsPrint, HasResults, ClearResults, ExportSearchResults

async function main() {
  const sess = new ClerkSession();
  console.log("=== Setting up session ===");
  await sess.get("https://or.duvalclerk.com/search/SearchTypeRecordDate");
  await sess.postForm("https://or.duvalclerk.com/Search/Disclaimer?st=/search/SearchTypeRecordDate", { disclaimer: "true" });
  await sess.postForm("https://or.duvalclerk.com/search/SearchTypeRecordDate", { RecordDate: "5/22/2026" });
  console.log("  session setup + search submitted");

  console.log("\n=== Probe results endpoints ===");
  const endpoints = [
    "/Search/HasResults",
    "/Search/PartialGrid",
    "/Search/PartialGrid?Length=6",
    "/search/SearchResults",
    "/Search/SearchResults",
    "/search/SearchResultsPrint",
    "/Search/SearchResultsPrint",
    "/Search/SearchTypeRecordDate?Length=6",
    "/Search/ExportSearchResults",
    "/Search/ExportSearchResultsToCSV",
    "/Search/GridData",
    "/Search/Grid",
  ];
  for (const ep of endpoints) {
    try {
      const r = await sess.get(`https://or.duvalclerk.com${ep}`);
      const text = r.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const trs = (r.html.match(/<tr[^>]*>/gi) ?? []).length;
      const hasDocNum = /\b20[0-9]{2}\d{6}\b/.test(text); // typical FL doc number pattern YYYY######
      console.log(`  ${ep.padEnd(45)} → ${r.status}  ${r.html.length.toString().padStart(6)}b  trs=${trs}  docNumPattern=${hasDocNum}`);
      if (hasDocNum && trs > 0) {
        console.log(`    ⭐ THIS LOOKS LIKE A RESULTS ENDPOINT!`);
        console.log(`    text[0:400]: ${text.slice(0, 400)}`);
      }
    } catch (e) {
      console.log(`  ${ep} → ERROR ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
