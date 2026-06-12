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
    // Self-activating: enabled only when a captcha solver is configured, so it
    // never burns solver credits (or 0-rows) without an explicit key present.
    enabled: !!(process.env.TWOCAPTCHA_API_KEY || process.env.CAPTCHA_SOLVER_API_KEY),
    notes: "Pioneer/Granicus Landmark Web ORI. SetDisclaimer session gate + form-POST search → Mortgage/Lien. reCAPTCHA v2 on search (PB+Levy verified) — solver hook wired (lib/scrapers/base/captcha-solver.ts); auto-enables when TWOCAPTCHA_API_KEY is set on the worker + this seed reruns. Lee = proxy egress.",
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
  // OnCore/Eagle official-records family (M2.1c) — Orange (12095) ORI.
  // SHIPS DISABLED: Orange's OnCore doc search migrated to Tyler's Self-Service
  // SPA (selfservice.or.occompt.com/ssweb); session mint verified but the SPA
  // search handshake is not yet replicable over plain HTTP (probe 2026-06-11:
  // 302 "options have changed" / POST server-error GUID). The whole downstream
  // pipeline (parse/classify/APN-join/persist) is complete + tested. Flip
  // enabled=true once the SPA transport (or stealth-chromium fallback) lands.
  // -------------------------------------------------------------------------
  {
    sourceKey: "oncore-official-records",
    domain: "selfservice.or.occompt.com",
    countyFips: null, // multi-county-ready; ONCORE_COUNTIES = Orange only today
    state: "FL",
    scraperFn: "scrapeOnCoreCounty",
    cronExpr: "0 13 * * 3", // 9 AM ET Wednesdays — weekly (offset from acclaim Tue)
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none", // Orange DIRECT (verified)
    enabled: false, // BLOCKED: SPA search transport not yet implemented
    notes: "OnCore/Eagle ORI (Orange). doc-type+date-range → Mortgage/Lien upserts (source=scraper:oncore-ori). DISABLED until Tyler Self-Service SPA search handshake (selfservice.or.occompt.com/ssweb) is replicable over HTTP or via stealth-chromium fallback — session mint works, search route 302/server-errors. Downstream pipeline complete + tested.",
  },

  // -------------------------------------------------------------------------
  // Miami-Dade official records (M2.1d Family-D bespoke) — 12086 ORI.
  // Vite React SPA + JSON API at /officialrecords/. reCAPTCHA v3 gate on
  // standardsearch: adapter self-mints a token via stealth-chromium
  // grecaptcha.execute (or MIAMIDADE_RECAPTCHA_TOKEN one-shot). The browser
  // path needs egress that can load the SPA — Railway egress is the place to
  // confirm. Ships enabled; degrades to outcome=captcha-required (0 rows,
  // logged) when the token is rejected rather than silently passing.
  // -------------------------------------------------------------------------
  {
    sourceKey: "miamidade-official-records",
    domain: "onlineservices.miamidadeclerk.gov",
    countyFips: "12086",
    state: "FL",
    scraperFn: "scrapeMiamiDadeCounty",
    cronExpr: "0 14 * * 4", // 10 AM ET Thursdays — weekly (offset from acclaim/oncore)
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none", // NetScaler blocks the residential pool; direct egress only
    notes: "Miami-Dade bespoke: Vite React SPA + JSON API (NOT ASP.NET WebForms — spec was stale). doc-type+date-range → Mortgage/Lien upserts (source=scraper:miamidade-ori) + satisfaction matching. reCAPTCHA v3 gate self-minted via stealth-chromium grecaptcha; MIAMIDADE_RECAPTCHA_TOKEN one-shot override. Verify the browser path on Railway egress.",
  },

  // -------------------------------------------------------------------------
  // Hillsborough official records (M2.1d Family-D) — 12057 ORI.
  // FILE-INGESTER, not a date-search scraper: ingests the FREE public bulk
  // index files (D=docs / P=parties / M=marginals) from
  // publicrec.hillsclerk.com/OfficialRecords/DailyIndexes/. 0-scrape win — no
  // HOVER search, no subscription (the subscription is for the IMAGE site
  // only), no captcha. DIRECT egress (verified 200 2026-06-11). Daily cadence
  // since the clerk produces a fresh D/P/M set per business day.
  // -------------------------------------------------------------------------
  {
    sourceKey: "hillsborough-official-records",
    domain: "publicrec.hillsclerk.com",
    countyFips: "12057",
    state: "FL",
    scraperFn: "ingestHillsboroughRecords",
    cronExpr: "0 13 * * *", // 9 AM ET daily — fresh index files post each business day
    strategy: "incremental-date", // incremental over available file DATES (dateKey HWM)
    legalRisk: "yellow",
    rateLimitMs: 1500,
    proxyMode: "none", // plain public IIS file server, DIRECT
    notes: "Hillsborough FREE bulk index-file ingester (0-scrape). D/P/M daily index set from publicrec.hillsclerk.com/OfficialRecords/DailyIndexes/ → Mortgage/Lien upserts (source=bulk:hillsborough-or) + satisfaction matching. HWM = YYYYMMDD of latest vintage ingested; ≥2 months of files online. First run = trailing 10 vintages; incremental cap 30.",
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

  // -------------------------------------------------------------------------
  // Code-enforcement violations (M3.2) — 100% GREEN open data. Multi-source
  // adapter sweeps Miami-Dade (12086, ArcGIS) + Orlando (12095, Socrata) per
  // run; CODE_ENFORCEMENT_SOURCES drives the slug list so adding a city needs
  // no registry change. Each source fetches openOnly with useProxy:false
  // (direct egress), resolves APNs (Tier-1 folio + Tier-2 address), persists
  // CodeViolation rows, then rebuilds CodeViolationSummary per county so the
  // scorer's CONDITION_FAMILY signals see fresh openCount/hasLien. Daily — the
  // open-data feeds are full re-fetches that catch case closures/new liens.
  // Ships enabled=true: green, no proxy, no captcha.
  // -------------------------------------------------------------------------
  {
    sourceKey: "code-enforcement",
    domain: "opendata",
    countyFips: null, // multi-county; adapter enumerates CODE_ENFORCEMENT_SOURCES (Miami-Dade + Orlando)
    state: "FL",
    scraperFn: "runCodeEnforcement",
    cronExpr: "0 8 * * *", // 4 AM ET daily — open-data full re-fetch
    strategy: "full",
    legalRisk: "green",
    rateLimitMs: 1000,
    proxyMode: "none",
    enabled: true,
    notes: "M3.2 code-enforcement: Miami-Dade ArcGIS + Orlando Socrata open data (CODE_ENFORCEMENT_SOURCES). openOnly fetch → resolveApns (Tier-1 folio + Tier-2 address) → CodeViolation upsert → refreshCodeViolationSummary per county. 100% GREEN, direct egress, no captcha. Feeds scorer CONDITION_FAMILY (CODE_VIOLATION/_MULTI/CODE_LIEN).",
  },

  // -------------------------------------------------------------------------
  // Probate official records (M3.1) — P-MVC family (Orange + Pinellas +
  // Broward), incremental by date, one target day per run swept across all
  // three counties. legalRisk yellow. Sister adapter to landmark-official-
  // records: all three portals gate the SEARCH SUBMIT behind reCAPTCHA v2, so
  // this self-activates exactly like the landmark row — enabled only when a
  // captcha solver key is present, otherwise the run persists 0 and reports
  // outcome=captcha-required per county (never throws, never burns dates).
  // -------------------------------------------------------------------------
  {
    sourceKey: "probate-official-records",
    domain: "myorangeclerk.com",
    countyFips: null, // multi-county; adapter enumerates PROBATE_MVC_COUNTIES (Orange/Pinellas/Broward)
    state: "FL",
    scraperFn: "runProbateOfficialRecords",
    cronExpr: "0 9 * * *", // 5 AM ET daily (after code-enforcement 4 AM slot)
    strategy: "incremental-date",
    legalRisk: "yellow",
    rateLimitMs: 2500,
    proxyMode: "none", // P-MVC portals direct; reCAPTCHA-gated search
    // Self-activating: enabled only when a captcha solver is configured, so it
    // never spins on the captcha wall (or burns solver credits) without a key.
    enabled: !!(process.env.TWOCAPTCHA_API_KEY || process.env.CAPTCHA_SOLVER_API_KEY),
    notes: "M3.1 probate: P-MVC family (Orange/Pinellas/Broward MyClerk portals). incremental-date, one target day/run across all 3 counties; first run = today-7d. SetDisclaimer session + RVT → estate-admin case list. reCAPTCHA v2 on SEARCH SUBMIT — solver hook wired (lib/scrapers/base/captcha-solver.ts via getCaptchaSolver); PROBATE_RECAPTCHA_TOKEN one-shot override. Auto-enables when TWOCAPTCHA_API_KEY/CAPTCHA_SOLVER_API_KEY is set on the worker + this seed reruns. Feeds ProbateCase → rescore-probate matcher → ProbateSummary (LIFE_EVENT_FAMILY).",
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
