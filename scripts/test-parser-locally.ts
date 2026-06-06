/* eslint-disable no-console */
// Test parseAuctionRows against a saved fixture to isolate the
// auctionDate-not-persisting bug to parser-vs-upsert.

import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const FIXTURES = [
  "scripts/probe-artifacts/realforeclose-pasco-2026-06-03.html",
  "scripts/probe-artifacts/realforeclose-duval-2026-06-03.html",
  "scripts/probe-artifacts/realforeclose-hillsborough-2026-06-03.html",
];

// Inline copy of parseAuctionRows for testing (saves importing the whole module)
function parseAuctionRows(html: string, requestedAuctionDate?: string) {
  const $ = cheerio.load(html);
  const items: Array<{ aid?: string; auctionStarts?: string; caseNumber?: string; parcelId?: string }> = [];
  $("div[id^='AITEM_']").each((_, item) => {
    const $item = $(item);
    const row: { aid?: string; auctionStarts?: string; caseNumber?: string; parcelId?: string } = {
      aid: $item.attr("aid"),
      auctionStarts: requestedAuctionDate,
    };
    $item.find("table.ad_tab > tbody > tr").each((_, tr) => {
      const $tr = $(tr);
      const label = $tr.find("td.AD_LBL").first().text().trim().replace(/:$/, "");
      if (!label) return;
      const $data = $tr.find("td.AD_DTA").first();
      const value = ($data.find("a").first().text().trim() || $data.text().trim()).trim();
      if (label === "Case #") row.caseNumber = value;
      if (label === "Parcel ID") row.parcelId = value;
    });
    if (row.caseNumber) items.push(row);
  });
  return items;
}

async function main() {
  for (const file of FIXTURES) {
    console.log(`\n=== ${file} ===`);
    try {
      const html = await readFile(file, "utf8");
      console.log(`html length: ${html.length}`);

      // Count AITEM_ divs
      const $ = cheerio.load(html);
      const aitemCount = $("div[id^='AITEM_']").length;
      console.log(`div[id^='AITEM_'] count: ${aitemCount}`);

      // Run parser with a fake requestedAuctionDate
      const rows = parseAuctionRows(html, "06/04/2026");
      console.log(`parser returned: ${rows.length} rows`);
      for (const r of rows.slice(0, 3)) {
        console.log(`  case=${r.caseNumber}  apn=${r.parcelId}  auctionStarts=${r.auctionStarts}`);
      }
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
