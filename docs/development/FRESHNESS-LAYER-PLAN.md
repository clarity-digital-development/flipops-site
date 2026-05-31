# Data Freshness Layer — Implementation Plan v3

**Owner:** Tanner / Claude (CTO)
**Status:** REVISED v3 — incorporates all 11 v2-verifier fixes
**Date:** 2026-05-30

## v3 changelog (what changed from v2)

| # | Change | Source |
|---|---|---|
| 1 | **Atomic Redis politeness**: `SET key val PX ttl NX` with retry-loop, no in-process Map fallback. Eliminates the TOCTOU race in v2 lines 195-202. | v2 critical bug |
| 2 | **Two separate worker Railway services**: `worker-legacy` (node-cron + execSync for G1-G4) and `worker-bullmq` (BullMQ Workers for new freshness scrapers + 5 monitoring jobs). `execSync` cannot block BullMQ heartbeat if they're in different processes. | v2 critical bug |
| 3 | **Add `refreshCounty()` (`lib/data-sources/index.ts:143`) to Phase 7 deprecation** with explicit shim → registry routing. | v2 ADR error |
| 4 | **`legalRisk` defaults to `"yellow"`** (fail-safer) — green requires explicit caller decision. Also: add `"red"` to RawSnapshot.legalRisk enum since the schema currently only has green/yellow. | v2 critical |
| 5 | **Cadence-aware baseline rule**: `max(4 runs, ceil(30 days / interval))`. Until baseline established, scraper runs with `bootstrapping=true` flag — only HTTP/CF errors auto-pause; row-count anomalies log to digest. Monthly scrapers no longer wait 4 months for safety. | v2 substantive |
| 6 | **`connection_limit=15`** on worker DATABASE_URL (not 5). Sum of per-domain queue concurrencies is 15, not the 4 in v2's math. | v2 math error |
| 7 | **Adapter LOC realistic at 60-100 per scraper**; Phase 2 bumped from 2 → 3 days. Total estimate 12 → 13 days. | v2 underestimate |
| 8 | **Drop `cron-parser` from "add" list** — already in `package-lock.json:9372` transitively. | v2 factual |
| 9 | **Invalid `cronExpr` handling**: validate at registry write time (admin UI + API); on boot-sync, skip + log invalid rows rather than crashing. | v2 crash surface |
| 10 | **@channel escalation policy**: 3 consecutive P1 alerts within 24h → suppress @channel, escalate to direct DM. Avoids ping fatigue on flapping sources. | v2 substantive |
| 11 | **Add explicit deprecation TODOs to `iasworld.ts` + `firecrawl.ts` in Phase 0** (the registry ADR's "already deprecated" claim was false; no such comments exist). | v2 factual error |

## Problem statement (unchanged)

8 production scrapers (Duval clerk, 6 metro tax-delinquent, RealAuction 16-county) have no scheduler. National rollout (~500 scrapers) needs declarative registry + scheduler + per-source state + anomaly detection + incremental support.

## Architecture (v3 — two-service worker split)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Railway: worker-legacy service (existing lib/cron/worker.ts)        │
│                                                                       │
│  KEEP node-cron + execSync for G1-G4                                 │
│  Process isolation = safety guarantee for the guardrails             │
│  No changes to the 4 guardrail jobs                                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Railway: worker-bullmq service (NEW)                                 │
│                                                                       │
│  BullMQ JobScheduler boots from ScrapeRegistry on startup            │
│    + re-syncs every 60s; skips+logs rows with invalid cronExpr       │
│                                                                       │
│  Runs BullMQ Workers for:                                             │
│   - All freshness scrapers (the 8 new + future bond, etc.)           │
│   - The 5 monitoring/discovery jobs migrated in Phase 6              │
│                                                                       │
│  cron:scraper-health (in-process, every 15 min)                      │
└────────────────────────┬─────────────────────────────────────────────┘
                          │
                          │ JobScheduler.upsertJobScheduler / enqueue
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│   BullMQ Queues (bullmq@5.58.7)                                       │
│                                                                       │
│   queue:domain-jaxdailyrecord       concurrency=1                     │
│   queue:domain-lienhub              concurrency=2                     │
│   queue:domain-realauction          concurrency=2 STAGGERED           │
│   queue:domain-miamidade            concurrency=1                     │
│   queue:domain-county-taxes-net     concurrency=1 (Hillsborough)      │
│   queue:domain-flpublicnotices      concurrency=2                     │
│   queue:domain-default              concurrency=4                     │
│   queue:bulk-ingest                 concurrency=1 (FL DOR 150-min)   │
│   queue:flipops-monitoring          concurrency=2 (Phase 6)          │
│                                                                       │
│   Sum of caps = 15 → matches connection_limit                        │
│   attempts=5, backoff=exponential 30s base                           │
│   stalled-job reclaim every 60s                                       │
└─────────────────────────┬────────────────────────────────────────────┘
                           │
                  execute  │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│   BullMQ Workers (in worker-bullmq Railway service)                   │
│                                                                       │
│   resolveScraperFn(sourceKey) → invokes ADAPTER                       │
│                                                                       │
│   adapter signature:                                                  │
│     runFoo(ctx: RunContext) → Promise<RunResult>                      │
│                                                                       │
│   Politeness: ATOMIC Redis SET-NX-PX (no in-proc fallback)            │
│     SET next-allowed:<host> <unix-ms> PX <rateLimitMs*2> NX           │
│     if nil → existing key, sleep until expiry, retry                  │
│                                                                       │
│   Max 2 concurrent stealth-chromium per worker process                │
│   Scale by adding worker-bullmq replicas, not concurrency             │
└─────────┬────────────────────────────────────────────────────────────┘
           │
           │  writes
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│   Postgres (Railway PG, existing)                                     │
│                                                                       │
│   NEW:      ScrapeRegistry (replaces CountyScraper + ScrapeJob)       │
│   EXTENDED: BulkIngestJob (run-stats + sourceKey FK)                  │
│   EXISTING: Lien / Mortgage / Foreclosure / Parcel / RawSnapshot      │
│                                                                       │
│   DATABASE_URL?connection_limit=15 on worker-bullmq                   │
│   DATABASE_URL?connection_limit=5  on worker-legacy                   │
│   Default on web service                                              │
│   Combined ~25 < Railway Hobby PG cap (100)                           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│   Redis (NEW Railway service, ~$5/mo)                                 │
│   MUST verify: AOF persistence ON + noeviction policy                 │
│                                                                       │
│   BullMQ queues + JobScheduler next-run state                         │
│   Politeness atomic semaphore: next-allowed:<host> with NX PX         │
│   Worker locks for stalled-job reclaim                                │
└──────────────────────────────────────────────────────────────────────┘
```

## Registry decision (Path B — confirmed)

**Replace** `CountyScraper` + `ScrapeJob` with `ScrapeRegistry`. **Extend** `BulkIngestJob` to become the unified run-audit table.

**Three legacy CountyScraper callers identified** (NOT two as v2 ADR claimed):
- `lib/scrapers/vendors/iasworld.ts` — deprecation TODO added in Phase 0
- `lib/scrapers/vendors/firecrawl.ts` — deprecation TODO added in Phase 0
- `lib/data-sources/index.ts:143` (`refreshCounty()`) — Phase 7 routes through shim → registry

### Schema diff (Prisma)

```prisma
// REMOVE (after Phase 7 migration verified):
//   model CountyScraper { ... }   (prisma/schema.prisma:1457-1490)
//   model ScrapeJob     { ... }   (prisma/schema.prisma:1494-1513)

// ADD:
model ScrapeRegistry {
  id                     String   @id @default(cuid())
  sourceKey              String   @unique          // "duval-tax-delinquent"
  domain                 String                     // "jaxdailyrecord.com"
  countyFips             String?                    // null for statewide
  state                  String?                    // "FL"
  scraperFn              String                     // dispatch-map key
  cronExpr               String                     // validated at write-time + skip+log on boot if invalid
  strategy               String                     // "full"|"incremental-date"|"incremental-id"|"snapshot-diff"|"head-check"
  enabled                Boolean  @default(true)
  bootstrapping          Boolean  @default(true)    // NEW v3: cleared when baseline computed
  seasonStartMonth       Int?
  seasonEndMonth         Int?
  legalRisk              String                     // NEW v3: REQUIRED, no default. "green"|"yellow"|"red"
  rateLimitMs            Int      @default(1500)
  priority               Int      @default(0)
  timezone               String   @default("America/New_York")
  proxyMode              String   @default("none")  // none|bd-on|bd-rotate
  lastRunAt              DateTime?
  lastSuccessAt          DateTime?
  lastFailureAt          DateTime?
  lastFailureReason      String?  @db.Text
  lastHighWaterMark      String?
  lastRowCount           Int?
  rollingMedianRowCount  Int?
  consecutiveFails       Int      @default(0)
  consecutiveP1Alerts    Int      @default(0)       // NEW v3: for @channel escalation
  pausedReason           String?
  notes                  String?  @db.Text
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  bulkIngestJobs         BulkIngestJob[]
  @@index([enabled, cronExpr])
  @@index([domain])
  @@index([countyFips])
}

// EXTEND BulkIngestJob:
model BulkIngestJob {
  // ... existing columns unchanged ...
  sourceKey         String?                              // nullable for legacy FL DOR rows
  registry          ScrapeRegistry? @relation(fields: [sourceKey], references: [sourceKey])
  rejectCount       Int     @default(0)
  http4xxCount      Int     @default(0)
  http5xxCount      Int     @default(0)
  cfChallengeCount  Int     @default(0)
  selectorMissRate  Float?
  runStatsJson      Json?
  tier              String?
  triggerType       String  @default("cron")
  @@index([sourceKey])
}

// AMEND RawSnapshot.legalRisk (currently green|yellow only):
// Doc-level: legalRisk now "green" | "yellow" | "red" — red = hard-locked, never scraped.
// Schema-level: stays String; no enum migration (consistent with existing pattern).
```

## Scheduling stack

**BullMQ `JobScheduler` from day 1** in the `worker-bullmq` Railway service.

- `bullmq@5.58.7` + `ioredis@5.7.0` already in `package.json`
- `cron-parser@4.9.0` already in lockfile (transitive — no new dep)
- ioredis connection options MUST set `maxRetriesPerRequest: null` (BullMQ requirement; pattern already in `workers/src/index.ts:19`)
- Redis on Railway, ~$5/mo, AOF persistence + `noeviction` REQUIRED pre-Phase 0

**Boot sync**:
```typescript
// Pseudocode
for (const row of await prisma.scrapeRegistry.findMany({where:{enabled:true}})) {
  try {
    cronParser.parseExpression(row.cronExpr); // throws on invalid
  } catch (e) {
    logger.error({sourceKey: row.sourceKey, error: e.message}, "invalid cronExpr; skipping");
    await prisma.scrapeRegistry.update({
      where: {id: row.id},
      data: {pausedReason: `invalid cronExpr: ${e.message}`}
    });
    continue;
  }
  await scheduler.upsertJobScheduler(
    row.sourceKey,
    {pattern: row.cronExpr, tz: row.timezone},
    {name: row.sourceKey, data: {sourceKey: row.sourceKey}}
  );
}
```

Re-runs every 60s; new/edited rows pick up without restart.

**Per-domain queues with concurrency caps** (free-tier BullMQ):
- One queue per high-traffic domain (sum of caps = 15)
- Per-queue `limiter: {max, duration}` enforces burst rate at the queue layer

## Politeness — ATOMIC Redis semaphore (no in-proc fallback)

```typescript
// lib/scrapers/base/redis-politeness.ts
export async function waitPoliteSlot(host: string, rateLimitMs: number): Promise<void> {
  const key = `next-allowed:${host}`;
  while (true) {
    const now = Date.now();
    const target = now + rateLimitMs;
    // ATOMIC: only sets if key doesn't exist
    const ok = await redis.set(key, target.toString(), 'PX', rateLimitMs * 2, 'NX');
    if (ok === 'OK') return; // we got the slot
    // Someone else holds it — read their target, sleep until then
    const existing = await redis.get(key);
    const wait = existing ? parseInt(existing) - now : rateLimitMs;
    if (wait > 0) await sleep(wait);
    // Loop and try to claim again
  }
}
```

`SET ... NX PX` is the atomic primitive — no race window between check and set. Cut-over: this replaces the existing in-process `nextAllowedAt` Map in `lib/scrapers/base/http-client.ts:106-114` in the SAME PR. No transition window.

## Adapter layer for the 8 scrapers (revised LOC)

60-100 LOC per adapter (not 30 as v2 claimed). RealAuction alone needs 16 × 3 = 48 invocations the adapter enumerates internally; result-shape projection has its own per-scraper logic.

```typescript
// lib/scrapers/dispatch/realauction.ts (sketch — biggest adapter)
export async function runRealAuction(ctx: RunContext): Promise<RunResult> {
  const counties = ALL_REALAUCTION_COUNTIES; // 16
  const tracks: Track[] = ["foreclosure", "taxdeed", "code_enf"];
  const stats = new RunStatsCollector(ctx.runId);
  let totalRows = 0, totalRejects = 0;
  for (const fips of counties) {
    for (const track of tracks) {
      try {
        const r = await scrapeRealAuctionsPlaywright({countyFips: fips, track, useProxy: true});
        if (r === null) continue; // county doesn't run this track
        totalRows += r.persistedForeclosures + r.persistedLiens;
        stats.recordRun(r);
      } catch (err) {
        stats.recordError(err);
        // continue — partial data better than no data
      }
    }
  }
  return {
    rowCount: totalRows,
    rejectCount: totalRejects,
    newHighWaterMark: new Date().toISOString(),
    ...stats.snapshot(),
  };
}
```

Per-adapter realistic effort:
- Duval clerk: 30-50 LOC (closest to "wire up")
- Duval/Hillsborough/Orange/Broward/PB/Miami-Dade tax: 50-80 LOC each
- RealAuction: 100-150 LOC (the multi-county enumeration)
- FL DOR: separate `BulkIngester.ingest({countyFips, maxRecords})` shape → ~80 LOC bridge

**8 adapters total ~3 days** (Phase 2).

## Per-source cadence (v3 — verified)

| Bucket | Sources | Cron | Strategy |
|---|---|---|---|
| **Hourly** | 6 sheriff jail rosters (future bond signal) | `0 * * * *` | incremental-date |
| **Daily** | Duval clerk, FPN (PB), LienHub Broward county-held, Hillsborough TaxSys, RealAuction 16-county | `0 6 * * *` for most; **RealAuction STAGGERED across hours: counties 1-4 at 6am, 5-8 at 7am, 9-12 at 8am, 13-16 at 9am** | incremental-date / snapshot-diff |
| **Weekly** | Orange tax (May-Jun cert sale season), Miami-Dade PDF head-check | `0 4 * * 1` + `seasonStartMonth/EndMonth` | head-check / full |
| **Monthly** | Duval / Hillsborough / Broward / Palm Beach tax-delinquent full reconcile | `0 4 1 * *` | snapshot-diff |
| **Quarterly** | FL DOR NAL/SDF statewide roll | `0 0 1 1,4,7,10 *` | head-check on file mtime |

Quarterly FL DOR runs in dedicated `bulk-ingest` queue so its 150-min block doesn't starve other domain queues.

## Per-scraper incremental implementation (Phase 4)

| Scraper | Strategy | Realistic effort |
|---|---|---|
| Duval clerk | incremental-date (already in shape) | 1h |
| RealAuction | snapshot-diff | 4-6h |
| Duval tax | snapshot-diff + early-term | 1-2 days |
| Hillsborough tax | snapshot-diff (probe CSV first!) | 1-2 days |
| Orange tax | seasonal full + intra-season diff | 6-8h |
| Broward tax | full (tiny) | 0 |
| Miami-Dade tax | head-check + full re-parse | 4h |
| Palm Beach tax | incremental-date FPN payload | 4h |

## Health-check — cadence-aware bootstrapping

`bootstrapping=true` (default) on every new registry row. Cleared when baseline established.

**Baseline rule**: requires `max(4, ceil(30 days / interval))` successful runs.
- Hourly source: 4 runs (4 hours)
- Daily source: 30 runs (30 days)
- Weekly: 4 runs (1 month)
- Monthly: 4 runs (4 months) — but during this window only HTTP/CF-error auto-pause applies (see below)
- Quarterly: 4 runs (1 year) — same

**While bootstrapping=true**:
- HTTP 4xx/5xx / CF challenge / freshness-breach signals → can auto-pause (P1)
- Row-count / reject-rate signals → log to digest only (no auto-pause)
- Schema-drift (0 results across selectors) → P1 only after 2 consecutive runs (avoids first-run false-positive)

**Post-bootstrap**, full per-source baseline-comparison thresholds apply.

## Health thresholds — calibrated per source (post-bootstrap)

| Signal | P2 WARN | P1 CRIT |
|---|---|---|
| Row count | <0.6× baseline OR z-score≥2.5 | <0.4× baseline OR z-score≥4 |
| Reject rate | >2× baseline | >5× baseline OR >20% absolute |
| HTTP 4xx | >2× baseline + 1% absolute | >10% absolute |
| HTTP 5xx | >5% absolute | >20% absolute |
| CF challenges | >3% absolute | >10% absolute |
| Schema drift | — | 0 results on >20% pages |
| Freshness | — | no success in 2× expected interval |

**P2 WARN** → 2 consecutive bad runs required; digest only.
**P1 CRIT** → Slack `@channel` + auto-pause on second CRIT within 4h (or operator non-ack within 2h).
**8h cooldown** per (sourceKey, signal).
**@channel escalation**: 3+ consecutive P1 alerts within 24h → suppress @channel, route to direct DM. Avoids flapping-source ping fatigue.

## Phase 6 = Strategy C (Hybrid) — clean process separation

**`worker-legacy` Railway service**:
- Runs `lib/cron/worker.ts` unchanged
- node-cron + execSync for G1-G4 (process isolation = safety)

**`worker-bullmq` Railway service (NEW)**:
- Runs `lib/cron/worker-bullmq.ts` (new file)
- BullMQ JobScheduler + Workers for new freshness scrapers
- Phase 6: migrates the 5 non-guardrail crons (data-refresh, pipeline-monitoring, contractor-perf, attom-discovery, skip-tracing) to BullMQ in-process

This split fully resolves the "execSync blocks BullMQ heartbeat" issue — they're in different processes. Operational cost: one more Railway service ($5-10/mo).

Migrating 5 jobs: ~12-14h per Phase 6 ADR.

## Implementation phases

| Phase | Days | Deliverable |
|---|---|---|
| **0. Pre-flight + provision** | 1.5 | Redis on Railway (AOF + noeviction verified). `worker-bullmq` Railway service provisioned. Prisma schema: `ScrapeRegistry` add + `BulkIngestJob` extend. Seed for 8 scrapers + FL DOR. `connection_limit=15` on worker-bullmq DATABASE_URL, `=5` on worker-legacy. Add deprecation TODOs to `iasworld.ts` + `firecrawl.ts`. Add "red" to RawSnapshot.legalRisk docs. |
| **1. Core scheduler + atomic politeness** | 2 | `worker-bullmq.ts` boots BullMQ JobScheduler reading from registry (with invalid-cronExpr skip+log). Per-domain queues with `limiter`. Atomic Redis SET-NX-PX politeness replaces in-proc Map (same PR — no transition window). Adapter scaffolding in `lib/scrapers/dispatch/`. |
| **2. 8 adapters + easy incrementals** | 3 | One adapter per scraper (60-100 LOC each). Wire Palm Beach FPN date filter, Miami-Dade HEAD-request, Duval clerk date-cursor. |
| **3. Health monitoring + baselining** | 1.5 | RunStats collector. Baseline computation reads RawSnapshot history. `cron:scraper-health` evaluator (in worker-bullmq). Slack alerting (existing `sendSlackNotification`). bootstrapping flag logic. @channel escalation policy. **Functional MVP at end of Phase 3.** |
| **4. Hard incrementals** | 2 | Snapshot-diff for Duval/Hillsborough/Orange tax. Move per-row upserts to `BulkIngester` batched-SQL pattern (kills the 28-min persist time). |
| **5. Admin dashboard + Bull Board** | 0.5 | `/app/admin/scrapers` Next.js page (list, last-run, manual re-enable, manual run-now). `@bull-board/express` mount at `/api/admin/queues` (Clerk-protected). |
| **6. Migrate 5 non-guardrail crons to BullMQ** | 2 | Per Strategy C — G1-G4 stay on `worker-legacy`; 5 monitoring/discovery jobs move to `worker-bullmq`. Wrap each existing script export with adapter. |
| **7. Deprecate legacy registry tables + shim** | 0.5 | After 2-week prod soak: drop `ScrapeJob` and `CountyScraper`. Add shim from `lib/data-sources/refreshCounty()` → registry routing. pg_dump snapshot pre-drop. |
| **TOTAL** | **~13 days** | Full freshness layer, scaling-ready, safety-critical paths preserved |

## Pre-flight verification checklist (BLOCKING Phase 0)

These MUST be confirmed/done before any code in Phase 0 ships:

- [ ] Railway Redis service available + AOF persistence enabled + `noeviction` policy
- [ ] Railway worker-bullmq service supports ≥1GB memory per replica
- [ ] `worker-bullmq` Railway service created with deploy config pointing at `lib/cron/worker-bullmq.ts`
- [ ] `lib/scrapers/counties/fl-duval.ts` (if it imports `CountyScraper`) compatibility verified
- [ ] `lib/data-sources/index.ts:143 refreshCounty()` plan reviewed — shim approach acceptable
- [ ] Bright Data proxy operational from BullMQ worker process + per-request rotation intact
- [ ] Probe Hillsborough TaxSys for CSV export button (could trim Phase 4 by 1-2 days)
- [ ] Probe FPN API for documented `dateFrom`/`dateTo` filter params (simplifies Palm Beach adapter)
- [ ] Deprecation TODOs added to `iasworld.ts` and `firecrawl.ts` (Phase 0 first PR)
- [ ] Verify `cron-parser@4.9.0` is accessible in import path (it's transitive; may need explicit add if not re-exported)
- [ ] Verify Slack webhook supports per-thread DM escalation (or build the routing if not)
- [ ] Confirm Railway PG connection cap — 25 sum across services must fit under it

## Risks (v3)

1. **Atomic Redis `SET NX PX` failure case**: if Redis itself is unreachable, `politeFetch` will hang in retry loop. **Mitigation**: timeout the retry loop at 10s, fail-open with a logged warning (better to over-request than to deadlock the scraper). Track these events in `runStatsJson`.

2. **Two-service operational complexity**: `worker-legacy` and `worker-bullmq` mean 2 Railway services. Failed deploys, env config, log streams doubled. **Mitigation**: shared `lib/cron/shared/` utilities + identical Railway deploy patterns + a single `npm run worker:all` for local dev that runs both.

3. **`worker-bullmq` cold-start `ECONNREFUSED` to Redis**: 3-5s window at boot. Cron-triggered enqueues in that window error. **Mitigation**: BullMQ retries enqueue on transient connection errors; first-tick worst case 1 missed run.

4. **Combined PG connection count**: 15 + 5 + Next.js default (?) ≈ 25-30. Verify under Railway PG cap (Hobby = 100; Pro = 500). If close, add `?connection_limit` to web service too.

5. **Bright Data per-request rotation under worker concurrency**: still an open question. **Phase 1 verification gate** — proxy posture must be confirmed before scaling worker-bullmq concurrency.

6. **`workers/src/index.ts` unused BullMQ stubs**: 6 unused queues. Delete in Phase 7 cleanup. Until then, they're inert.

7. **Per-row `prisma.lien.upsert` perf floor**: Hillsborough/Miami-Dade still slow until Phase 4. If Phase 4 slips, Hillsborough stays at ~26 min/run. Acceptable degraded state.

8. **node-cron DST/missed-run bugs persist on `worker-legacy`**: G1-G4 only. Acceptable — they're idempotent and run every 15 min.

9. **Registry deprecation Phase 7 = one-way door**: pg_dump pre-drop + 2-week soak + shim coverage of `refreshCounty()`.

10. **Hard incremental work (Phase 4) still the biggest unknown**: Kendo Grid + TaxSys iframe parsing under partial-data conditions. Functional MVP at Phase 3 lets us ship without Phase 4.

11. **`bootstrapping=true` masks early row-count drift**: monthly/quarterly sources won't catch row-count anomalies for months. Mitigation: weekly digest still highlights bootstrapping sources for manual review.

12. **`@channel` escalation to DM requires per-user routing config**: needs a `SLACK_ESCALATION_DM_USER_ID` env var. Set during Phase 3 setup.

## Out of scope

- National expansion (after this layer ships)
- Bond/jail data scrapers (plug into registry post-MVP as hourly entries)
- ML-based anomaly detection (overkill at scale)
- Sentry/Datadog/Grafana (Postgres + Slack sufficient)
- G1-G4 migration (Strategy C defers; they're fine on `worker-legacy`)
- Full `BulkIngester` refactor for ALL scrapers (only Hillsborough/Miami-Dade in Phase 4)
