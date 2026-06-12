import { prisma } from "@/lib/prisma";
import {
  PROBATE_MVC_COUNTIES,
  findProbateMvcCounty,
  mintProbateSession,
  searchProbateByDateRange,
  type ProbateScrapeResult,
} from "@/lib/scrapers/vendors/probate-mvc";
import { getCaptchaSolver, captchaSolverBalance } from "@/lib/scrapers/base/captcha-solver";
import { matchProbateCasesToParcels } from "./rescore-probate";

// ---------------------------------------------------------------------------
// Local verification runner for the M3.1 P-MVC probate family adapter.
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-probate-local.ts
//                    [--county 12095]... [--days 7]
//                    [--token <g-recaptcha-response>] [--solve] [--match]
//
// Defaults to all 3 P-MVC counties (Orange 12095, Pinellas 12103, Broward
// 12011) over a 7-day filing-date window. For each county it:
//   1. mints the ASP.NET-MVC session (landing GET → ASP.NET_SessionId + RVT)
//   2. runs an estate-admin date-range search
//   3. reports persisted ProbateCase rows + the per-portal outcome
//
// reCAPTCHA: all three portals gate the SUBMIT behind reCAPTCHA v2. Pass a
// solved token via --token, or --solve to use the configured 2captcha-class
// solver (TWOCAPTCHA_API_KEY). Without a token source the runner reports
// outcome=captcha-required — the session/RVT mint + parser path is still
// exercised + verified.
//
// --match additionally runs the decedent→owner fuzzy join (matchProbateCasesToParcels)
// after scraping so you can eyeball EXACT/STRONG/WEAK tier counts.
// ---------------------------------------------------------------------------

function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

async function main() {
  const countyArgs = argValues("--county");
  const days = parseInt(argValues("--days")[0] ?? "7", 10);
  const token = argValues("--token")[0];
  const solveRecaptcha = process.argv.includes("--solve") ? getCaptchaSolver() : undefined;
  const fipsList = countyArgs.length > 0 ? countyArgs : PROBATE_MVC_COUNTIES.map((c) => c.countyFips);

  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const beginDate = new Date(endDate);
  beginDate.setUTCDate(beginDate.getUTCDate() - (days - 1));

  if (solveRecaptcha) {
    const bal = await captchaSolverBalance();
    console.log(`captcha solver: ENABLED (TWOCAPTCHA_API_KEY)${bal !== null ? ` · balance $${bal.toFixed(2)}` : ""}`);
  } else if (process.argv.includes("--solve")) {
    console.warn("--solve passed but TWOCAPTCHA_API_KEY is not set — searches will report captcha-required.");
  } else if (!token) {
    console.log("no --token / --solve → searches will report captcha-required (session/RVT/parser path still verified).");
  }

  const summary: ProbateScrapeResult[] = [];

  for (const fips of fipsList) {
    const county = findProbateMvcCounty(fips);
    if (!county) { console.warn(`SKIP ${fips}: not a P-MVC county`); continue; }
    console.log(`\n=== ${county.county} (${fips}) — ${county.host}${county.basePath} ===`);

    const sess = await mintProbateSession(county);
    if (!sess) {
      console.log(`  session mint FAILED (egress block / host unreachable)`);
      summary.push({ countyFips: fips, county: county.county, outcome: "blocked", found: 0, persisted: 0, httpStatus: 0 });
      continue;
    }
    console.log(
      `  session minted; cookies=[${sess.cookieHeader.split("; ").map((c) => c.split("=")[0]).filter(Boolean).join(",")}] rvt=${sess.rvt ? sess.rvt.slice(0, 12) + "…" : "MISSING"}`,
    );

    const res = await searchProbateByDateRange(sess, county, beginDate, endDate, { recaptchaToken: token, solveRecaptcha });
    console.log(`  DateRangeSearch outcome=${res.outcome} http=${res.httpStatus} found=${res.found} persisted=${res.persisted}`);
    summary.push(res);
  }

  console.log(`\n=== SUMMARY (window ${beginDate.toISOString().slice(0, 10)}..${endDate.toISOString().slice(0, 10)}) ===`);
  const countiesWithRows = new Set(summary.filter((s) => s.persisted > 0).map((s) => s.countyFips));
  for (const s of summary) {
    console.log(`  ${s.county.padEnd(9)} ${s.outcome.padEnd(16)} found=${s.found} persisted=${s.persisted}`);
  }
  console.log(`Counties with persisted rows: ${countiesWithRows.size}/${fipsList.length}`);

  if (process.argv.includes("--match")) {
    console.log(`\n=== decedent→owner fuzzy join ===`);
    for (const fips of fipsList) {
      const m = await matchProbateCasesToParcels({ countyFips: fips });
      console.log(`  ${fips}  scanned=${m.scanned} EXACT=${m.exact} STRONG=${m.strong} WEAK=${m.weak} NONE=${m.none}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
