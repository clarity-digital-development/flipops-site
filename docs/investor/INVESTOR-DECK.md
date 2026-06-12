# FlipOps — Investor Deck (draft)

> M3.7 deliverable. Every number is labeled by confidence:
> **[verified]** production-verified, repo-sourced · **[competitor-asserted]** founder claim,
> verify before citing externally · **[aspirational]** roadmap, not yet built/live.
> Pricing per founder decision (2026-06-12): **$99 / $299 / $599**.
> Draft for founder review — positioning/voice is yours to refine. Data-moat numbers
> deepen as the 2009–2024 SDF backfill lands (in progress).

---

## 1 · One-liner

**Goliath finds you a lead. REsimpli organizes your follow-up. FlipOps owns the data layer underneath both — and runs the deal from first signal to sold.**

A vertically-integrated real-estate-investing platform built on a **self-scraped, statewide property + distress dataset** — the layer competitors rent piecemeal.

---

## 2 · The problem

- Real-estate investors stitch together **6+ tools** (data, skip-trace, CRM, comps, dialer, project mgmt) — **$500–$2,000/mo** of fragmented subscriptions. *[verified — itemized in product blog + savings calculator]*
- The data vendors underneath them are **dead ends**: ATTOM, CoreLogic/Cotality, REAPI — expensive, gated, or defunct for this use case. *[verified — all vendor integrations removed from the codebase]*
- Distress "lists" (auctions, liens, probate) are only useful **joined to a full ownership/value/equity parcel universe** — which the list-sellers don't have.

---

## 3 · The moat (3 parts)

**Part 1 — Parcel-universe depth (the base layer competitors lack).**
- **10,998,035 parcels, 67/67 FL counties, 1,976,625 recorded sales.** *[verified]*
- Completeness: ownerName/marketValue/assessedValue/propertyType **100%**; situsAddress **96%**; **geocode 94.8%** (10.43M); **owner-occupancy 96%** (5.59M owner-occ / 4.97M absentee). *[verified]*
- $758.8M tax-delinquency exposure mapped. *[verified]*
- Thesis: Goliath scrapes distress *events* but lacks our parcel base layer; events without the universe are noise.

**Part 2 — Included-vs-add-on economics.**
- One platform replacing 6+ subscriptions. The same signal types competitors charge add-ons for (e.g. probate lists ~+$600/mo at Goliath) ship **in core at ~$0 COGS**. *[competitor-asserted — the Goliath $4.9M-raised / +$600/mo figures appear only in internal planning docs; verify before external use]*

**Part 3 — Lifecycle coverage ("first signal to sold").**
- Signal → score → underwrite → rehab → disposition, all built in-repo. REsimpli is a CRM that **stops at contract**; the "runs the deal to sold" half is FlipOps-only.
- **The score explains itself.** Propensity-v1 model is **PROMOTED**: holdout **AUC 0.8281 vs 0.5155 baseline**, 45,983 parcels scored live. *[verified]* No competitor offers anything but a static "motivation: HIGH."

---

## 4 · The product (what's live)

| Stage | What it does | Status |
|---|---|---|
| **Signal** | Tax-delinquency, foreclosure/auction, tax-deed, code-violation, (probate) distress — self-scraped | Live *(probate captcha-gated — [aspirational])* |
| **Score** | Two-tier learned scoring: per-county platform ML + account behavioral; propensity P(sale 12mo) | Layer-1 live (2 metros) |
| **Underwrite** | Real recorded comps (ParcelSale) + AVM v1 ARV-prior (9.72% vs 11.36% APE, 1.5M valuations) + ZIP-aware MAO | Live *[verified]* |
| **Rehab** | Scope, budget, bids, change-order guardrails (G1–G4) | Live (enforcement in API/cron) |
| **Disposition** | Listing prep, agent handoff, list-vs-ARV, sale-side net sheet | Live *[verified]* |

---

## 5 · Traction / data (numbers safe to show)

`10,998,035 parcels` · `67/67 FL counties` · `1,976,625 sales` (→ 2009 as SDF backfill lands) · `94.8% geocode` · `96% owner-occupancy` · `$758.8M tax exposure` · `AVM 9.72% APE` (1.5M valuations) · `propensity AUC 0.8281` (45,983 scored) · `~$0 data COGS`. *[all verified]*

---

## 6 · Business model

- **$0-COGS data moat.** Property/distress data is self-scraped → **~$0 marginal data cost**. The only variable costs: optional skip-trace **$0.20/record** (BatchData, user-triggered add-on) and **proxy bandwidth** (~$1/GB DataImpulse vs $3–15/GB Bright Data). *[verified; per-GB figures from ops memory]*
- Replicates the **Cotality Property Domain (981 fields)** schema by scraping at **$0 license**. *[verified — FL-COVERAGE-PLAN]*
- **Pricing: $99 / $299 / $599** (three self-serve tiers), enterprise above by quote. *[founder decision — reconcile site + billing backend to match]*
- Strong gross-margin story: the input that costs competitors the most (data) costs FlipOps ~$0.

---

## 7 · Expansion — FL → TX → GA → AZ → NC

Templated, scraper-driven. ~40% of US investor activity in these 5 states. *[aspirational — TX/GA/AZ/NC are roadmap, not built]*

| State | Build est. | Leverage |
|---|---|---|
| FL | shipped | DOR statewide roll + RealAuction(16) + Grant Street(~30) |
| TX | **3–4 wk** | 5 metro CADs ≈ 70% of TX pop; net-new NTSA scrapers |
| GA | **2 wk** | GA DOR roll + Garaventa (~80/159 counties, one scraper) |
| AZ | **1–2 wk** | AZ DOR + Maricopa ≈ 60%+ of AZ |
| NC | **2–3 wk** | County roll exports + TruWeb (~30 counties) |

**Per-state ETA after the first: 1–3 weeks.** The F2 platform-reuse matrix (qPublic/Schneider ~700 counties; iasWorld/Tyler ~3,000 jurisdictions) means FL-built scrapers already cover much of TX/GA/NC/AL/OH distress data with only URL-list expansion. *[verified — NATIONAL-EXPANSION-MAP]*

---

## 8 · Competition

| | FlipOps | Goliath Data | REsimpli |
|---|---|---|---|
| Parcel universe | **Statewide, owned** | rents/partial | none (CRM) |
| Distress signals | included, ~$0 COGS | add-ons (e.g. +$600/mo probate) *[competitor-asserted]* | n/a |
| Calibrated propensity | **AUC 0.83 model** | static "HIGH" | none |
| Lifecycle | signal → **sold** | lead-gen only | stops at contract |

---

## 9 · Honest risks (and mitigations)

1. **Single-state concentration** — 100% live coverage is FL. → Templated expansion, **sequence TX fast**.
2. **Scraper fragility** — per-host egress is brittle (WAFs, captcha, SPA). → Kill-switches, audit rows, proxy-provider agility; the estate is documented (see SCRAPER-RUNBOOKS.md).
3. **Captcha/SPA-gated sources** — probate (the gold-standard motivated-seller signal), Landmark counties, Miami-Dade ORI are **adapter-built but data-blocked** (0–unverified live rows) pending a captcha key (OPS-8). → Code + solver are real; flipping the key unblocks them.
4. **Model scope is narrow today** — propensity trained on 2 metros (Dade+Broward); 66K other-county parcels are honestly NULL, not scored. → Retrains statewide as feature marts build.
5. **FL flip-volume dynamics** — macro risk. → TX-first expansion.
6. **TCPA** — compliance *architecture* is in place but consent-capture/DNC/STOP are pending (see TCPA-SUBSTANTIATION.md). → Remediation path documented; no live outreach until closed.
7. **Pricing/billing not yet reconciled in code** — Stripe backend has generic tiers; prices to be wired to $99/$299/$599. → Small, scoped.

---

## 10 · The ask

*[Founder to complete — raise amount, use of funds, milestones. Suggested use-of-funds frame: (a) unblock captcha-gated signals + statewide model, (b) TX expansion, (c) close TCPA + billing for go-to-market.]*

---

### Appendix — number confidence index
**[verified]:** parcels/counties/sales, geocode 94.8%, owner-occ 96%, $758.8M, AVM 9.72% APE / 1.5M valuations, propensity AUC 0.8281 / 45,983 scored, ~$0 COGS / $0.20 skip-trace, per-state ETAs.
**[competitor-asserted]:** Goliath $4.9M raised / +$600/mo add-ons (internal docs only).
**[aspirational]:** all non-FL coverage; probate live data; full 2009–2023 sale depth (SDF backfill in progress); $99/$299/$599 not yet wired into billing.
