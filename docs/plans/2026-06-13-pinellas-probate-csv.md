# Plan — Pinellas probate captcha-free CSV ingester (M3.1 / OPS-8)

> **Process note (honest):** this plan is a **plan-of-record written after** the code, not before
> it — the work skipped tworkflow's plan gate (tworkflow wasn't wired into the repo at the time;
> fixed 2026-06-13). It exists so Review (plan-conformance lens) and Retro have an artifact. A
> **second wave** (decedent-vitals/attorney column persistence) was then built on top, and it ALSO
> bypassed the gate — that drift was caught at the Ship gate (2026-06-13) and the second wave was
> given its own fresh-context review + QA before shipping (see "Scope expansion" + "Review (wave 2)"
> below). Going forward, plan precedes code.

## Problem
M3.1 (probate ingest) was blocked behind reCAPTCHA on all three target counties (Orange/Pinellas/
Broward). The OPS-8 discovery sweep (2026-06-13) found Pinellas publishes new-estate filings as an
**open, login-free, captcha-free daily CSV directory** — a $0, zero-risk path that also carries
fields the gated portal doesn't (DOB, Date of Death, attorney). Ingest it into `ProbateCase`,
**and** persist those richer fields (Date-of-Death is the peak-motivation-window driver — the whole
reason this path was chosen over the portal).

## Scope (final — expanded 2026-06-13)
**In scope:**
- Captcha-free daily-CSV ingester for Pinellas (12103) new-estate filings → `ProbateCase`.
- **Persist decedent DOB / Date-of-Death + petitioner's attorney name/address** (wave 2). Required a
  `ProbateCase` schema extension (`prisma db push`, additive nullable columns) + a re-backfill.
- **Carry Date-of-Death up into `ProbateSummary.dateOfDeath`** in `rescore-probate.ts` (code only —
  see deferred below).

## Non-goals (deferred to their own plans)
- Orange / Broward (still reCAPTCHA-gated → handled separately via 2captcha; their own plan).
- **Running** the `ProbateSummary` rescore (parcel-matching + aggregate) — `rescore-probate.ts` now
  carries `dateOfDeath` through the SQL, but rescore has NOT been executed; `ProbateSummary` is still
  0 rows. Populating it is a downstream wave (needs parcel matching first).
- The recurring daily-refresh cron (`ScrapeRegistry` row for `pinellas-probate-csv` + worker
  queue-path verification) — separate, see Open items.

## Premises (verified live 2026-06-13)
- ✅ Endpoint open + captcha-free: `publicfiles.mypinellasclerk.gov/.../NEW_ESTATE_CASE_FILINGS_DAILY/` — HTTP 200, ~90 daily `.csv`, no captcha markers.
- ✅ Filename pattern `EstateNewCaseFilingsDaily_MM-DD-YYYY.csv`; 19-column header confirmed against a real file.
- ✅ CSV is **non-RFC**: unquoted commas inside the attorney-address field → naive `split(",")` over-shards. (Caught on a live row; drove the anchored parser.)
- ✅ `ProbateCase` model exists, dedup key `@@unique([countyFips, caseNumber])`; `normalizeCaseType`/`normalizeDecedentName` are exported from `probate-mvc.ts`.
- ✅ `politeFetch(url,{useProxy:false})` is the green-zone fetch; `ScraperAdapter`/`RunResult` contract in `dispatch/types.ts`; adapters registered in `dispatch/index.ts`.
- ✅ (wave 2) Prod schema change is **purely additive** — verified read-only via `prisma migrate diff` before pushing: 5 nullable columns + 2 indexes, ZERO drops.

## Design (existing code reused)
- New vendor `lib/scrapers/vendors/pinellas-probate-csv.ts`: pure parser (`parseProbateCsvRow` anchors on cols 0-2 + the trailing Uniform Case Number + the first MM/DD/YYYY date, so Title/Address commas are absorbed), `toProbateCaseInput` (assembles `LAST, FIRST MIDDLE`; PR name; attorney name; carries DOB/DOD/attorney-address), a **dedicated** `persistRow` upsert with `source:"probate:pinellas-publicfiles-csv"` (distinct provenance; reuses `normalizeCaseType`/`normalizeDecedentName`; writes the 4 new columns with `?? undefined` first-writer-wins semantics), and `scrapePinellasProbateCsv` (date-walk loop, `politeFetch` direct, 404=no-filing-day skip, idempotent upsert).
- **Schema (wave 2):** `ProbateCase` += `decedentDob`, `decedentDateOfDeath`, `attorneyName`, `attorneyAddress` (all nullable) + `@@index([decedentDateOfDeath])`. `ProbateSummary` += `dateOfDeath DateTime?` + `@@index([dateOfDeath])`.
- **`rescore-probate.ts` (wave 2):** `refreshProbateSummary` threads `dateOfDeath` through the `INSERT…SELECT…ON CONFLICT` (`MAX(pc."decedentDateOfDeath") AS "dateOfDeath"` in the inner aggregate → carried to `ProbateSummary."dateOfDeath"`).
- New dispatch adapter `lib/scrapers/dispatch/pinellas-probate-csv.ts` (incremental-date cursor) + registered in `dispatch/index.ts`.
- `scripts/run-pinellas-probate-backfill.ts` (one-shot 90-day load, no Redis) + `scripts/check-probate-status.ts` (read-only health snapshot).

## Failure modes considered
- Comma-in-address (handled: anchored parse). Comma-in-Title (handled: first-date anchor). Missing Case-Create-Date → row rejected, not corrupted. Weekend/no-filing day → 404 skip. Re-runs → idempotent upsert (dedup key). First-writer-wins on `source` + on the new columns (`?? undefined` never null-clobbers an existing value) — matches `persistProbateCase`. Mid-list column added to the rescore `INSERT…SELECT` → verified positional alignment (wave-2 review).

## Test plan
- vitest `tests/scrapers/pinellas-probate-csv.test.ts` (**13 cases**): clean row, comma-address row, comma-Title row, header/blank/short rejection, BOM strip, full-file parse, mapper assembly (incl. DOB/DOD/attorney), Title fallback, `parseDate` UTC-safety, filename builder. **Status: 13/13 green.**
- `npm run typecheck`: **exit 0 (root + workers)** — confirms the Prisma client was regenerated against the new schema.
- `npm run test` (full suite): probate 13/13 + 79 unit tests pass. The 9 failures are pre-existing `panels.*.spec.ts` integration tests (need a live `:3000` server) and `g1/g2` skip (no `DATABASE_URL` in the vitest env) — unrelated to this change, red on `main` too.
- `npm run lint`: this diff's files are clean (0 errors; 2 warnings that match the repo-wide `eslint-disable no-console` script convention). The 19 lint *errors* are all pre-existing repo files, none touched by this change.
- Full 90-day backfill against prod (post-`db push`): **89 files, 2 no-filing days, 806 rows processed, 772 distinct cases, 0 errors, 76.7s.**

## Steps (as built)
1. Vendor parser + persist + scrape. 2. vitest. 3. Dispatch adapter + register. 4. Backfill script. 5. Health-check script. 6. Smoke (2-day) → full backfill (90-day). **(wave 2)** 7. Schema extension. 8. `persistRow` + `rescore` thread the new columns. 9. `prisma migrate diff` preflight → `prisma db push` (additive). 10. Re-backfill to populate. 11. Fresh-context review of the wave-2 delta + population QA.

## Open items (not in this change)
- Recurring daily-refresh: needs a `ScrapeRegistry` row for `pinellas-probate-csv` + verification the worker-bullmq cron/queue path covers `publicfiles.mypinellasclerk.gov` (its domain isn't in `trigger-scraper.ts` QUEUE_BY_DOMAIN).
- **Running** `rescore-probate.ts` to populate `ProbateSummary` (needs parcel matching; `ProbateSummary` is 0 rows today).
- (Pre-existing, noted by wave-2 security lens) `rescore-probate.ts` uses `$queryRawUnsafe` with `${countyFips}` interpolation — neutralized by the `digits()` guard (FIPS are digit-only), NOT introduced by this delta. Candidate cleanup: switch to a `$executeRaw` tagged template.

## Review (wave 1 — three fresh-context lenses, subagents)
- **Correctness:** HIGH `parseDate` parsed MM/DD/YYYY via `new Date()` (local time, off-by-a-day off-UTC) → **fixed** (explicit UTC). MED cursor advanced on 404 (transient 404 skips a real day) → **fixed** (advance only on a parsed file; re-scan self-heals). MED `outcome="empty"` on idempotent re-runs → **fixed** (base on `rowsFound`). Tests judged substantive.
- **Security:** MED no body-size cap before `res.text()` → **fixed** (`MAX_CSV_BYTES` + Content-Length guard). MED HTTP-200 HTML error page parsed silently as empty → **fixed** (content-type / `<`-sniff). Injection/TLS/deps/secrets/scope: clean.
- **Plan conformance:** HIGH `prAppointedAt` omitted from `create` (drift vs canonical) → **fixed** (`: null` parity). Non-goals untouched; no surprise files; `probate-mvc.ts` unmodified; hand-rolled parser justified (non-RFC CSV).
- **Rejected with evidence:** "`personalRepresentative ?? undefined` should clear nulls" — matches canonical `persistProbateCase` (intentional first-writer-wins). "error-log may leak `DATABASE_URL`" — pre-existing repo-wide pattern, out of scope.

## Review (wave 2 — column persistence delta; three fresh-context lenses, 2026-06-13)
- **Correctness: CLEAN.** Primary risk was the rescore `INSERT…SELECT` with `dateOfDeath` spliced mid-list — traced position-by-position across the INSERT column list, outer SELECT (`sub."dateOfDeath"`), inner alias (`MAX(pc."decedentDateOfDeath") AS "dateOfDeath"`), and `ON CONFLICT DO UPDATE` — all name-consistent, no column mis-assignment. `persistRow`'s `?? undefined` never null-clobbers; `parseDate` handles ""/garbage; schema types match the writes; re-backfill idempotent.
- **Security: clean for the delta.** All 4 CSV-sourced fields are written via parameterized Prisma upsert (never touch raw SQL). One [HIGH/82] note = the pre-existing `${countyFips}` `$queryRawUnsafe` (guarded by `digits()`, not added by this delta) → logged as Open item, not a blocker. No new deps, no secret leakage.
- **Plan conformance: CLEAN.** Every written column exists in schema with matching name+type (table-checked both directions); dispatch export/registration consistent; `probate-mvc.ts` confirmed untouched; no surprise edits.

## QA (2026-06-13)
- No UI → no visual QA. Functional/data QA, post-`db push` re-backfill: **89 daily files, 2 no-filing days, 806 rows processed, 772 distinct `ProbateCase` rows, 0 errors (76.7s).**
- **Column population (verified via read-only probe):** `decedentDateOfDeath` 571/772 (74%), `decedentDob` 53/772 (7% — sparse in the feed), `attorneyName` 772/772 (100%), `attorneyAddress` 772/772 (100%). Sample rows spot-checked, incl. the ROOTH & ROOTH unquoted-comma-address case (`POWELL` → attorney `MARIE R ZORRILLA`, DoD 2026-05-12) — parsed correctly end-to-end.
- **806 vs 772 clarified:** 806 = CSV data rows across the 89 files (upsert operations / `rowsFound`); 772 = distinct `caseNumber` (table rows). 34 cases recur across daily files. Earlier docs that said "806 rows" were citing the rows-processed counter — no data loss ever occurred.
- Not unit-tested: the fetch/scrape I/O loop + `persistRow` (DB-bound) — covered by the live backfill + the population probe instead; `parseDate`/mapper are unit-tested.

## Retro (post-ship)
- **Wrong process (×2):** both the base ingester and the wave-2 column work were built before planning, because tworkflow wasn't wired into this repo at the time. Wave 2's drift (schema + persist + rescore beyond the documented non-goals) was caught only at the Ship gate by diffing the working tree against the handoff's file list. → Going forward: plan gate first; at Ship, always diff the working tree against the plan's stated scope, not the handoff prose.
- **Premise that bit:** assumed the CSV was RFC-4180; it isn't. Caught by pulling a real row before coding. → candidate context-file line: "FL clerk CSV feeds are frequently non-RFC; pull a real row before writing a parser."
- **Counter mislabel:** "806 rows" in the handoff was actually the upsert-operation count, not the distinct-row count (772). → candidate lesson: label data counters as ops-vs-distinct explicitly; never cite a `persisted`/`rowsFound` number as a table row count.
