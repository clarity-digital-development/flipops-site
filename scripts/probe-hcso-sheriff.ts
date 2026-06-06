/* eslint-disable no-console */
/**
 * Probe — Hillsborough County Sheriff's Office (Tampa) Arrest Inquiry
 *
 * Source: https://webapps.hcso.tampa.fl.us/arrestinquiry
 * Documented refresh: every 30 minutes (per HCSO public docs)
 * FIPS: 12057
 *
 * YELLOW-ZONE per feedback_scraping_risk_policy.md §5.1 — apply hardening:
 *   - realistic User-Agent (handled by PlaywrightSession default)
 *   - low concurrency (single page in this probe)
 *   - no rate hammering: AT MOST ~5 requests this probe
 *
 * Goals (read-only — NO DB writes):
 *  1. Determine access posture (direct GET vs JS-rendered vs search-form-gated)
 *  2. Capture URL structure for the public roster / today's bookings
 *  3. Identify the result-row schema (name, DOB, charges, bond, mugshot, bookingId, etc.)
 *  4. Identify pagination model (page param, scroll, date filter)
 *  5. Note anti-bot posture (Cloudflare, captcha, rate-limit headers)
 *  6. Capture verbatim HTML of ONE result row for schema designer
 *  7. Note §119.071 exempt-record handling at the source
 */
import { PlaywrightSession } from "@/lib/scrapers/base/playwright-session";
import { writeFileSync } from "fs";
import { join } from "path";

const BASE = "https://webapps.hcso.tampa.fl.us/arrestinquiry";
const ARTIFACT_DIR = join(process.cwd(), "scripts", "probe-artifacts");

function safeWrite(name: string, content: string) {
  try {
    writeFileSync(join(ARTIFACT_DIR, name), content, "utf8");
    console.log(`  artifact: scripts/probe-artifacts/${name} (${content.length} bytes)`);
  } catch (e) {
    console.log(`  [warn] could not write ${name}:`, (e as Error).message);
  }
}

async function main() {
  console.log("==== HCSO Arrest Inquiry Probe ====");
  console.log("Target:", BASE);
  console.log("Date:", new Date().toISOString());

  // -------- Step 1: simple curl-style fetch first ------------------------
  console.log("\n[1] Direct fetch (no browser)…");
  let directOk = false;
  let directStatus = 0;
  let directHeaders: Record<string, string> = {};
  let directBody = "";
  try {
    const resp = await fetch(BASE, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    directStatus = resp.status;
    resp.headers.forEach((v, k) => (directHeaders[k] = v));
    directBody = await resp.text();
    directOk = resp.ok;
    console.log(`  status: ${directStatus}, bytes: ${directBody.length}`);
    console.log(`  server: ${directHeaders["server"] || "(none)"}`);
    console.log(`  cf-ray: ${directHeaders["cf-ray"] || "(none)"}`);
    console.log(`  set-cookie: ${(directHeaders["set-cookie"] || "(none)").slice(0, 160)}`);
    console.log(
      `  title: ${(directBody.match(/<title[^>]*>([^<]+)<\/title>/i) || ["", "(none)"])[1].trim().slice(0, 100)}`,
    );
    const textOnly = directBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`  body preview (text-only, 280ch): ${textOnly.slice(0, 280)}`);
    safeWrite("hcso-direct-fetch.html", directBody);
  } catch (e) {
    console.log("  direct fetch FAILED:", (e as Error).message);
  }

  // Detect SPA / framework hints
  const isLikelySPA =
    directOk &&
    /(<div\s+id=["']root["'][^>]*>\s*<\/div>|<div\s+id=["']app["'][^>]*>\s*<\/div>|window\.__NEXT_DATA__|data-reactroot|ng-app|vue-router)/i.test(
      directBody,
    );
  const hasSearchForm = /<form[^>]+(arrest|booking|search)/i.test(directBody);
  console.log(`  heuristic — likely SPA: ${isLikelySPA}, has search form: ${hasSearchForm}`);

  // -------- Step 2: render with stealth-chromium --------------------------
  console.log("\n[2] Stealth Chromium render…");
  const sess = new PlaywrightSession({
    engine: "stealth-chromium",
    headless: true,
    navTimeoutMs: 45_000,
  });
  let renderedHtml = "";
  let finalUrl = "";
  const xhrLog: { url: string; method: string; status: number; ctype: string; size: number }[] = [];

  try {
    const page = await sess.newPage();

    // Capture XHR/fetch traffic — this is what reveals API endpoints + row JSON
    page.on("response", async (resp) => {
      try {
        const req = resp.request();
        const url = resp.url();
        const ctype = resp.headers()["content-type"] || "";
        const method = req.method();
        // Skip noise (assets, fonts, images, sourcemaps)
        if (/\.(png|jpg|jpeg|gif|svg|woff2?|ttf|css|map|ico)(\?|$)/i.test(url)) return;
        if (!/xhr|fetch|json|html|document|script/i.test(req.resourceType() + " " + ctype)) return;
        const buf = await resp.body().catch(() => Buffer.alloc(0));
        xhrLog.push({ url, method, status: resp.status(), ctype, size: buf.length });
      } catch {
        /* ignore */
      }
    });

    console.log(`  navigating ${BASE}…`);
    const navResp = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45_000 });
    finalUrl = page.url();
    console.log(`  nav status: ${navResp?.status()}, final URL: ${finalUrl}`);

    // give any deferred JS a moment to populate the grid
    await page.waitForTimeout(2500);

    renderedHtml = await page.content();
    console.log(`  rendered HTML bytes: ${renderedHtml.length}`);
    safeWrite("hcso-rendered.html", renderedHtml);

    // Try to detect a results grid / table by common patterns
    const detect = await page
      .evaluate(() => {
        const results: Record<string, unknown> = {};
        results.tableCount = document.querySelectorAll("table").length;
        results.trCount = document.querySelectorAll("tr").length;
        // Kendo grid?
        results.kendoGrid = !!document.querySelector(".k-grid, .k-grid-content");
        // DataTables?
        results.dataTables = !!document.querySelector(".dataTable, table.dataTable");
        // ag-Grid?
        results.agGrid = !!document.querySelector(".ag-root, .ag-row");
        // Generic card layout
        results.cards = document.querySelectorAll('[class*="card"], [class*="result"], [class*="row"]').length;
        // Look for an obvious form
        results.formCount = document.querySelectorAll("form").length;
        results.formActions = Array.from(document.querySelectorAll("form")).map((f) => f.getAttribute("action") || "");
        // Hints of pagination
        results.paginationHints = Array.from(
          document.querySelectorAll('a, button, [class*="page"], [class*="paginate"], nav'),
        )
          .map((el) => (el.textContent || "").trim())
          .filter((t) => /^(next|prev|page \d|»|‹|›|^\d+$)/i.test(t))
          .slice(0, 10);
        // Look for date inputs (suggests date-filter pagination)
        results.dateInputs = Array.from(document.querySelectorAll('input[type="date"], input[name*="date" i]'))
          .map((el) => (el as HTMLInputElement).name || (el as HTMLInputElement).id)
          .filter(Boolean);
        // Snapshot of headings — many sites use h1 "Arrest Inquiry" etc
        results.headings = Array.from(document.querySelectorAll("h1,h2,h3"))
          .map((el) => (el.textContent || "").trim())
          .filter(Boolean)
          .slice(0, 10);
        return results;
      })
      .catch((e) => ({ error: (e as Error).message }));
    console.log("  DOM detect:", JSON.stringify(detect, null, 2));

    // -------- Step 3: try to drive a search if there's a form ------------
    // Hillsborough's arrest inquiry is known to have a search form.
    // Conservative: submit with empty (or today's date) to see what comes back.
    console.log("\n[3] Attempting search submission (low-friction)…");
    const submitted = await page
      .evaluate(() => {
        const forms = Array.from(document.querySelectorAll("form"));
        if (forms.length === 0) return { ok: false, reason: "no form" };
        const f = forms[0] as HTMLFormElement;
        // Don't actually submit yet — return the form's input names so we know what's required.
        const inputs = Array.from(f.querySelectorAll("input, select, textarea")).map((el) => ({
          tag: el.tagName,
          name: (el as HTMLInputElement).name || "",
          id: (el as HTMLInputElement).id || "",
          type: (el as HTMLInputElement).type || "",
          value: (el as HTMLInputElement).value || "",
        }));
        return { ok: true, action: f.action, method: f.method, inputs };
      })
      .catch((e) => ({ ok: false, reason: (e as Error).message }));
    console.log("  form discovery:", JSON.stringify(submitted, null, 2));

    // If there's a "Search" button or submit input, click it — gives us a result page sample.
    // This is gentle (1 extra request) and necessary to see row schema.
    const clicked = await page
      .evaluate(() => {
        const candidates = Array.from(
          document.querySelectorAll(
            'input[type="submit"], button[type="submit"], button.search, button.btn-primary, button',
          ),
        ) as HTMLElement[];
        const target = candidates.find((el) => /search|submit|find|inquiry/i.test(el.textContent || (el as HTMLInputElement).value || ""));
        if (!target) return false;
        target.click();
        return true;
      })
      .catch(() => false);
    console.log(`  search button clicked: ${clicked}`);

    if (clicked) {
      try {
        await page.waitForLoadState("networkidle", { timeout: 25_000 });
      } catch {
        console.log("  (networkidle timeout — proceeding)");
      }
      await page.waitForTimeout(2_500);
      const afterSearchHtml = await page.content();
      safeWrite("hcso-after-search.html", afterSearchHtml);
      console.log(`  post-search HTML bytes: ${afterSearchHtml.length}`);

      const sample = await page
        .evaluate(() => {
          const rows: { html: string; text: string }[] = [];
          // Common result patterns
          document.querySelectorAll("table tbody tr").forEach((tr) => {
            const text = (tr.textContent || "").replace(/\s+/g, " ").trim();
            if (text.length > 20) rows.push({ html: tr.outerHTML, text });
          });
          // Card patterns (some sheriff sites use grid of card divs)
          if (rows.length === 0) {
            document.querySelectorAll('[class*="result"], [class*="record"], [class*="arrest"], [class*="inmate"]').forEach((el) => {
              const text = (el.textContent || "").replace(/\s+/g, " ").trim();
              if (text.length > 50 && text.length < 3000) rows.push({ html: el.outerHTML, text });
            });
          }
          return rows.slice(0, 3);
        })
        .catch((e) => ({ error: (e as Error).message }));
      console.log(`  candidate rows captured: ${Array.isArray(sample) ? sample.length : "ERR"}`);
      if (Array.isArray(sample)) {
        sample.forEach((r, i) => {
          console.log(`    row[${i}] text(220): ${r.text.slice(0, 220)}`);
          safeWrite(`hcso-row-${i}.html`, r.html);
        });
      }

      // Detect pagination markers in the post-search DOM
      const pag = await page
        .evaluate(() => {
          const out: Record<string, unknown> = {};
          out.urlAfter = location.href;
          out.kendoPager = !!document.querySelector(".k-pager-wrap, .k-pager");
          out.dataTablesPager = !!document.querySelector(".dataTables_paginate");
          out.nextLinks = Array.from(document.querySelectorAll('a, button'))
            .map((el) => ({ text: (el.textContent || "").trim().slice(0, 30), href: (el as HTMLAnchorElement).href || "" }))
            .filter((x) => /next|»|›/i.test(x.text))
            .slice(0, 5);
          out.totalCountLabel = (() => {
            const m = (document.body.textContent || "").match(/\b(?:found|total|displaying|showing)[^\n]{0,80}\b\d{1,5}\b/gi);
            return m ? m.slice(0, 4) : [];
          })();
          return out;
        })
        .catch((e) => ({ error: (e as Error).message }));
      console.log("  pagination detect:", JSON.stringify(pag, null, 2));
    }

    // -------- Step 4: dump XHR log ---------------------------------------
    console.log("\n[4] XHR / network log (probable API endpoints):");
    xhrLog.slice(0, 30).forEach((x) => {
      console.log(`  [${x.method}] ${x.status} ${x.ctype.slice(0, 30).padEnd(30)} ${x.size.toString().padStart(7)}B  ${x.url.slice(0, 120)}`);
    });
    safeWrite("hcso-xhr-log.json", JSON.stringify(xhrLog, null, 2));
  } catch (e) {
    console.log("  Playwright FAILED:", (e as Error).message);
  } finally {
    await sess.close();
  }

  console.log("\n==== Probe complete ====");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
