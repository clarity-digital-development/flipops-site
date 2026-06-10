/* eslint-disable no-console */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";

// ---------------------------------------------------------------------------
// Diagnostic probe: Grant Street TaxSys govhub public reports (M1.4).
//
// Drives a govhub /reports/real-estate page, clicks a named report link,
// runs a small search, and dumps the result table headers + sample rows.
// Used to verify column layouts BEFORE writing/changing parsers for the
// Broward + Hillsborough tax-delinquent scrapers.
//
// Usage:
//   npx tsx scripts/probe-taxsys-reports.ts <govhub-url> "<report-link-regex>"
// Examples:
//   npx tsx scripts/probe-taxsys-reports.ts \
//     https://broward.county-taxes.com/govhub/reports/real-estate "PUBLIC_BROWARD UNPAID REAL ESTATE"
//   npx tsx scripts/probe-taxsys-reports.ts \
//     https://hillsborough.county-taxes.com/govhub/reports/real-estate "Public - Certificates \\(Unpaid\\)"
// ---------------------------------------------------------------------------

async function main() {
  const [url, reportPattern] = process.argv.slice(2);
  if (!url || !reportPattern) {
    console.error("usage: npx tsx scripts/probe-taxsys-reports.ts <govhub-url> <report-link-regex>");
    process.exit(1);
  }

  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });
  try {
    const page = await sess.newPage();
    console.log(`[probe] goto ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4_000);

    const clicked = await page.evaluate((pat: string) => {
      const re = new RegExp(pat, "i");
      const a = Array.from(document.querySelectorAll("a")).find((el) => re.test(el.textContent || ""));
      if (a) { (a as HTMLAnchorElement).click(); return (a.textContent || "").trim(); }
      return null;
    }, reportPattern);
    if (!clicked) throw new Error(`report link not found for /${reportPattern}/i`);
    console.log(`[probe] clicked report link: "${clicked}"`);
    await page.waitForTimeout(6_000);

    // Dump the form fields the report exposes
    const formFields = await page.evaluate(() => {
      const fields: string[] = [];
      document.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
        const e = el as HTMLInputElement;
        if (e.type === "hidden") return;
        fields.push(`${e.tagName.toLowerCase()}[name=${e.getAttribute("name")}] value="${e.value}"${e.tagName === "SELECT" ? ` options=[${Array.from((e as unknown as HTMLSelectElement).options).map((o) => o.value).join("|")}]` : ""}`);
      });
      return fields;
    });
    console.log(`[probe] form fields:\n  ${formFields.join("\n  ")}`);

    // Run the search (keep default filters; just bump rows_per_page down)
    await page.evaluate(() => {
      const rpp = document.querySelector('select[name="rows_per_page"], #rows_per_page') as HTMLSelectElement | null;
      if (rpp) rpp.value = "50";
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find((b) => /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? ""));
      if (t) (t as HTMLButtonElement).click();
    });
    await page.waitForTimeout(15_000);

    const dump = await page.evaluate(() => {
      const text = document.body.innerText;
      const banner = text.match(/([\d,]+)\s+search results found/i)?.[0] ?? "(no results banner)";
      const tables: Array<{ headers: string[]; rows: string[][] }> = [];
      document.querySelectorAll("table").forEach((tbl) => {
        const headers = Array.from(tbl.querySelectorAll("thead th, tr:first-child th")).map((th) =>
          (th.textContent || "").replace(/\s+/g, " ").trim(),
        );
        if (!headers.length) return;
        const rows: string[][] = [];
        tbl.querySelectorAll("tbody tr").forEach((tr, i) => {
          if (i >= 3) return;
          rows.push(Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)));
        });
        tables.push({ headers, rows });
      });
      const hasCsv = !!document.querySelector("#filetype") ||
        Array.from(document.querySelectorAll("button")).some((b) => /download_options/.test(b.getAttribute("onclick") || ""));
      return { banner, tables, hasCsv };
    });

    console.log(`[probe] banner: ${dump.banner}`);
    console.log(`[probe] csv-download available: ${dump.hasCsv}`);
    for (const t of dump.tables) {
      console.log(`[probe] table headers: ${JSON.stringify(t.headers)}`);
      for (const r of t.rows) console.log(`[probe]   row: ${JSON.stringify(r)}`);
    }
  } finally {
    await sess.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
