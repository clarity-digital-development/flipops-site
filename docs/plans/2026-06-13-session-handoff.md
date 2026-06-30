# Session Handoff: Pinellas probate ingest + tworkflow adoption + OPS-8

- **Date:** 2026-06-13
- **Plan:** [docs/plans/2026-06-13-pinellas-probate-csv.md](2026-06-13-pinellas-probate-csv.md)
- **Branch / last good commit:** `main` @ `ca173aa`. **All this session's work is UNCOMMITTED** in the
  working tree (no branch made yet — the Ship step is the pending next action). Changed/new:
  `CLAUDE.md` (M), `lib/scrapers/dispatch/index.ts` (M), and new: `lib/scrapers/vendors/pinellas-probate-csv.ts`,
  `lib/scrapers/dispatch/pinellas-probate-csv.ts`, `tests/scrapers/pinellas-probate-csv.test.ts`,
  `scripts/run-pinellas-probate-backfill.ts`, `scripts/check-probate-status.ts`, `docs/plans/2026-06-13-*.md`.

## Update — continuation session (2026-06-13)

At the Ship gate, a working-tree diff (not the handoff prose) revealed the tree had grown a **coupled,
unreviewed wave-2 delta**: `prisma/schema.prisma` (+4 `ProbateCase` cols, +`ProbateSummary.dateOfDeath`,
+2 indexes) and `scripts/rescore-probate.ts` (carry `dateOfDeath` up), with `pinellas-probate-csv.ts`'s
`persistRow` writing the new columns. Prod had **neither the columns nor the data** (`prisma db push` had
never run). Per user decision ("finish columns, ship all"), wave 2 was: fresh-context reviewed (clean),
`migrate diff`-previewed (additive only), `db push`'d to prod, and re-backfilled. See the plan's
"Scope expansion" + "Review (wave 2)" + "QA" sections. The DOD/DOB/attorney chip `task_9f1759d8` is
**resolved** by this ship.

## Where things stand

- **Pinellas probate CSV ingester — SHIPPED with the wave-2 column persistence (2026-06-13).** Wave 1
  (parser/scrape) 3-lens reviewed (5 fixes); wave 2 (columns) 3-lens reviewed (clean). vitest **13/13**,
  `typecheck` exit 0 (root + workers). Prod schema extended via `db push` (additive: 5 cols + 2 indexes).
  **Prod: 772 distinct `ProbateCase` rows** (`probate:pinellas-publicfiles-csv`, county 12103) from 806 CSV
  rows across 89 daily files; `decedentDateOfDeath` on 571 (74%), attorney name/address on 772 (100%).
  Only the daily-refresh cron remains.
- **Workflow governance:** tworkflow adopted as **governing** (gstack = optional tooling). `dev-workflow`
  + `context-checkpoint` skills installed at `~/.claude/skills/`; `flipops-site/CLAUDE.md` "## Workflow"
  section rewritten; memory updated. (tworkflow is the user's own version of the gstack-style loop — same philosophy, not competing.)

## Decisions made this session (not yet in the plan)

- **tworkflow governs, gstack optional** (user decision 2026-06-13). Captured in CLAUDE.md + memory.
- **OPS-8 path:** ran the discovery sweep → Pinellas is FREE (daily CSV, now ingested). User **funded 2captcha
  + redeployed** worker-bullmq with the key to unblock the two gated counties.
- **Records request for Orange = drafted but NOT sendable from here:** the Gmail connector is **draft-only**
  (no send tool), and Orange has **no records email** — its "online" channel is a LiveAgent helpdesk widget
  (or mail/in-person). With 2captcha live, the Orange request is now optional anyway.

## Next action

**Ship the Pinellas work** (user must confirm the push): `git checkout -b feat/pinellas-probate-csv` off
`main`; commit 1 = `CLAUDE.md` (docs: adopt tworkflow, retire gstack mandate); commit 2 = the ingest
(vendor + dispatch adapter + index registration + test + 2 scripts + plan/handoff docs); push; open PR
(body links the plan, which contains the review + QA artifacts).

## Open questions / known landmines

- **Orange/Broward will NOT auto-run despite the 2captcha redeploy.** `probate-official-records`
  ScrapeRegistry row is `enabled=false`, `lastRunAt=never`, cron `0 9 * * *`, domain `myorangeclerk.com`.
  Activation is its OWN next plan: (1) flip `enabled=true`; (2) **trim Pinellas out of the captcha adapter**
  (it runs all 3 P-MVC counties → wastes 2captcha solves on the now-free Pinellas); (3) verify the
  worker-bullmq cron/queue path covers `myorangeclerk.com`/`browardclerk.org` — they are NOT in
  `scripts/trigger-scraper.ts` `QUEUE_BY_DOMAIN`; (4) user redeploys worker-bullmq (it booted with the row
  disabled, so the schedule isn't registered).
- **Can't run/trigger the captcha adapter locally:** `TWOCAPTCHA_API_KEY` and `REDIS_URL` are NOT in local
  `.env.local` (key lives on Railway; Redis too). The captcha path must run on Railway. `DATABASE_URL`
  **is** in `flipops-site/.env.local` (that's how the Pinellas backfill ran). Never echo secrets.
- **Pinellas daily-refresh cron NOT wired.** The load was a one-shot direct script
  (`scripts/run-pinellas-probate-backfill.ts`) — 806 CSV rows processed → 772 distinct cases. Daily updates
  need a `ScrapeRegistry` row for `pinellas-probate-csv` + the same worker queue-path verification as above.
  (Note: "806" anywhere in earlier notes = rows-processed/upsert-ops, NOT table rows; the table holds 772
  distinct `caseNumber`s — 34 cases recur across daily files. No data loss.)
- **DOD/DOB/attorney columns — RESOLVED (chip `task_9f1759d8` closed).** `ProbateCase` now carries
  `decedentDob`/`decedentDateOfDeath`/`attorneyName`/`attorneyAddress` (+`ProbateSummary.dateOfDeath`),
  pushed to prod via `db push` (NEVER `migrate dev`) and populated by the re-backfill.
- **CSV is non-RFC** (unquoted commas in the attorney-address field). The parser anchors on rigid columns +
  the first MM/DD/YYYY date — do NOT naively swap in `csv-parse/sync` (it would mis-split those rows).
- **Full OPS-8 per-county source map** (Pinellas/Broward/Orange/PB/Lee/Levy/Hernando/Citrus + the no-statewide-
  shortcut finding) is in memory `project_ops8_county_source_map.md`.
- M3.1 status: Pinellas data done; M3 still 6/7 until Orange/Broward probate lands via the captcha activation.
