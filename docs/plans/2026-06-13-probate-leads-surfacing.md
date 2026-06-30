# Plan — Probate lead surfacing + daily cron + Orange/Broward activation (M3.1 consumption)

Continuation of the Pinellas probate ingester ([2026-06-13-pinellas-probate-csv.md](2026-06-13-pinellas-probate-csv.md)).
Built autonomously ("complete 1-3 agentically") on branch `feat/pinellas-probate-csv`. Three blueprints
mapped via parallel code-explorer agents; premises below verified against source.

## Problem
Probate data is ingested (772 Pinellas `ProbateCase`, now 159 matched `ProbateSummary` rows) but produces
**zero user-facing value**: the leads-list UNION (`/api/properties/route.ts`) has no probate branch, the
daily refresh isn't wired, and Orange/Broward probate is captcha-gated-but-disabled. Three fixes:

1. **Light up probate in the leads UNION + UI** (the universal unlock — no probate lead surfaces without it).
2. **Pinellas daily-refresh cron** (`ScrapeRegistry` row + post-scrape rescore hook).
3. **Orange/Broward captcha activation** (trim now-free Pinellas from the captcha adapter; enable Orange/Broward).

## Non-goals
- `attorneyName` in the lead card: it's on `ProbateCase`, NOT `ProbateSummary`; surfacing it needs a summary
  schema+rescore extension → deferred fast-follow. This pass surfaces the 7 fields `ProbateSummary` already has.
- Pinellas tax-delinquent coverage (the OTHER stacking lever) — separate plan.
- Incremental-only probate matching (the matcher re-scans the full county each run; fine for daily background).

## Premises (✅ verified against source)
- ✅ `ProbateSummary` carries score/grade/motivation/decedentName/personalRepresentative/dateOfDeath/prAppointedAt/primaryCaseNumber/caseTypeCode/caseCount + (countyFips,apn) key — enough for a UNION branch mirroring `auction-virtual`. (schema.prisma ProbateSummary; route.ts auction branch lines 418-512.)
- ✅ UNION branches each project 53 columns; adding probate needs 7 new NULL-padded cols on mine/tax/auction + real values on probate, + `LeadRow` fields + mapper + getCounts. (route.ts read in full.)
- ✅ Post-scrape hook exists: `worker-bullmq.ts:124` `w.on("completed", …) → handleScrapeCompleted` in `lib/cron/auction-summary-hook.ts`, filtering by sourceKey. Extendable. (read.)
- ✅ Hook test `tests/cron/worker-bullmq-completed-hook.test.ts` pins `{refresh}` deps + `AUCTION…size===2` → extend backward-compatibly + add probate test, don't weaken. (read.)
- ✅ `matchProbateCasesToParcels({countyFips})` + `refreshProbateSummary({countyFips})` exported, no `$disconnect` (safe to import into the hook). County-scopeable. (rescore-probate.ts read.)
- ✅ Registry seed `prisma/seed-scrape-registry.ts`: `RegistrySeed` shape known; main() upserts ALL rows (re-running clobbers scraper-health auto-disables → use a TARGETED enable for prod, not a full seed run). No `pinellas-probate-csv` row exists; `probate-official-records` uses `enabled: !!(TWOCAPTCHA_API_KEY)` self-activating pattern.
- ✅ `domain-default` queue consumes unmapped domains (`publicfiles.mypinellasclerk.gov`, `myorangeclerk.com`, `browardclerk.org`) — no QUEUE_BY_DOMAIN change needed. (worker-bullmq.ts configForDomain.)
- ✅ Captcha adapter iterates `PROBATE_MVC_COUNTIES` (Orange/Pinellas/Broward) unconditionally; trimming Pinellas = remove that array entry + fix the inline self-test counts. (probate-mvc.ts.)

## Design / steps (commits)
1. **API** — `route.ts`: add `probate-virtual` branch (from `ProbateSummary` ⨝ `Parcel`, `dataSource='parcel-probate-bridge'`, HG1 dedupe vs scheduled auctions like tax-virtual), 7 probate cols (NULL-padded on other 3 branches), `LeadRow` fields, mapper, `probatePassesDistress` gate, `getCounts` probate count.
2. **UI** — `lead-filter-bar.tsx` (purple `Scale` "Probate" chip + `DistressFilter`), `lead-list-panel.tsx` (badge + "Estate of …" line), `lead-detail-sheet.tsx` (Decedent/DoD/PR/Case detail cells + source label + disclosure), `page.tsx` (filter predicate + headline chip), `seed-data.ts` (Property interface fields).
3. **Hook + cron** — extend `auction-summary-hook.ts` (add `PROBATE_REFRESH_SOURCE_KEYS` + sourceKey→counties map + optional `refreshProbate` dep, backward-compatible) + add probate regression test; add `pinellas-probate-csv` `RegistrySeed` row.
4. **Orange/Broward** — trim Pinellas from `PROBATE_MVC_COUNTIES` + fix self-test (enable stays env-driven via the existing self-activating seed).

## Failure modes
- UNION shape drift → typecheck + a live probate-branch probe (ProbateSummary has 159 rows). Mid-branch col misalignment → all 4 branches kept identical column order. Hook test regression → backward-compat deps. Heavy matcher on every scrape → scoped per county, background/`void`. Seed clobbering auto-disabled rows → targeted enable, documented, not run here.

## Activation (post-merge/deploy — documented, NOT done here; code isn't on Railway yet)
- #2: after merge+deploy, targeted-enable the `pinellas-probate-csv` registry row in prod (worker auto-schedules in 60s).
- #3: on Railway (where `TWOCAPTCHA_API_KEY` is set), run the registry seed so `probate-official-records` flips `enabled=true`; redeploy worker-bullmq.

## Test plan / results
- `npm run typecheck`: **exit 0 (root + workers)** — verified after the build and again after review fixes.
- vitest `tests/cron/worker-bullmq-completed-hook.test.ts` (**10**: 5 existing auction unchanged + 5 new probate) + `tests/scrapers/pinellas-probate-csv.test.ts` (13) = **23 passed**.
- Live probate-branch SQL probe vs prod → **5 real Pinellas leads** with address/owner/decedent/DoD/case (e.g. `19908 GULF BLVD · LEDIET, MARK R · dod 2026-03-16 · 26-003003-ES`), score 22/D. Join + all 7 probate fields populate.

## Review (3 fresh-context lenses, 2026-06-13)
- **API correctness: CLEAN.** UNION shape verified column-by-column — all 4 branches project 63 identical columns, types compatible, `LeadRow`↔aliases↔mapper mutually consistent; probate WHERE + both NOT EXISTS dedup clauses correct; `getCounts` probate query mirrors the branch; cursor `virt-pr-` consistent. (Rejected w/ evidence: the `taxOwedMin>0` branch-push relies on `AND FALSE` — intentional, mirrors the existing auction branch; counts correct; refactoring both is out of scope.)
- **Hook/seed/captcha: CLEAN + 2 fixes.** Backward-compat confirmed (existing 5 tests hold, `deps.refresh` unchanged, independent try/catch, `require.main` guard verified). Fixed: the inline self-test fixture loop still listed Pinellas → trimmed; stale "Orange/Pinellas/Broward" comments in `probate-official-records.ts` + `dispatch/index.ts` → corrected.
- **UI/plan-conformance: CLEAN + 1 fix.** Field names consistent across all 5 interfaces + mapper (table-checked); `Scale` imported everywhere; "No distress flags" guard excludes probate; no duplicate disclosure; `attorneyName` correctly absent; no seeded probate values. Fixed: the promote endpoint mislabeled a promoted probate-only lead as `parcel-lien-bridge` → added the `parcel-probate-bridge` branch (priority auction>tax>probate) so the Probate badge survives the first action.

## Open items (fast-follows, NOT in this change)
- **Probate detail-field persistence on promote.** The promote path now keeps the probate `dataSource` (badge survives), but the promoted `Property` row has no `decedentName`/`dateOfDeath`/etc. columns, so those detail cells stop rendering after promote. Surfacing them needs a `Property` schema extension + carry-through (same class as `attorneyName`). Deferred.
- **`attorneyName` in the lead card** — needs a `ProbateSummary` schema+rescore extension (it lives on `ProbateCase`).
- Pinellas tax-delinquent coverage (the OTHER stacking lever).

## Activation (post-merge/deploy — documented, NOT done here; code isn't on Railway yet)
- #2: after merge+deploy, targeted-enable the `pinellas-probate-csv` registry row in prod (worker auto-schedules in 60s). Do NOT run the full seed (it re-asserts every row, clobbering scraper-health auto-disables).
- #3: on Railway (where `TWOCAPTCHA_API_KEY` is set), run the registry seed so `probate-official-records` flips `enabled=true`; redeploy worker-bullmq.
