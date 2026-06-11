import { prisma } from "@/lib/prisma";
import {
  LANDMARK_COUNTIES,
  findLandmarkCounty,
  mintLandmarkSession,
  landmarkShowCaptcha,
  searchLandmarkByRecordDate,
  searchLandmarkByParcelId,
  type LandmarkScrapeResult,
} from "@/lib/scrapers/vendors/landmark-records";
import { getCaptchaSolver, captchaSolverBalance } from "@/lib/scrapers/base/captcha-solver";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.1b LANDMARK family adapter.
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-landmark-local.ts
//                    [--county 12099]... [--days 7] [--parcel <APN>]
//                    [--token <g-recaptcha-response>] [--proxy]
//
// Defaults to all 3 Landmark counties (PB 12099, Lee 12071, Levy 12075) over a
// 7-day record-date window. For each county it:
//   1. mints the disclaimer session (landing GET + SetDisclaimer POST)
//   2. probes ShowCaptcha
//   3. runs a record-date sweep (and a parcel search if --parcel given)
//   4. reports persisted Mortgage/Lien rows + APN join-rate against Parcel
//
// reCAPTCHA: PB + Levy gate search behind reCAPTCHA v2. Pass a solved token via
// --token to actually persist rows; without it the runner reports
// outcome=captcha-required (the session/disclaimer/captcha-detect path is still
// exercised + verified). Levy is the small-county reuse proof — its rows are
// reported explicitly.
// ---------------------------------------------------------------------------

function argValues(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

async function apnJoinRate(countyFips: string, source: string): Promise<{ withApn: number; joined: number; total: number }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number; with_apn: number; joined: number }>>(
    `SELECT
       (SELECT COUNT(*) FROM flipops."Mortgage" WHERE "countyFips"=$1 AND source=$2)::int
       + (SELECT COUNT(*) FROM flipops."Lien" WHERE "countyFips"=$1 AND source=$2)::int AS total,
       (SELECT COUNT(*) FROM flipops."Mortgage" WHERE "countyFips"=$1 AND source=$2 AND apn IS NOT NULL)::int
       + (SELECT COUNT(*) FROM flipops."Lien" WHERE "countyFips"=$1 AND source=$2 AND apn IS NOT NULL)::int AS with_apn,
       (SELECT COUNT(*) FROM flipops."Mortgage" m WHERE m."countyFips"=$1 AND m.source=$2 AND m.apn IS NOT NULL
          AND EXISTS (SELECT 1 FROM flipops."Parcel" p WHERE p."countyFips"=m."countyFips" AND p.apn=m.apn))::int
       + (SELECT COUNT(*) FROM flipops."Lien" l WHERE l."countyFips"=$1 AND l.source=$2 AND l.apn IS NOT NULL
          AND EXISTS (SELECT 1 FROM flipops."Parcel" p WHERE p."countyFips"=l."countyFips" AND p.apn=l.apn))::int AS joined`,
    countyFips, source,
  );
  const r = rows[0] ?? { total: 0, with_apn: 0, joined: 0 };
  return { total: r.total, withApn: r.with_apn, joined: r.joined };
}

async function main() {
  const countyArgs = argValues("--county");
  const days = parseInt(argValues("--days")[0] ?? "7", 10);
  const parcel = argValues("--parcel")[0];
  const token = argValues("--token")[0];
  // --solve uses the configured 2captcha-class solver (TWOCAPTCHA_API_KEY) to
  // mint tokens automatically. Mutually exclusive with --token (one-shot).
  const solveRecaptcha = process.argv.includes("--solve") ? getCaptchaSolver() : undefined;
  const useProxy = process.argv.includes("--proxy") ? true : undefined;
  const fipsList = countyArgs.length > 0 ? countyArgs : LANDMARK_COUNTIES.map((c) => c.countyFips);

  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const beginDate = new Date(endDate);
  beginDate.setUTCDate(beginDate.getUTCDate() - (days - 1));

  if (solveRecaptcha) {
    const bal = await captchaSolverBalance();
    console.log(`captcha solver: ENABLED (TWOCAPTCHA_API_KEY)${bal !== null ? ` · balance $${bal.toFixed(2)}` : ""}`);
  } else if (process.argv.includes("--solve")) {
    console.warn("--solve passed but TWOCAPTCHA_API_KEY is not set — searches will report captcha-required.");
  }

  const summary: LandmarkScrapeResult[] = [];

  for (const fips of fipsList) {
    const county = findLandmarkCounty(fips);
    if (!county) { console.warn(`SKIP ${fips}: not a Landmark county`); continue; }
    console.log(`\n=== ${county.county} (${fips}) — ${county.host}${county.basePath} ===`);

    const sess = await mintLandmarkSession(county, { useProxy });
    if (!sess) {
      console.log(`  session mint FAILED (egress block — Lee datacenter timeout / Cloudflare 403)`);
      summary.push({
        countyFips: fips, county: county.county, searchKind: "record-date",
        outcome: "blocked", found: 0, persistedMortgages: 0, persistedLiens: 0, parcelIdRows: 0, httpStatus: 0,
      });
      continue;
    }
    console.log(`  session minted; cookies=[${sess.cookieHeader.split("; ").map((c) => c.split("=")[0]).join(",")}]`);

    const gated = await landmarkShowCaptcha(sess);
    const noTokenSource = !token && !solveRecaptcha;
    console.log(`  ShowCaptcha=${gated}${gated && noTokenSource ? "  (no --token / --solve → search will report captcha-required)" : ""}`);

    const rd = await searchLandmarkByRecordDate(sess, county, beginDate, endDate, { recaptchaToken: token, solveRecaptcha });
    console.log(`  RecordDateSearch [${rd.searchKind}] outcome=${rd.outcome} http=${rd.httpStatus} found=${rd.found} mtg=${rd.persistedMortgages} lien=${rd.persistedLiens}`);
    summary.push(rd);

    if (parcel) {
      const ps = await searchLandmarkByParcelId(sess, county, parcel, { recaptchaToken: token, solveRecaptcha });
      console.log(`  ParcelIdSearch(${parcel}) outcome=${ps.outcome} found=${ps.found} apnRows=${ps.parcelIdRows} mtg=${ps.persistedMortgages} lien=${ps.persistedLiens}`);
      summary.push(ps);
    }

    const jr = await apnJoinRate(fips, `scraper:landmark-${fips}`);
    const pct = jr.withApn > 0 ? ((jr.joined / jr.withApn) * 100).toFixed(1) : "n/a";
    console.log(`  persisted total=${jr.total} withApn=${jr.withApn} joinedToParcel=${jr.joined} (${pct}%)`);
  }

  console.log(`\n=== SUMMARY (window ${beginDate.toISOString().slice(0, 10)}..${endDate.toISOString().slice(0, 10)}) ===`);
  const countiesWithRows = new Set(summary.filter((s) => s.persistedMortgages + s.persistedLiens > 0).map((s) => s.countyFips));
  for (const s of summary) {
    console.log(`  ${s.county.padEnd(11)} ${s.searchKind.padEnd(12)} ${s.outcome.padEnd(16)} found=${s.found} persisted=${s.persistedMortgages + s.persistedLiens}`);
  }
  const levy = summary.find((s) => s.countyFips === "12075");
  console.log(`\nSmall-county reuse (Levy 12075): outcome=${levy?.outcome ?? "n/a"} found=${levy?.found ?? 0} persisted=${(levy?.persistedMortgages ?? 0) + (levy?.persistedLiens ?? 0)}`);
  console.log(`Counties with persisted rows: ${countiesWithRows.size}/${fipsList.length}`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
