/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Phase 2 probe — trigger the CSV download flow programmatically and capture:
//   - the actual request URL/method/body
//   - the response (CSV bytes if it returns inline, OR the "email me" handoff)
//
// This complements probe-hillsborough-csv.ts which only inspected the UI.
// ---------------------------------------------------------------------------
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import * as fs from "fs";
import * as path from "path";

const REPORTS_URL =
  "https://county-taxes.net/iframe-taxsys/hillsborough.county-taxes.com/govhub/reports/real-estate";

const DUMP_DIR = path.join(process.cwd(), "tmp", "probe-hillsborough-csv");

async function main() {
  console.log("=== Probe phase 2: trigger download_options('csv') and capture network ===\n");
  await fs.promises.mkdir(DUMP_DIR, { recursive: true });

  const sess = new PlaywrightSession({ engine: "stealth-chromium", headless: true });

  const requests: { method: string; url: string; postData?: string; resourceType: string }[] = [];
  const responses: { url: string; status: number; ct: string; cd: string; bodySize?: number }[] = [];
  const downloads: { suggestedFilename: string; url: string; path: string }[] = [];

  try {
    const page = await sess.newPage();

    // ---- network capture
    page.on("request", (req) => {
      const url = req.url();
      // Only record interesting endpoints to keep log small
      if (/csv|excel|xlsx|download|export|report|filetype/i.test(url) || req.method() !== "GET") {
        requests.push({
          method: req.method(),
          url,
          postData: req.postData() || undefined,
          resourceType: req.resourceType(),
        });
      }
    });
    page.on("response", async (resp) => {
      const url = resp.url();
      const ct = resp.headers()["content-type"] || "";
      const cd = resp.headers()["content-disposition"] || "";
      if (
        /csv|excel|xlsx|download|export|report/i.test(url) ||
        /csv|excel|xlsx|octet-stream/i.test(ct) ||
        cd.length > 0
      ) {
        responses.push({ url, status: resp.status(), ct, cd });
      }
    });
    // Browser-initiated file downloads
    page.on("download", async (dl) => {
      const fname = dl.suggestedFilename();
      const dest = path.join(DUMP_DIR, `downloaded-${Date.now()}-${fname}`);
      try {
        await dl.saveAs(dest);
        downloads.push({ suggestedFilename: fname, url: dl.url(), path: dest });
        console.log(`  DOWNLOAD captured: ${fname} (saved to ${dest})`);
      } catch (e) {
        console.log(`  DOWNLOAD save failed: ${(e as Error).message}`);
      }
    });

    // ---- step 1: navigate, click report
    await page.goto(REPORTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("a")).find((a) =>
        /Public - Delinquent Report/i.test(a.textContent || "")
      );
      if (t) (t as HTMLAnchorElement).click();
    });
    await page.waitForTimeout(6000);

    // ---- step 2: set search params
    await page.evaluate(() => {
      const ty = document.getElementById("tax_year") as HTMLInputElement;
      if (ty) ty.value = "all delinquent roll years";
      const rpp = document.querySelector('select[name="rows_per_page"], #rows_per_page') as HTMLSelectElement;
      if (rpp) rpp.value = "1000";
      const ft = document.getElementById("filetype") as HTMLSelectElement;
      if (ft) ft.value = "csv"; // explicitly request CSV format
    });

    // ---- step 3: run Search
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
      const t = btns.find((b) => /^Search$/i.test((b as HTMLElement).innerText?.trim() ?? ""));
      if (t) (t as HTMLButtonElement).click();
    });
    await page.waitForTimeout(15000);

    // ---- step 4: click the "Download (Text/CSV format)" button
    console.log("Clicking 'Download (Text/CSV format).' button...");
    const csvBtnClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const csvBtn = btns.find((b) => /download_options\(.?csv.?\)/i.test(b.getAttribute("onclick") || ""));
      if (csvBtn) {
        (csvBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    console.log(`  click result: ${csvBtnClicked}`);

    // wait for any dialog/modal to open
    await page.waitForTimeout(3000);

    // ---- step 5: see if a download-dialog is now open with a "Download" button
    const modalState = await page.evaluate(() => {
      const dlg = document.getElementById("download-dialog");
      return {
        present: !!dlg,
        ariaHidden: dlg?.getAttribute("aria-hidden"),
        classList: dlg?.className,
        displayStyle: dlg ? window.getComputedStyle(dlg).display : null,
      };
    });
    console.log(`  download dialog state:`, modalState);

    // ---- step 6: click the modal's main Download button (id="download-report")
    console.log("\nClicking modal's primary Download button (id=download-report)...");
    const dlBtnClicked = await page.evaluate(() => {
      const ft = document.getElementById("filetype") as HTMLSelectElement | null;
      if (ft) ft.value = "csv";
      const btn = document.getElementById("download-report") as HTMLButtonElement | null;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log(`  click result: ${dlBtnClicked}`);

    // wait for downloads or network calls
    await page.waitForTimeout(20000);

    // ---- step 7: summary
    console.log("\n=== Captured non-GET / interesting requests ===");
    requests.slice(0, 30).forEach((r, i) => {
      console.log(`  [${i}] ${r.method} ${r.url}`);
      if (r.postData && r.postData.length < 2000) console.log(`        body: ${r.postData}`);
      else if (r.postData) console.log(`        body: <${r.postData.length} bytes>`);
    });

    console.log("\n=== Captured responses (content-type / disposition hits) ===");
    responses.slice(0, 30).forEach((r, i) => {
      console.log(`  [${i}] [${r.status}] ct="${r.ct}" cd="${r.cd}"`);
      console.log(`        ${r.url}`);
    });

    console.log("\n=== Browser-initiated downloads ===");
    if (downloads.length === 0) {
      console.log("  none");
    } else {
      downloads.forEach((d, i) => {
        console.log(`  [${i}] ${d.suggestedFilename} -> ${d.path}`);
        console.log(`        URL: ${d.url}`);
        try {
          const stat = fs.statSync(d.path);
          console.log(`        size: ${stat.size} bytes`);
          const head = fs.readFileSync(d.path, "utf8").slice(0, 500);
          console.log(`        first 500 bytes:\n${head}`);
        } catch (e) {
          console.log(`        stat err: ${(e as Error).message}`);
        }
      });
    }

    // ---- step 8: if there's a "your download will start" or "timeout/email-only" message, capture it
    const finalHtml = await page.content();
    await fs.promises.writeFile(path.join(DUMP_DIR, "4-after-download-click.html"), finalHtml);
    const pageText = await page.evaluate(() => document.body.innerText || "");
    console.log("\n=== Page text after download click (first 2k chars) ===");
    console.log(pageText.slice(0, 2000));
  } catch (err) {
    console.error("PROBE FAILED:", (err as Error).message);
    console.error((err as Error).stack);
  } finally {
    await sess.close();
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
