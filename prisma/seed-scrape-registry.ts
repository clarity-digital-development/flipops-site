/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Seed the ScrapeRegistry with the 8 production scrapers + FL DOR statewide
// ingest. One row per (sourceKey, scraperFn) combination. Idempotent via the
// `sourceKey @unique` constraint — re-running this script updates existing rows
// with the latest config.
//
// scraperFn values resolve to dispatch-map keys (lib/scrapers/dispatch/ —
// added in Phase 2). Until adapters are in place, the registry rows exist as
// declarative config and the scheduler can be turned off via `enabled=false`.
//
// Initial seed defaults `enabled=true` for ALL rows so Phase 1's boot-time
// JobScheduler picks them up immediately once worker-bullmq is provisioned.
// To stage rollout, set specific rows enabled=false post-seed.
// ---------------------------------------------------------------------------

interface RegistrySeed {
  sourceKey: string;
  domain: string;
  countyFips: string | null;
  state: string;
  scraperFn: string;
  cronExpr: string;
  strategy: "full" | "incremental-date" | "incremental-id" | "snapshot-diff" | "head-check";
  seasonStartMonth?: number;
  seasonEndMonth?: number;
  legalRisk: "green" | "yellow" | "red";
  rateLimitMs: number;
  priority?: number;
  proxyMode?: "none" | "bd-on" | "bd-rotate";
  notes: string;
  enabled?: boolean;
}

const SEEDS: RegistrySeed[] = [
  // -------------------------------------------------------------------------
  // FL DOR statewide bulk ingest — quarterly head-check on file mtime.
  // Different cadence + mechanics from the per-county scrapers; runs in its
  // own bulk-ingest queue so the 150-min job doesn't block other domains.
  // -------------------------------------------------------------------------
  {
    sourceKey: "fl-dor-statewide-nal-sdf",
    domain: "floridarevenue.com",
    countyFips: null,
    state: "FL",
    scraperFn: "ingestFlDorStatewide",
    cronExpr: "0 0 1 1,4,7,10 *", // 1st of Jan/Apr/Jul/Oct
    strategy: "head-check",
    legalRisk: "green",
    rateLimitMs: 5000,
    proxyMode: "none",
    notes: "Annual property roll release; head-check file mtime monthly; re-ingest only when changed.",
  },

  // -------------------------------------------------------------------------
  // LANDMARK family Official Records — Palm Beach + Lee + Levy (one adapter,
  // many counties). Daily, incremental by date. legalRisk yellow.
  // NOTE: PB + Levy gate search behind reCAPTCHA v2 (verified 2026-06-10) —
  // enabled=false until a token source (LANDMARK_RECAPTCHA_TOKEN env / solver)
  // is wired, so the scheduler doesn't spin on a captcha wall.
  // -------------------------------------------------------------------------
  {
    sourceKey: "landmark-official-records",
    domain: "landmarkweb",
    countyFips: null, // multi-county; adapter enumerates PB/Lee/Levy internally
    state: "FL",
    scraperFn: "runLandmarkOfficialRecords",
    cronExpr: "0 7 * * *", // 7 AM ET daily (after duval-clerk 6 AM slot)
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none", // PB+Levy direct; Lee flips to proxy per-county in code
    enabled: false,
    notes: "Pioneer/Granicus Landmark Web ORI. SetDisclaimer session gate + form-POST search → Mortgage/Lien. reCAPTCHA v2 on search (PB+Levy verified) — needs LANDMARK_RECAPTCHA_TOKEN/solver before enable. Lee = proxy egress.",
  },

  // -------------------------------------------------------------------------
  // Duval clerk recordings — daily, incremental by date (already in shape).
  // -------------------------------------------------------------------------
  {
    sourceKey: "duval-clerk-recordings",
    domain: "duvalclerk.com",
    countyFips: "12031",
    state: "FL",
    scraperFn: "scrapeDuvalRecordings",
    cronExpr: "0 6 * * *", // 6 AM ET daily
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "bd-on",
    notes: "Date-paramaterized; lastHighWaterMark = ISO date of last scraped day. First run = today-5d.",
  },

  // -------------------------------------------------------------------------
  // RealAuction 16-county foreclosure + tax-deed calendars.
  // Staggered across morning hours to avoid 16 concurrent stealth-chromium.
  // -------------------------------------------------------------------------
  {
    sourceKey: "realauction-fl-foreclosures",
    domain: "realauction.com",
    countyFips: null, // multi-county; adapter enumerates internally
    state: "FL",
    scraperFn: "scrapeRealAuctionsAll",
    cronExpr: "0,15,30,45 6-9 * * *", // 16 slots across 6-10 AM
    strategy: "snapshot-diff",
    legalRisk: "green",
    rateLimitMs: 2500,
    proxyMode: "bd-on",
    notes: "16 counties × 3 tracks; adapter staggers internally. Public PREVIEW URL bypasses splash.",
  },

  // -------------------------------------------------------------------------
  // RealTaxDeed 29-county tax-deed sale calendars (M2.2). Calendar-first
  // adapter — reads each county's auction calendar, then XHRs only the dates
  // that have sales. Direct egress (RealAuction WAF 403s DataImpulse).
  // -------------------------------------------------------------------------
  {
    sourceKey: "realtaxdeed-fl-tax-deeds",
    domain: "realtaxdeed.com",
    countyFips: null, // multi-county; adapter enumerates internally
    state: "FL",
    scraperFn: "scrapeRealTaxDeedAll",
    cronExpr: "0 11 * * *", // 7 AM ET daily (after the realauction morning slots)
    strategy: "snapshot-diff",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none",
    notes: "29 counties; tax-deed sale rows → Foreclosure stageCode=TAX_DEED source=realtaxdeed. Cookie+XHR+macro path shared with realauction.",
  },

  // -------------------------------------------------------------------------
  // Acclaim/AcclaimWeb official-records family (M2.1a) — Duval + Broward
  // mortgages/liens/LP/judgments via disclaimer-cookie + GridResults JSON.
  // Weekly to start; trailing-30d window on first run, then incremental with
  // 3-day overlap. Direct egress both counties (verified 2026-06-10).
  // -------------------------------------------------------------------------
  {
    sourceKey: "acclaim-official-records",
    domain: "officialrecords.broward.org",
    countyFips: null, // multi-county; adapter enumerates ACCLAIM_COUNTIES
    state: "FL",
    scraperFn: "scrapeAcclaimCounty",
    cronExpr: "0 12 * * 2", // 8 AM ET Tuesdays — weekly to start (M2.1a)
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "none",
    notes: "Acclaim ORI family: doc-type+date-range search → Mortgage/Lien upserts (source=scraper:acclaim-ori) + satisfaction release-matching. lastHighWaterMark = ISO date scraped through.",
  },

  // -------------------------------------------------------------------------
  // Top-6 metros tax-delinquent — full snapshot-diff monthly.
  // -------------------------------------------------------------------------
  {
    sourceKey: "duval-tax-delinquent",
    domain: "jaxdailyrecord.com",
    countyFips: "12031",
    state: "FL",
    scraperFn: "scrapeDuvalTaxDelinquent",
    cronExpr: "0 4 1 * *", // 4 AM ET first of month
    strategy: "snapshot-diff",
    legalRisk: "yellow",
    rateLimitMs: 1500,
    proxyMode: "none",
    notes: "Newspaper publishes current state; full re-scrape monthly catches redemptions.",
  },
  {
    sourceKey: "hillsborough-tax-delinquent",
    domain: "county-taxes.net",
    countyFips: "12057",
    state: "FL",
    scraperFn: "scrapeHillsboroughTaxDelinquent",
    cronExpr: "0 4 2 * *", // 4 AM ET second of month (offset from duval)
    strategy: "snapshot-diff",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "bd-on",
    notes: "TaxSys iframe via stealth-chromium; address-bridge join (88.9%). Phase 4 = batch persist.",
  },
  {
    sourceKey: "orange-tax-delinquent",
    domain: "lienhub.com",
    countyFips: "12095",
    state: "FL",
    scraperFn: "scrapeOrangeTaxDelinquent",
    cronExpr: "0 4 * * 1", // 4 AM ET Mondays during season
    strategy: "full",
    seasonStartMonth: 4, // April
    seasonEndMonth: 7, // through July
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "bd-on",
    notes: "Annual cert-sale advertised list. Idle Aug-Mar (seasonStart/End enforces).",
  },
  {
    sourceKey: "broward-tax-delinquent",
    domain: "lienhub.com",
    countyFips: "12011",
    state: "FL",
    scraperFn: "scrapeBrowardTaxDelinquent",
    cronExpr: "0 5 1 * *", // 4 AM ET monthly (cycle-dependent count)
    strategy: "full",
    legalRisk: "yellow",
    rateLimitMs: 2000,
    proxyMode: "bd-on",
    notes: "County-held certs; small dataset year-round, balloons after June cert sale.",
  },
  {
    sourceKey: "miami-dade-tax-delinquent",
    domain: "miamidade.gov",
    countyFips: "12086",
    state: "FL",
    scraperFn: "scrapeMiamiDadeTaxDelinquent",
    cronExpr: "0 4 * * 1", // weekly Monday during May
    strategy: "head-check",
    seasonStartMonth: 5, // May only (3-week mandatory publication)
    seasonEndMonth: 6,
    legalRisk: "green",
    rateLimitMs: 5000,
    proxyMode: "none",
    notes: "Static PDF; head-check URL pattern weekly during May. Auto-discovers latest weekly notice.",
  },
  {
    sourceKey: "palm-beach-tax-delinquent",
    domain: "floridapublicnotices.com",
    countyFips: "12099",
    state: "FL",
    scraperFn: "scrapePalmBeachTaxDelinquent",
    cronExpr: "0 4 * * *", // daily — FPN updates as new notices file
    strategy: "incremental-date",
    legalRisk: "green",
    rateLimitMs: 1500,
    proxyMode: "none",
    notes: "FPN aggregator JSON API supports date-window queries. Narrow slice: tax-deed apps only.",
  },
];

async function main() {
  console.log("=== Seeding ScrapeRegistry ===\n");
  let inserted = 0;
  let updated = 0;

  for (const seed of SEEDS) {
    const existing = await prisma.scrapeRegistry.findUnique({
      where: { sourceKey: seed.sourceKey },
    });

    const data = {
      domain: seed.domain,
      countyFips: seed.countyFips ?? null,
      state: seed.state,
      scraperFn: seed.scraperFn,
      cronExpr: seed.cronExpr,
      strategy: seed.strategy,
      enabled: seed.enabled ?? true,
      bootstrapping: true, // initial seed always starts bootstrapping
      seasonStartMonth: seed.seasonStartMonth ?? null,
      seasonEndMonth: seed.seasonEndMonth ?? null,
      legalRisk: seed.legalRisk,
      rateLimitMs: seed.rateLimitMs,
      priority: seed.priority ?? 0,
      proxyMode: seed.proxyMode ?? "none",
      notes: seed.notes,
    };

    if (existing) {
      await prisma.scrapeRegistry.update({
        where: { sourceKey: seed.sourceKey },
        data,
      });
      updated++;
      console.log(`  UPDATED  ${seed.sourceKey}`);
    } else {
      await prisma.scrapeRegistry.create({
        data: { sourceKey: seed.sourceKey, ...data },
      });
      inserted++;
      console.log(`  CREATED  ${seed.sourceKey}`);
    }
  }

  console.log(`\nDone. ${inserted} created, ${updated} updated. Total seeds: ${SEEDS.length}.`);

  // Quick verification query
  const total = await prisma.scrapeRegistry.count();
  const enabled = await prisma.scrapeRegistry.count({ where: { enabled: true } });
  const byDomain = await prisma.$queryRaw<{ domain: string; n: bigint }[]>`
    SELECT domain, count(*)::bigint AS n FROM "ScrapeRegistry" GROUP BY domain ORDER BY n DESC`;
  console.log(`\nRegistry state: ${total} rows total, ${enabled} enabled`);
  console.log(`By domain:`);
  for (const row of byDomain) {
    console.log(`  ${row.domain.padEnd(35)} ${row.n}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
