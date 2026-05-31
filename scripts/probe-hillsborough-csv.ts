/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Probe — does the Hillsborough TaxSys "Public - Delinquent Report" (id 2470)
// expose a CSV export / Download Search Results button?
//
// If YES → we can drop the 26-min HTML scrape to <2 min (Phase 4 win).
// If NO  → confirm via inspection so we don't waste time later.
//
// Read-only: NO writes to DB, NO production scraper changes.
// ---------------------------------------------------------------------------
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import * as fs from "fs";
import * as path from "path";

const REPORTS_URL =
  "https://county-taxes.net/iframe-taxsys/hillsborough.county-taxes.com/govhub/reports/real-estate";

const DUMP_DIR = path.join(process.cwd(), "tmp", "probe-hillsborough-csv");

async function ensureDumpDir() {
  await fs.promises.mkdir(DUMP_DIR, { recursive: true });
}

async function main() {
  console.log("=== Probe: Hillsborough TaxSys delinquent report — CSV export? ===\n");
  await ensureDumpDir();

  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });

  // Track every network response to catch any CSV/export endpoint hits
  const interestingUrls: { url: string; status: number; contentType: string }[] = [];

  try {
    const page = await sess.newPage();

    page.on("response", (resp) => {
      const url = resp.url();
      const ct = resp.headers()["content-type"] || "";
      const isInteresting =
        /\.csv($|\?)/i.test(url) ||
        /export|download|format=csv|fmt=csv/i.test(url) ||
        /text\/csv|application\/csv|application\/vnd\.ms-excel|application\/octet-stream/i.test(ct) ||
        /content-disposition/i.test(Object.keys(resp.headers()).join(",")) === false &&
          (resp.headers()["content-disposition"] || "").toLowerCase().includes("attachment");
      if (isInteresting) {
        interestingUrls.push({ url, status: resp.status(), contentType: ct });
      }
    });

    // ---- Step 1: Land on reports page
    console.log("Step 1: GET reports landing page...");
    await page.goto(REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(5000);
    const t1 = await page.title();
    console.log(`  title: ${t1}`);

    // Capture HTML of landing
    const landingHtml = await page.content();
    await fs.promises.writeFile(path.join(DUMP_DIR, "1-landing.html"), landingHtml);

    // Scan landing HTML for any "csv", "download", "export" hints
    const landingHints = scanForExportHints(landingHtml);
    console.log(`  landing CSV/export hints: ${landingHints.length}`);
    landingHints.slice(0, 10).forEach((h) => console.log(`    ${h}`));

    // ---- Step 2: Click "Public - Delinquent Report"
    console.log("\nStep 2: Click 'Public - Delinquent Report' link...");
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("a"));
      const target = els.find((a) => /Public - Delinquent Report/i.test(a.textContent || ""));
      if (target) {
        (target as HTMLAnchorElement).click();
        return true;
      }
      return false;
    });
    console.log(`  clicked? ${clicked}`);
    if (!clicked) {
      throw new Error("Could not find 'Public - Delinquent Report' link");
    }
    await page.waitForTimeout(6000);

    // ---- Step 3: Inspect the report FORM page (pre-search) for any export controls
    const formHtml = await page.content();
    await fs.promises.writeFile(path.join(DUMP_DIR, "2-form-page.html"), formHtml);
    const formTitle = await page.title();
    console.log(`  form page title: ${formTitle}`);

    const formHints = scanForExportHints(formHtml);
    console.log(`\n  Form page CSV/export hints: ${formHints.length}`);
    formHints.slice(0, 25).forEach((h) => console.log(`    ${h}`));

    // Inventory all <button>, <a>, <input type=submit>, <select> elements with their text/values
    const formControls = await page.evaluate(() => {
      const out: { tag: string; text: string; href?: string; id?: string; name?: string; type?: string; onclick?: string; classes?: string }[] = [];
      document.querySelectorAll("a, button, input[type=submit], input[type=button], select, [role=button]").forEach((el) => {
        const e = el as HTMLElement;
        const text = (e.innerText || (e as HTMLInputElement).value || e.getAttribute("aria-label") || "").trim().slice(0, 80);
        out.push({
          tag: e.tagName,
          text,
          href: e.getAttribute("href") || undefined,
          id: e.id || undefined,
          name: e.getAttribute("name") || undefined,
          type: e.getAttribute("type") || undefined,
          onclick: e.getAttribute("onclick")?.slice(0, 100) || undefined,
          classes: e.className?.toString().slice(0, 80) || undefined,
        });
      });
      return out;
    });
    console.log(`\n  Form page interactive controls: ${formControls.length}`);
    // Print any control whose text or attrs hint at csv/download/export/format
    const exporty = formControls.filter((c) => {
      const blob = JSON.stringify(c).toLowerCase();
      return /csv|export|download|spreadsheet|excel|xlsx|format|results/.test(blob);
    });
    console.log(`  controls matching export/csv/download keywords: ${exporty.length}`);
    exporty.forEach((c, i) =>
      console.log(`    [${i}] <${c.tag}> text="${c.text}" id="${c.id ?? ""}" name="${c.name ?? ""}" href="${c.href ?? ""}" onclick="${c.onclick ?? ""}"`)
    );

    // Inspect any select/dropdown on the form for a "format" or "output" option
    const selectors = formControls.filter((c) => c.tag === "SELECT");
    console.log(`\n  All <select> dropdowns on form page (${selectors.length}):`);
    for (const s of selectors) {
      const opts = await page.evaluate((sid) => {
        const sel = document.getElementById(sid as string) as HTMLSelectElement | null;
        if (!sel) {
          // Try by name
          const byName = document.querySelector(`select[name="${sid}"]`) as HTMLSelectElement | null;
          if (!byName) return [];
          return Array.from(byName.options).map((o) => `${o.value}: ${o.text}`);
        }
        return Array.from(sel.options).map((o) => `${o.value}: ${o.text}`);
      }, s.id || s.name || "");
      console.log(`    select[id=${s.id ?? ""}, name=${s.name ?? ""}]:`);
      opts.slice(0, 12).forEach((o) => console.log(`      ${o}`));
    }

    // ---- Step 4: Run the search to expose any results-page export controls
    console.log("\nStep 4: Run the search to reveal any results-page export controls...");
    await page.evaluate(() => {
      const tyInput = document.getElementById("tax_year") as HTMLInputElement;
      if (tyInput) tyInput.value = "all delinquent roll years";
      const rpp = document.querySelector('select[name="rows_per_page"], #rows_per_page') as HTMLSelectElement;
      if (rpp) rpp.value = "1000";
    });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find((b) => /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? ""));
      if (t) (t as HTMLButtonElement).click();
    });
    await page.waitForTimeout(15000);

    const resultsHtml = await page.content();
    await fs.promises.writeFile(path.join(DUMP_DIR, "3-results-page.html"), resultsHtml);

    const resultsHints = scanForExportHints(resultsHtml);
    console.log(`  Results page CSV/export hints: ${resultsHints.length}`);
    resultsHints.slice(0, 25).forEach((h) => console.log(`    ${h}`));

    // Inventory results-page controls
    const resultsControls = await page.evaluate(() => {
      const out: { tag: string; text: string; href?: string; id?: string; name?: string; onclick?: string; classes?: string }[] = [];
      document.querySelectorAll("a, button, input[type=submit], input[type=button], [role=button]").forEach((el) => {
        const e = el as HTMLElement;
        const text = (e.innerText || (e as HTMLInputElement).value || e.getAttribute("aria-label") || "").trim().slice(0, 80);
        out.push({
          tag: e.tagName,
          text,
          href: e.getAttribute("href") || undefined,
          id: e.id || undefined,
          name: e.getAttribute("name") || undefined,
          onclick: e.getAttribute("onclick")?.slice(0, 100) || undefined,
          classes: e.className?.toString().slice(0, 80) || undefined,
        });
      });
      return out;
    });

    const resultsExporty = resultsControls.filter((c) => {
      const blob = JSON.stringify(c).toLowerCase();
      return /csv|export|download|spreadsheet|excel|xlsx|save\s*as|results/.test(blob);
    });
    console.log(`\n  Results page controls matching export/csv/download: ${resultsExporty.length}`);
    resultsExporty.forEach((c, i) =>
      console.log(`    [${i}] <${c.tag}> text="${c.text}" id="${c.id ?? ""}" name="${c.name ?? ""}" href="${c.href ?? ""}" onclick="${c.onclick ?? ""}" classes="${c.classes ?? ""}"`)
    );

    // ---- Step 5: Try common TaxSys/Grant Street CSV URL patterns directly
    console.log("\nStep 5: Probing common TaxSys CSV URL patterns...");
    const currentUrl = page.url();
    console.log(`  current URL: ${currentUrl}`);

    // Common patterns: append .csv, format=csv, /csv, /export, etc.
    const baseUrl = currentUrl.split("?")[0];
    const queryStr = currentUrl.includes("?") ? currentUrl.split("?")[1] : "";
    const probes = [
      currentUrl + (queryStr ? "&" : "?") + "format=csv",
      currentUrl + (queryStr ? "&" : "?") + "fmt=csv",
      currentUrl + (queryStr ? "&" : "?") + "output=csv",
      currentUrl + (queryStr ? "&" : "?") + "export=csv",
      currentUrl + (queryStr ? "&" : "?") + "download=1",
      baseUrl + ".csv" + (queryStr ? "?" + queryStr : ""),
      baseUrl.replace(/\/$/, "") + "/csv" + (queryStr ? "?" + queryStr : ""),
      baseUrl.replace(/\/$/, "") + "/export" + (queryStr ? "?" + queryStr : ""),
      baseUrl.replace(/\/$/, "") + "/download" + (queryStr ? "?" + queryStr : ""),
    ];

    for (const p of probes) {
      try {
        const resp = await page.goto(p, { waitUntil: "domcontentloaded", timeout: 15_000 });
        const status = resp?.status() ?? 0;
        const ct = resp?.headers()["content-type"] || "";
        const cd = resp?.headers()["content-disposition"] || "";
        const len = resp?.headers()["content-length"] || "?";
        const isCsv = /text\/csv|application\/csv|vnd\.ms-excel|octet-stream/i.test(ct) || /csv/i.test(cd);
        console.log(`  ${isCsv ? "***" : "   "} [${status}] ct="${ct}" cd="${cd}" len=${len}`);
        console.log(`        ${p}`);
        if (isCsv) {
          const body = await resp!.body();
          const dest = path.join(DUMP_DIR, `csv-probe-${interestingUrls.length}-${status}.csv`);
          await fs.promises.writeFile(dest, body);
          console.log(`        --> SAVED ${body.length} bytes to ${dest}`);
        }
      } catch (err) {
        console.log(`  ERR  ${p}  ${(err as Error).message.slice(0, 80)}`);
      }
      await page.waitForTimeout(800);
    }

    // ---- Network log summary
    console.log(`\n  Network responses flagged as CSV/export during probe: ${interestingUrls.length}`);
    interestingUrls.slice(0, 15).forEach((u) => console.log(`    [${u.status}] ${u.contentType} :: ${u.url}`));

    // ---- Final verdict
    console.log("\n=== VERDICT ===");
    const hasExportControl = exporty.length > 0 || resultsExporty.length > 0;
    if (hasExportControl) {
      console.log("CSV EXPORT: AVAILABLE — see matching controls above.");
    } else if (interestingUrls.length > 0) {
      console.log("CSV EXPORT: UNCLEAR — flagged network responses but no UI control.");
    } else {
      console.log("CSV EXPORT: NOT FOUND — no export button on form page, no export button on results page,");
      console.log("            no CSV content-type observed in network, no common URL pattern returned CSV.");
    }
    console.log(`\nHTML dumps written to: ${DUMP_DIR}`);
  } catch (err) {
    console.error("PROBE FAILED:", (err as Error).message);
    console.error((err as Error).stack);
  } finally {
    await sess.close();
  }
}

/**
 * Scan raw HTML for any string containing csv/export/download/spreadsheet hints
 * and return the surrounding 80-char snippets.
 */
function scanForExportHints(html: string): string[] {
  const hints: string[] = [];
  const patterns = [
    /[^<>"']{0,40}(csv|export|download[^<>]{0,30}|spreadsheet|excel|xlsx|save\s*as)[^<>"']{0,40}/gi,
  ];
  for (const re of patterns) {
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const snip = m[0].replace(/\s+/g, " ").trim();
      if (snip.length < 4) continue;
      if (seen.has(snip.toLowerCase())) continue;
      seen.add(snip.toLowerCase());
      hints.push(snip);
      if (hints.length >= 50) return hints;
    }
  }
  return hints;
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
