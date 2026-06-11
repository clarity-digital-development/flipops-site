import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { politeFetch } from "@/lib/scrapers/base/http-client";
import { scrapeRealAuctionsPlaywright } from "@/lib/scrapers/vendors/realauction-playwright";
import { REALAUCTION_COUNTIES } from "@/lib/scrapers/vendors/realauction";

// ---------------------------------------------------------------------------
// LANE B5 post-fix verification: with per-(county, date) cookie minting,
// distinct auction dates must yield DISTINCT row sets (pre-fix, every date
// returned the splash date's rows — see .gstack/qa-reports/
// realauction-date-pinning-probe.md).
//
// For each county: discover 2 future foreclosure sale dates from the
// calendar, scrape both via the production vendor path (persists to DB —
// correct data), then DB-verify the persisted auctionDate split.
//
// USAGE: DATABASE_URL=... npx tsx scripts/verify-realauction-datefix-local.ts [fips ...]
// Defaults: 12057 (Hillsborough), 12011 (Broward).
// ---------------------------------------------------------------------------

const FIPS = process.argv.slice(2).length ? process.argv.slice(2) : ["12057", "12011"];

async function calendarDates(subdomain: string): Promise<string[]> {
  const out = new Set<string>();
  const now = new Date();
  for (let i = 0; i <= 1; i++) {
    const url =
      `https://${subdomain}.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR` +
      (i === 0
        ? ""
        : `&selCalDate=${encodeURIComponent(`{ts '${now.getUTCFullYear()}-${String(now.getUTCMonth() + 2).padStart(2, "0")}-01 00:00:00'}`)}`);
    const res = await politeFetch(url, {
      method: "GET",
      useProxy: false,
      rotateFingerprint: true,
      headers: { Accept: "text/html,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (res.status !== 200) continue;
    const $ = cheerio.load(await res.text());
    $("[dayid]").each((_, el) => {
      const dayid = ($(el).attr("dayid") ?? "").trim();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dayid)) return;
      if (!/foreclos/i.test($(el).text())) return;
      out.add(dayid);
    });
  }
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const toMs = (d: string) => {
    const [mm, dd, yy] = d.split("/").map(Number);
    return Date.UTC(yy, mm - 1, dd);
  };
  return [...out].filter((d) => toMs(d) > todayMs).sort((a, b) => toMs(a) - toMs(b));
}

const toIso = (mdy: string) => {
  const [mm, dd, yy] = mdy.split("/");
  return `${yy}-${mm}-${dd}`;
};

async function main() {
  for (const fips of FIPS) {
    const county = REALAUCTION_COUNTIES.find((c) => c.countyFips === fips);
    if (!county || !county.tracks.includes("foreclosure")) {
      console.warn(`SKIP ${fips}: not a wired foreclosure county`);
      continue;
    }
    console.log(`\n=== ${county.subdomain}.realforeclose.com (${fips}) ===`);
    const dates = await calendarDates(county.subdomain);
    if (dates.length < 2) {
      console.warn(`  only ${dates.length} future sale dates on calendar — skipping`);
      continue;
    }
    const [d1, d2] = [dates[0], dates[Math.min(2, dates.length - 1)]];
    console.log(`  scraping D1=${d1} and D2=${d2} (fresh jar per date post-fix)`);

    const founds: Record<string, number> = {};
    for (const d of [d1, d2]) {
      const r = await scrapeRealAuctionsPlaywright({ countyFips: fips, track: "foreclosure", auctionDate: d });
      founds[d] = r?.found ?? -1;
      console.log(`  ${d}: found=${r?.found} persistedForeclosures=${r?.persistedForeclosures}`);
      await new Promise((res) => setTimeout(res, 1500));
    }
    console.log(
      `  DISTINCT ROW SETS: found(${d1})=${founds[d1]} vs found(${d2})=${founds[d2]} -> ${founds[d1] !== founds[d2] ? "differ (PASS)" : "same count — checking case split below"}`,
    );

    const rows = await prisma.$queryRawUnsafe<Array<{ day: string; n: number; cases: string }>>(`
      SELECT "auctionDate"::date::text AS day, COUNT(*)::int AS n,
             STRING_AGG(DISTINCT "caseNumber", ', ' ORDER BY "caseNumber") AS cases
      FROM flipops."Foreclosure"
      WHERE "countyFips" = '${fips}'
        AND source = 'scraper:realauction-xhr-${fips}-foreclosure'
        AND "auctionDate"::date IN ('${toIso(d1)}', '${toIso(d2)}')
      GROUP BY 1 ORDER BY 1`);
    for (const r of rows) {
      console.log(`  DB ${r.day}: n=${r.n} cases=[${r.cases.length > 160 ? r.cases.slice(0, 160) + "..." : r.cases}]`);
    }
    const sets = rows.map((r) => new Set(r.cases.split(", ")));
    if (sets.length === 2) {
      const overlap = [...sets[0]].filter((c) => sets[1].has(c));
      console.log(`  case-set overlap between the two dates: ${overlap.length} (0 expected)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
