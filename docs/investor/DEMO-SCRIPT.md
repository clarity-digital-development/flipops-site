# FlipOps Investor Demo — Walkthrough Script

> M3.7 deliverable. The 6-step "first signal → sold" walkthrough. **Done-when bar:**
> runs end-to-end without a single fabricated number.
>
> **Good news from the audit:** Steps 1–4 and 6 are genuinely real-data-backed (every
> API computes from production tables; seed fallbacks were stripped — pages render honest
> empty states on zero data). The work here is **pre-flight setup** so you never hit an
> empty state or a demo-mode short-circuit on camera.
>
> Verified against code 2026-06-12.

---

## ⚑ Pre-flight checklist (do this BEFORE recording)

1. **Sign in** as a demo account and **promote ≥1 real Miami-Dade or Broward lead.** Two reasons:
   - The propensity model (`P(sale 12mo)`) is live **only in Miami-Dade + Broward** (45,983 parcels). Outside those metros the tooltip silently disappears.
   - With ≥1 real property, the underwriting page uses the **real** path — never the synthetic "demo mode" (see ⚠ below).
2. **Confirm the SDF backfill has landed** (`ParcelSale` spanning ~2009→present) so the comps depth in Step 4 is at its strongest. (Until then, comps are real but shallower — still honest, just fewer.)
3. **Do NOT click "Try with a sample property"** on the underwriting page (see ⚠ #1).
4. (Optional) Decide whether Steps 5–6 are shown **empty** (honest) or pre-populated with a **clearly-disclosed seeded fixture** deal — those rows are real DB rows with synthetic content; don't present seeded content as scraped data.

---

## The walkthrough

### Step 1 — Coverage proof · `/app/data-sources`
- **Say:** *"All 67 Florida counties, ~11M parcels — scraped from public records, zero data vendors."*
- **Shows:** headline band (parcels, counties, sales, tax-delinquent count + $ owed, foreclosure filings, scheduled auctions), 67-county coverage grid, per-source freshness cards with `BulkIngestJob` audit receipts.
- **Real?** ✅ YES. `app/api/data-health/route.ts:177-353` computes every number live from `Parcel`/`ParcelSale`/`TaxDelinquencySummary`/`Foreclosure`/`AuctionSummary`/`ScrapeRegistry`/`BulkIngestJob`. Shows an error state (never fabricated numbers) if the endpoint fails.

### Step 2 — Distress signal + calibrated propensity · `/app/leads`
- **Say:** *"A real distressed parcel surfaces with a motivation score. Hover it — that's the model's calibrated probability the owner sells in the next 12 months. No competitor has anything but a static 'motivation: HIGH'."*
- **Shows:** map + list; score chip with hover tooltip listing distress signals + `P(sale 12mo): XX% — model v1`.
- **Real?** ✅ YES. `/api/properties` is a real 3-branch UNION (owned Property + tax-virtual + auction-virtual) with SQL-side dedup. Propensity comes from `TaxDelinquencySummary.propensity12mo` + its `ModelVersion` (holdout AUC **0.8281**). Page shows `EmptyState` on error — no seed array imported.
- **⚠ Demo a Miami-Dade or Broward parcel** (propensity is metro-limited; honest absence elsewhere).

### Step 3 — Lifecycle timeline + auction calendar · `/app/properties/[id]` + `/app/auctions`
- **Say:** *"Every dated county record for this parcel — sold → mortgage → tax-delinquent → lis pendens → scheduled auction — and a live calendar of every upcoming sale."*
- **Shows:** vertical signals timeline (future events with countdown) + month-grid auction calendar with county filter.
- **Real?** ✅ YES. `app/api/properties/[id]/signals/route.ts:192-357` merges real `ParcelSale`/`Mortgage`/`Lien`/`TaxDelinquencySummary`/`Foreclosure`/`AuctionSummary`; honest empty state when none. Calendar aggregates `AuctionSummary JOIN Parcel`; rows deep-link via real `virt-fc-{fips}-{apn}` ids.

### Step 4 — One-click underwriting · `/app/underwriting`
- **Say:** *"Send to underwriting: real recorded comps from the county sales roll, plus an independent AVM ARV-prior with its confidence band — then repairs, MAO, and exit scenarios."*
- **Shows:** comps grid (ParcelSale-derived), ARV method selector, AVM v1 prior + ZIP liquidity, repairs/MAO/exit tabs.
- **Real?** ✅ YES for real leads. Comps: `app/api/comps/route.ts:194-221` queries `ParcelSale JOIN Parcel`, arms-length qual codes 01/02 only, real haversine distance or `null` (never fabricated). AVM: `app/api/valuation/route.ts:104-142` reads `ParcelValuation` (avm-v1, 9.72% APE). The old "1234 Oak Street" demo comps are **gone** from the real path.
- **⚠ #1 — NEVER click "Try with a sample property"** (`page-content.tsx:1072`). It builds a fully synthetic deal ("Demo · 1234 Jacksonville Pl", 6 fake comps, hardcoded $372k AVM). It's clearly labeled + save/offer blocked, and only appears on an empty account — but every number on screen would be fabricated. The pre-flight (≥1 real promoted lead) avoids it entirely.

### Step 5 — Guardrailed rehab · `/app/renovations`
- **Say:** *"Rehab projects with scope, budget gauges, bids, and change-order guardrails (G1–G4)."*
- **Shows:** renovation cards/kanban, budget gauges, bids, change orders.
- **Real?** ✅ Real data (DealSpec scoped to user, honest EmptyState) — **but empty unless seeded** (requires a closed Contract→DealSpec). **Caveat:** the G1–G4 guardrails are enforced in **cron + API** (`app/api/bids/award`, `change-orders/submit`, `deals/approve`), **not surfaced as visible "G1–G4" UI** on this page. If the narrative needs visible guardrails, point to the enforcement (rejected bid / blocked change order) rather than a dashboard. If shown populated, disclose it's a seeded fixture deal.

### Step 6 — Disposition · `/app/buyers` (Disposition tab)
- **Say:** *"Completed flips flow into disposition: agent handoff, prep checklist, list-price-vs-ARV variance, and the sale-side net sheet."*
- **Shows:** ready-to-list candidates + active listings with editable net-sheet waterfall.
- **Real?** ✅ YES. `disposition-panel.tsx` fetches `/api/disposition` + `/api/disposition/candidates`; net sheet computed from real listing fields; honest EmptyState when empty; candidate AVM est. is the real `ParcelValuation` block. (The fabricated `netToSeller` 0.9× was fixed → `—`.) Empty unless a completed renovation exists.

---

## What NOT to show / claims to avoid

- ❌ Don't click **"Try with a sample property"** (Step 4) — synthetic.
- ❌ Don't claim **calibrated propensity on every lead** — it's Miami-Dade + Broward only today.
- ❌ Don't claim **probate / inherited** leads are live — those signals are captcha-gated (OPS-8) with **0 live rows**.
- ❌ Don't claim **nationwide** coverage — Florida only (the marketing copy was corrected to match).
- ❌ Don't present **seeded renovation/disposition fixtures** as scraped data — disclose or show empty.

## Net assessment
Steps 1–4 and 6 are demonstrably real-data-backed with honest empty states and model provenance. The data moat (Step 1), the propensity model (Step 2, Dade/Broward), the signals timeline + auction calendar (Step 3), and real comps + AVM prior (Step 4) are the strongest, genuinely-real surfaces — lead with them.
