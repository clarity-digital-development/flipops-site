# FlipOps Roadmap — Master Index

> **For future Claude sessions: READ THIS FILE FIRST.** It is the single source of truth for
> what's done, what's next, and what changed direction. It is deliberately small — detail
> lives in the month files. Never put implementation detail here; never let this file go stale.

**Born:** 2026-06-09, from the State of the Union audit (6 lanes + synthesis).
**Source reports:** `.gstack/qa-reports/AUDIT-A[1-6]-*.md` + `FLIPOPS-STATE-OF-THE-UNION-2026-06-09.md` (gitignored, local working tree).

---

## Session bootstrap (how to use this roadmap)

1. Read this README top to bottom (~2 min).
2. Check the **Direction Log** below — has anything pivoted since the plan was written?
3. Pick the next `TODO` item from the active month, respecting `Deps:`.
4. Load ONLY that month's file (`M1-foundations.md`, etc). Do not load all months.
5. After shipping an item: flip its status in the month file AND update the counters here.
6. If the user changes direction mid-stream: **do not abandon the plan** — add a Direction Log
   entry (date, what changed, why), mark affected items `DEFERRED` or `CUT` in their month file,
   and continue. The plan absorbs pivots; it doesn't die from them.

**Status vocabulary:** `TODO` · `IN-PROGRESS` · `DONE (commit)` · `DEFERRED (reason)` · `CUT (reason)` · `BLOCKED (on what)`

---

## The strategic frame (settled, do not relitigate)

- **Scrape > buy.** All third-party property-data providers are dead ends (ATTOM torn out,
  REAPI dormant/useless, CoreLogic/Cotality never bought). New data = new scrapers.
- **Flipper-primary, hybrid default.** Wholesaler surfaces are demoted, not deleted.
- **Competitors:** REsimpli (CRM, stops at contract) and Goliath Data ($4.9M raised, scrapes
  events but lacks our parcel base layer; charges +$600/mo for lists we ship in core).
- **One-liner:** "Goliath finds you a lead. REsimpli organizes your follow-up. FlipOps owns
  the data layer underneath both — and runs the deal from first signal to sold."
- **Auth:** Clerk is LIVE today. NextAuth migration is decided but NOT started (zero NextAuth
  code in repo). Migration is a 6-step sequence in M1/M2/M3. Do not delete Clerk code early.

## The three calendar-gated leaks (why M1 order matters)

1. **Label bleed** — 100% of behavioral telemetry is being dropped (auth bypass 401s +
   silent `no_user` drop). Every unfixed week = ML training data lost forever. M1.1.
2. **Civitek F2.1 unstarted** — the 296-field mortgage/lien bucket is 30% of the Cotality
   dictionary; coverage jumps ~17%→~48% when it lands. M2.1.
3. **Clerk migration incomplete** — gates ending the auth bypass (which gates the label fix)
   and is 41 files of debt. Step 1 (requireUser sweep) is M1.6; rest spread across M2/M3.

---

## Status counters

| Month | Theme | Items | Done | In progress |
|---|---|---|---|---|
| **M1** — `M1-foundations.md` | Stop the bleeding, ship the receipts | 9 | 8 | 1 (M1.3 big-6 geocode) |
| **M2** — `M2-coverage-and-intelligence.md` | Coverage multiplier + first model | 7 | 0 | 0 |
| **M3** — `M3-signals-and-demo.md` | New signals, AVM, investor demo | 7 | 0 | 0 |
| **OPS** — `OPERATIONS.md` | Provisioning, credentials, carry-overs | rolling | — | — |

**Active month: M1.** Done: M1.1 (label pipeline — anonymous events + transactional outcomes
+ repliedAt stamping + events-health stat), M1.2 (real comps), M1.5 (cleanup + scorer
extraction), M1.6 (requireUser sweep + JIT provisioning), M1.7 (Data Health page), M1.9
(CLAUDE.md fix). Remaining PARTIAL work: M1.3 + M1.8 (statewide geocode and owner-occupancy
backfill RUNS — code/schema ready), M1.4 (re-run Broward/Hillsborough scrapers + rescore in
prod — fixes are code-complete).

---

## Direction Log

> Append-only. Newest first. Every pivot gets one line: date · what changed · why · affected items.

- **2026-06-10** — M1 execution complete (8/9 DONE): production restored after 7-deploy outage (lockfile + Sentry/Turbopack), tax layer healthy ($758.8M/112K parcels), owner-occupancy 96% statewide (10.56M), geocode 63.2% (6.95M) — big-6 metros pending county-GIS sourcing (FGIO Hub 500s on >450K-parcel exports). Telnyx number seeded. Chunked-update pattern required for Railway proxy (39e2716).
- **2026-06-09** — M1 executed via 10-lane workflow; statewide geocode + owner-occupancy
  backfills queued as post-deploy runs. M1.1/M1.2/M1.5/M1.6/M1.7/M1.9 DONE; M1.3/M1.4/M1.8
  PARTIAL (details in M1-foundations.md).
- **2026-06-09** — Roadmap created from State of the Union audit. Baseline plan = the 90-day
  sequence in `FLIPOPS-STATE-OF-THE-UNION-2026-06-09.md`.
- **2026-06-09** — Auth reality check: user said "migrated away from Clerk" but repo has zero
  NextAuth code. Treating migration as decided-not-built; sequenced across M1.6/M2.5/M3.6.
- **2026-06-08/09 (pre-roadmap context)** — Dead-UI sprints 1-3 shipped (~60 elements wired or
  honest-deferred); Telnyx inbound SMS handler + owner-scoped lookup + 4 schema models shipped
  (TelnyxNumber, Notification.userId, Activity.userId, CampaignRecipient); n8n + ATTOM torn out
  (-49K lines); db push applied through commit `a9af3f7`.

---

## Hard constraints (apply to every item)

- `prisma db push` only — NEVER `prisma migrate dev` (drift wipes Railway data).
- Schema namespace is `flipops`; raw SQL needs `SET search_path TO flipops, public`.
- Push to origin before asking for Railway redeploy; `NEXT_PUBLIC_*` vars are build-time inlined.
- Shared Prisma singleton only; no `$disconnect()` in routes; no `!expectedKey` auth bypass.
- Scraping risk policy: green default, yellow with hardening checklist, red locked
  (see FL-COVERAGE-PLAN.md §5.1). Don't ask per-source approval for yellow.
- The DB has 10,998,035 Parcel rows. Test queries with LIMIT first; respect the
  32767 PG bind-var cap; long transactions need explicit 60s timeout.
