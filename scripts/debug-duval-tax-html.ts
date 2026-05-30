/* eslint-disable no-console */
import { ClerkSession } from "@/lib/scrapers/base/session-fetch";
import * as cheerio from "cheerio";

async function main() {
  const sess = new ClerkSession();
  await sess.get("https://legals.jaxdailyrecord.com/re_tax/retax_search.php");

  const url = "https://legals.jaxdailyrecord.com/re_tax/retax.php?mode=search&REnumber=&PropDesc=&Name=&incrementby=50&sort=SeqNo&start_round=0&submit=Search+RE";
  const resp = await sess.get(url);
  console.log("Response bytes:", resp.html.length);

  const $ = cheerio.load(resp.html);

  // Tables
  const tables = $("table").toArray();
  console.log(`\n${tables.length} tables found`);
  tables.forEach((t, i) => {
    const $t = $(t);
    const trs = $t.find("tr").length;
    const tds = $t.find("td").length;
    console.log(`  Table[${i}] trs=${trs} tds=${tds} firstRowText="${$t.find("tr").first().text().replace(/\s+/g, " ").trim().slice(0, 150)}"`);
  });

  // What if data is in DIV/SPAN structure?
  const matches = resp.html.match(/R\.E\.#\s*[\d-]+/g) ?? [];
  console.log(`\nRE# matches in raw HTML: ${matches.length}`);
  console.log("First 5 raw matches:", matches.slice(0, 5));

  // Dump a slice of HTML around the first RE# to see structure
  const idx = resp.html.indexOf("R.E.#");
  if (idx >= 0) {
    console.log(`\nHTML around first R.E.# (idx=${idx}):`);
    console.log(resp.html.slice(Math.max(0, idx - 200), idx + 2000));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
