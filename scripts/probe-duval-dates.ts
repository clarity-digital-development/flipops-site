/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";
import * as cheerio from "cheerio";

const dates = ["5/22/2026", "5/21/2026", "5/20/2026", "5/19/2026", "5/15/2026", "5/14/2026", "5/13/2026", "5/8/2026"];

async function tryDate(date: string): Promise<{ date: string; rowCount: number; hasResults: string; bytes: number }> {
  const sess = new ClerkSession();
  await sess.get("https://or.duvalclerk.com/search/SearchTypeRecordDate");
  await sess.postForm("https://or.duvalclerk.com/Search/Disclaimer?st=/search/SearchTypeRecordDate", { disclaimer: "true" });
  await sess.postForm("https://or.duvalclerk.com/search/SearchTypeRecordDate?Length=6", { RecordDate: date, btnSearch: "Search" }, {
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://or.duvalclerk.com/search/SearchTypeRecordDate",
  });
  const hr = await sess.get("https://or.duvalclerk.com/Search/HasResults");
  const pg = await sess.get("https://or.duvalclerk.com/Search/PartialGrid");
  const $ = cheerio.load(pg.html);
  // Find data rows — look in tbody, k-grid-content tr, etc.
  const allRowsWithDigits = $("tr").filter((_, tr) => {
    const text = $(tr).text();
    return text.length > 30 && /\d{6,}/.test(text); // 6+ consecutive digits = doc number
  }).length;
  // Also check the body text for "No items to display"
  const txt = $.root().text();
  const noItems = /No items to display/.test(txt);
  const items = txt.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)/); // "1 - 50 of 1234" pattern
  return {
    date,
    rowCount: allRowsWithDigits,
    hasResults: hr.html.trim(),
    bytes: pg.html.length,
    // @ts-expect-error - dynamic extra field
    summary: items ? `${items[0]}` : (noItems ? "No items" : "(unclear)"),
  };
}

async function main() {
  for (const date of dates) {
    try {
      const r = await tryDate(date);
      console.log(`  ${date.padEnd(11)} → HasResults=${r.hasResults} | grid=${r.bytes}b | dataRows=${r.rowCount}  // @ts-expect-error
        ${(r as any).summary}`);
    } catch (e) {
      console.log(`  ${date.padEnd(11)} → ERROR ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
