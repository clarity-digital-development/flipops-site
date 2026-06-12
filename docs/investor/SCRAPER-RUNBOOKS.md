# FlipOps Scraper Estate — Operational Runbooks

> M3.7 deliverable. Per-source runbook to de-tribalize the data-acquisition layer.
> Every row is grounded in code (`file:line`). **Status is honest:** sources that are
> dormant, blocked, or unverified are flagged as such — do not present them as live.
> Last verified against code: 2026-06-12.

---

## How the estate is wired (read this first)

- **Single source of truth = `ScrapeRegistry`** (seeded by `prisma/seed-scrape-registry.ts`, 18 rows). The BullMQ scheduler (`lib/cron/worker-bullmq.ts:148-214`) reads `enabled=true` rows every 60s and upserts a JobScheduler per row onto a per-domain queue.
- **`enabled` is the kill-switch.** `processJob` (`worker-bullmq.ts:309-322`) refuses a disabled row even on manual trigger — flip `enabled=true` first. A `season` filter can be bypassed by `trigger=manual-script`, but `enabled` cannot.
- **Adapter dispatch map** = `lib/scrapers/dispatch/index.ts:30-48` (17 sourceKeys → adapter fns). A registry row with no adapter logs `skipped-no-adapter`; every run (incl. skips) writes a `BulkIngestJob` audit row (`worker-bullmq.ts:235-279`).
- **Two manual re-run entrypoints:**
  - `npx tsx scripts/trigger-scraper.ts <sourceKey> [--wait]` — registry-driven (works for ALL sources), enqueues `trigger:manual-script`, optional ≤10-min poll of `BulkIngestJob`. **Use this for the M2/M3 official-records, code-enforcement, and probate keys.**
  - `npx tsx scripts/enqueue-scrape-job.ts <sourceKey>` — fire-and-forget, but only **9** keys are mapped (no official-records/code/probate). Prefer `trigger-scraper.ts`.
  - **`--wait` window is 10 min.** Long sweeps (RealAuction, RealTaxDeed) exceed it; `status=running` + new rows is **healthy**, not a failure.

### Shared infrastructure
- **Proxy precedence** (`lib/scrapers/base/http-client.ts:64-69`): `PROXY_URL` (DataImpulse) → `BRIGHT_DATA_PROXY_URL` → `HTTPS_PROXY` → `HTTP_PROXY`. In **production**, a `useProxy:true` call with no proxy configured **throws** (`:166-171`). TLS: strict on the proxy leg, relaxed on the target leg (provider MITMs by design, `:71-77`). Per-host jittered pacing prevents metronomic fingerprinting (`:80-125`).
- **Playwright `useProxy:false`** = hard `direct://` egress (overrides container `HTTPS_PROXY` Chromium would auto-discover) — load-bearing fix in commit `0239a77`.
- **BulkIngester safeguards** (FL DOR NAL/SDF + FGIO): `SET LOCAL synchronous_commit=OFF` per batch, explicit **60s** `$transaction` timeout (default 5s is a footgun), PG **32767 bind-var** auto-chunking, connection-drop retry on `ECONNRESET`/`Transaction already closed`.
- **Post-run hook** (`lib/cron/auction-summary-hook.ts`): on `completed`, refreshes the materialized `AuctionSummary` mart — **only** for `realauction-fl-foreclosures` + `realtaxdeed-fl-tax-deeds`.
- **Per-domain queue concurrency caps** sum to 15 = PG `connection_limit`. FL DOR runs in an isolated `bulk-ingest` queue (concurrency 1) so the ~150-min job doesn't block other domains.
- **Registry `proxyMode` ≠ runtime proxy posture.** Several rows declare `bd-on`/`proxyMode` in the seed, but adapters set `useProxy:false`/flip per-county in code. **The code path is authoritative**; `proxyMode` is descriptive metadata only.

---

## Family 1 — RealAuction foreclosures

| Field | Value |
|---|---|
| sourceKey | `realauction-fl-foreclosures` |
| Scrapes | Foreclosure + tax-deed auction calendars, **16 counties** × tracks (`realauction.ts:38-71`); next ~14 weekdays × tracks (`realauction-fl-foreclosures.ts:43,97-100`) |
| Target | `*.realforeclose.com` per-county subdomains |
| Cadence | `0,15,30,45 6-9 * * *` (6–10 AM ET); queue `domain-realauction` conc 2 |
| Proxy | `useProxy:false` — RealAuction WAF 403s DataImpulse; runs direct from Railway via XHR path |
| Status | **LIVE** (enabled default). XHR-only fetch path (no Playwright despite filename). Prod-verified 2026-06-04: 1104 records, 0 errors |
| Re-run | `npx tsx scripts/trigger-scraper.ts realauction-fl-foreclosures` (full sweep > 10-min `--wait`) |
| Landmines | `MAX_RA_REQUESTS=200` cap; cookies minted per (county,date) since CF pins the date at splash; all-iterations-fail + 0 rows → throws |
| Feeds | `Foreclosure` rows → `AuctionSummary` mart → scorer FORECLOSURE_FAMILY + leads-UI auction badges/countdown |

## Family 2 — RealTaxDeed tax-deeds

| Field | Value |
|---|---|
| sourceKey | `realtaxdeed-fl-tax-deeds` |
| Scrapes | Tax-deed sale calendars, **29 counties** (`realtaxdeed.ts:85-113`); calendar-first (XHRs only dates with sales) |
| Target | `*.realtaxdeed.com` |
| Cadence | `0 11 * * *` daily; queue `domain-realauction` |
| Proxy | `useProxy:false` (same WAF 403) |
| Status | **LIVE** (enabled default). Shares cookie+XHR+macro path with realauction |
| Re-run | `npx tsx scripts/trigger-scraper.ts realtaxdeed-fl-tax-deeds` |
| Feeds | `Foreclosure` (stageCode=`TAX_DEED`) → `AuctionSummary` → auction signals/UI |

## Family 3 — Official records (mortgages / liens)

| sourceKey | Counties | Target / platform | Cadence | Proxy | Status |
|---|---|---|---|---|---|
| `acclaim-official-records` | **Duval + Broward** | Acclaim GridResults JSON | `0 12 * * 2` weekly Tue | none (both direct) | **LIVE** — verified 2026-06-10 |
| `landmark-official-records` | PB + Lee + Levy | Pioneer/Granicus `landmarkweb` | `0 7 * * *` daily | none (Lee→proxy) | **DORMANT** — `enabled` only if `TWOCAPTCHA_API_KEY` set (reCAPTCHA v2 gate). No key → 0 rows, `captcha-required` |
| `oncore-official-records` | Orange | Tyler Self-Service SPA | `0 13 * * 3` weekly Wed | none | **DISABLED** (`enabled:false`) — SPA search handshake not replicable over HTTP. 0 live rows |
| `miamidade-official-records` | Miami-Dade | Vite React SPA + JSON API | `0 14 * * 4` weekly Thu | none (NetScaler blocks proxy) | **ENABLED but UNVERIFIED** — reCAPTCHA-v3 self-mint via stealth-chromium not confirmed on Railway egress; may be returning `captcha-required`. **Check `BulkIngestJob` outcomes before claiming live** |
| `hillsborough-official-records` | Hillsborough | Public IIS bulk file server | `0 13 * * *` daily | `useProxy:false` | **LIVE** — file-ingester (no search/captcha), 0-scrape win, verified 2026-06-11 |

All feed `Mortgage`/`Lien` upserts (+ satisfaction matching) → scorer LIEN signals. Re-run any via `trigger-scraper.ts <key>`.

## Family 4 — Tax-delinquent (per-metro)

All persist to the `Lien` table. All **LIVE** (enabled).

| sourceKey | County | Target | Cadence | Notes |
|---|---|---|---|---|
| `duval-tax-delinquent` | Duval | jaxdailyrecord.com | `0 4 1 * *` monthly | full snapshot (~19 min), no cursor (catches redemptions) |
| `hillsborough-tax-delinquent` | Hillsborough | county-taxes.net (TaxSys) | `0 4 2 * *` monthly | Phase-4 CSV flow (~1 min) |
| `orange-tax-delinquent` | Orange | lienhub.com | `0 4 * * 1` Mon | **SEASONAL Apr–Jul** (idle otherwise) |
| `broward-tax-delinquent` | Broward | govhub CSV + lienhub | `0 5 1 * *` monthly | two sources; supplement isolated in own try/catch |
| `miami-dade-tax-delinquent` | Miami-Dade | miamidade.gov PDF | `0 4 * * 1` Mon | **SEASONAL May only**. ⚠ PDF URL hardcoded (`miami-dade-tax-delinquent.ts:27-28`) — goes stale after next publication |
| `palm-beach-tax-delinquent` | Palm Beach | floridapublicnotices.com | `0 4 * * *` daily | tax-deed apps only (narrow slice) |

## Family 5 — Code-enforcement (open data)

| Field | Value |
|---|---|
| sourceKey | `code-enforcement` |
| Scrapes | Open violations: Miami-Dade ArcGIS (`12086`) + Orlando Socrata (Orange `12095`). Jacksonville = TODO (portal not located) |
| Cadence | `0 8 * * *` daily, full re-fetch; `useProxy:false`, 100% green, no captcha |
| Status | **LIVE** (`enabled:true` explicit). One source failing doesn't abort others |
| Re-run | `npx tsx scripts/trigger-scraper.ts code-enforcement` |
| Feeds | `CodeViolation` → `CodeViolationSummary` → scorer CONDITION_FAMILY |

## Family 6 — Probate (P-MVC)

| Field | Value |
|---|---|
| sourceKey | `probate-official-records` |
| Scrapes | Estate-admin cases: **Orange + Pinellas + Broward** |
| Cadence | `0 9 * * *` daily; `none` proxy |
| Status | **DORMANT** — `enabled` only if `TWOCAPTCHA_API_KEY` set (all 3 portals gate search behind reCAPTCHA v2). No key → 0 rows, `captcha-required`. **The INHERITED/DEATH_TRANSFER signals have never seen real data.** |
| Re-run | `npx tsx scripts/trigger-scraper.ts probate-official-records` |
| Feeds | `ProbateCase` → `ProbateSummary` → scorer LIFE_EVENT_FAMILY |

**Captcha solver is real** (`lib/scrapers/base/captcha-solver.ts` — full 2captcha in.php/res.php flow, balance check, env-gated). But Landmark + Probate ship **dormant** until `TWOCAPTCHA_API_KEY` is set (OPS-8).

## Family 7 — FL DOR bulk (NAL / SDF / NAP) + duval-clerk

| sourceKey | Scrapes | Cadence | Status |
|---|---|---|---|
| `fl-dor-statewide-nal-sdf` | Statewide property roll, all 67 counties | `0 0 1 1,4,7,10 *` quarterly | **HEAD-CHECK ONLY** — the scheduled job lists files + compares vintage to HWM; it does **NOT** auto-run the ~150-min ingest. The "10.9M parcels" figure is a **past manual backfill**, not a recurring auto-pipeline. Heavy ingest = manual: `npx tsx scripts/fl-dor-ingest-statewide.ts` (isolated `bulk-ingest` queue conc 1) |
| `duval-clerk-recordings` | Mortgages/liens/foreclosures, Duval | `0 6 * * *` daily | **LIVE** — `useProxy:false` (DataImpulse dropped at edge; Railway direct = 200). Verified 351 records/116s 2026-06-02 |

**FL DOR SDF backfill (M2.7 / OPS-7):** historical Final SDF vintages (2010F–2024F, 67 counties) are staged via `scripts/fl-dor-sdf-fetch-request.ts` (downloads the per-request SharePoint dropbox zips → `data/raw/fl-dor-sdf-backfill/<year>/`) then ingested by `scripts/fl-dor-sdf-backfill.ts` (resumable, idempotent, overlap-capped). NAL → `Parcel`; SDF → `ParcelSale` (time-series powering `/api/comps` + AVM training).

---

## Investor-package risk flags (sources that look live but aren't)

1. **OnCore (Orange official records)** — hard-disabled, 0 data. Pipeline "complete + tested" but no live rows.
2. **Landmark (PB/Lee/Levy) + Probate (Orange/Pinellas/Broward)** — dormant by default; both gate on `TWOCAPTCHA_API_KEY` (OPS-8). Code + solver are real, but **no rows flow without the key.**
3. **Miami-Dade official records** — enabled but reCAPTCHA-v3 self-mint **unverified on Railway**. Verify `BulkIngestJob` outcomes before claiming it as a working source.
4. **`fl-dor-statewide-nal-sdf` scheduled job ingests nothing** — HEAD-check/alert only; the 10.9M-parcel ingest is a manual operator command.
5. **Live data counts must be re-queried before publishing** — parcel/sale/lien/dollar figures in docs originate from prior runs; run `SELECT count(*)` + latest `BulkIngestJob` outcomes per sourceKey before putting a number in front of an investor.

**Key files:** registry `prisma/seed-scrape-registry.ts` · scheduler `lib/cron/worker-bullmq.ts` · dispatch `lib/scrapers/dispatch/index.ts` · vendors `lib/scrapers/vendors/*.ts` · bulk `lib/data-sources/bulk/{fl-dor.ts,fl-dor-sdf.ts}` · shared HTTP `lib/scrapers/base/http-client.ts` · captcha `lib/scrapers/base/captcha-solver.ts` · re-run `scripts/{trigger-scraper.ts,enqueue-scrape-job.ts}`.
