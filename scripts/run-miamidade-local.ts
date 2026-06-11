import { prisma } from "@/lib/prisma";
import {
  scrapeMiamiDadeCounty,
  type MdTokenSource,
} from "@/lib/scrapers/vendors/miamidade-records";

// ---------------------------------------------------------------------------
// Local verification runner for the M2.1d Miami-Dade official-records adapter
// (Family D bespoke — 12086 only). Persists Mortgage/Lien rows + reports the
// FOLIO→Parcel join-rate.
//
// USAGE:
//   DATABASE_URL=... npx tsx scripts/run-miamidade-local.ts
//     [--days 7] [--browser] [--proxy]
//     [--token <reCAPTCHA-v3-token>]   # one-shot operator-supplied token
//
// Defaults: trailing 7-day recording window, http transport, direct egress.
//   --browser : force the stealth-chromium path (self-mints a v3 token; only
//               works where the egress can load the SPA).
//   --proxy   : route through the residential proxy (NetScaler blocks the
//               DataImpulse pool on this dev machine — expect host-unreachable;
//               kept as a flag for Railway/alt-proxy experimentation).
//   --token   : inject a pre-minted reCAPTCHA v3 token (expires ~2 min).
//
// reCAPTCHA v3 is the gate: without a valid token the search returns
// {isValidSearch:false, qs:null} (outcome=captcha-required) and 0 rows persist.
// ---------------------------------------------------------------------------

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function ensureRegistryRow(): Promise<void> {
  const data = {
    domain: "onlineservices.miamidadeclerk.gov",
    countyFips: "12086" as string | null,
    state: "FL",
    scraperFn: "scrapeMiamiDadeCounty",
    cronExpr: "0 12 * * 3", // weekly Wednesdays — keep in sync with seed-scrape-registry.ts
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "none",
    notes:
      "Miami-Dade ORI (React SPA + JSON API, reCAPTCHA v3 gate). standardsearch → getStandardRecords → Mortgage/Lien upserts (source=scraper:miamidade-ori). FOLIO=13-digit apn → direct Parcel join. lastHighWaterMark = ISO date scraped through.",
  };
  await prisma.scrapeRegistry.upsert({
    where: { sourceKey: "miamidade-official-records" },
    create: {
      sourceKey: "miamidade-official-records",
      enabled: true,
      bootstrapping: true,
      ...data,
    },
    update: data,
  });
}

async function main() {
  await ensureRegistryRow();
  const days = parseInt(argValue("--days") ?? "7", 10);
  const forceBrowser = hasFlag("--browser");
  const useProxy = hasFlag("--proxy");
  const token = argValue("--token");
  const tokenSource: MdTokenSource = {};
  if (token) tokenSource.recaptchaToken = token;

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  console.log(
    `\n=== Miami-Dade (12086) — ${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)} | transport=${forceBrowser || !token ? "browser" : "http"} proxy=${useProxy} token=${token ? "injected" : "self-mint"} ===`,
  );

  const audit = await prisma.bulkIngestJob.create({
    data: {
      sourceTag: "scraper:miamidade-ori-12086",
      scope: "12086",
      status: "running",
      triggerType: "manual-script",
      sourceKey: "miamidade-official-records",
    },
  });
  const t0 = Date.now();
  try {
    const r = await scrapeMiamiDadeCounty({ from, to, useProxy, forceBrowser, tokenSource });
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: r.outcome === "ok" ? "succeeded" : "failed",
        recordsFetched: r.found,
        recordsUpserted: r.persistedMortgages + r.persistedLiens,
        rejectCount: r.rejected,
        errorMessage: r.outcome === "ok" ? null : `outcome=${r.outcome}`,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        runStatsJson: JSON.parse(JSON.stringify(r)),
      },
    });
    const joinable =
      r.apnJoin.directFolio + r.apnJoin.uniqueName + r.apnJoin.ambiguous + r.apnJoin.none;
    const joined = r.apnJoin.directFolio + r.apnJoin.uniqueName;
    console.log(`  outcome=${r.outcome} | found=${r.found} requests=${r.requests} docTypes=${r.docTypesSearched}`);
    console.log(`  byFamily: ${JSON.stringify(r.byFamily)}`);
    console.log(
      `  persisted: mortgages=${r.persistedMortgages} liens=${r.persistedLiens} | satisfactions applied=${r.satisfactionsApplied} skipped=${r.satisfactionsSkipped} | rejected=${r.rejected}`,
    );
    console.log(
      `  FOLIO join: direct=${r.apnJoin.directFolio} unique-name=${r.apnJoin.uniqueName} ambiguous=${r.apnJoin.ambiguous} none=${r.apnJoin.none} → ${joinable > 0 ? ((100 * joined) / joinable).toFixed(1) : "0"}% joined`,
    );
    if (r.outcome === "captcha-required") {
      console.log(
        `  ⚠ reCAPTCHA v3 gate: no valid token. Supply --token <t>, set MIAMIDADE_RECAPTCHA_TOKEN, or run --browser from egress that can load the SPA.`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.bulkIngestJob.update({
      where: { id: audit.id },
      data: {
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
      },
    });
    console.error(`  FAILED: ${message}`);
  }

  // Post-run DB verification: persisted rows + FOLIO join rate per table.
  const mtg = await prisma.$queryRaw<
    Array<{ n: number; with_apn: number; min_d: Date | null; max_d: Date | null }>
  >`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn,
           MIN("recordingDate") AS min_d, MAX("recordingDate") AS max_d
    FROM flipops."Mortgage" WHERE source = 'scraper:miamidade-ori'`;
  for (const r of mtg) {
    console.log(
      `\nMortgage source='scraper:miamidade-ori': n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%) range=${r.min_d?.toISOString().slice(0, 10) ?? "-"}..${r.max_d?.toISOString().slice(0, 10) ?? "-"}`,
    );
  }
  const liens = await prisma.$queryRaw<
    Array<{ lienCategory: string; n: number; with_apn: number }>
  >`
    SELECT "lienCategory", COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE apn IS NOT NULL)::int AS with_apn
    FROM flipops."Lien" WHERE source = 'scraper:miamidade-ori'
    GROUP BY "lienCategory" ORDER BY "lienCategory"`;
  console.log(`Lien source='scraper:miamidade-ori':`);
  for (const r of liens) {
    console.log(
      `  ${r.lienCategory.padEnd(12)} n=${r.n} apn=${r.with_apn} (${((100 * r.with_apn) / Math.max(1, r.n)).toFixed(1)}%)`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
