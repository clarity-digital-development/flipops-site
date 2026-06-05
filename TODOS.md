# TODOS

Deferred items from approved designs and reviews. Each item links back to the design doc that surfaced it.

## v0.2 — Leads UI auction extension polish — SHIPPED 2026-06-04

Both items shipped on the same day as v0.1 under ultracode mode, fast-forwarded past the original 2-week trigger window.

### ✅ e2e CI workflow (T5, commit baf68f7)
Shipped `.github/workflows/e2e-leads-auction.yml` — weekly cron (Mondays 10:00 UTC) + manual `workflow_dispatch` only. PR trigger intentionally omitted because the spec mutates DB state. Workflow is dual-gated on `vars.E2E_BASE_URL` + `secrets.E2E_DATABASE_URL` and skips cleanly until both are configured.

**Required before first meaningful run:**
- `vars.E2E_BASE_URL` (e.g. `https://flipops.io`)
- `secrets.E2E_DATABASE_URL` — NON-PROD postgres URL (Railway staging)
- `secrets.SLACK_WEBHOOK_URL` (optional) for failure notifications

### ✅ Seed fixture for auction parcel (T6, commit 56de992)
Shipped `tests/e2e/fixtures/auction-parcel.ts` — `test.extend` fixture that seeds Parcel + Foreclosure + AuctionSummary keyed on synthetic countyFips=`99001` with per-run UUID-suffixed apn/caseNumber. Self-heals against orphaned rows via startup `deleteMany` sweep + `upsert` writes. Hard prod-DB guard requires `E2E_ALLOW_DB_SEED=1`.

**Critical correctness fix discovered during T6:** the v0.1 spec asserted on a promote POST that never fired from row click alone. `handleSelect` in `page.tsx:136-142` only opens the sheet; promote is triggered by `withPromote()` wrappers on the action buttons (Skip Trace, Log Contact, Send to Underwriting, Add to Campaign — `page.tsx:398-401`). T6 spec now clicks `Log Contact` inside the sheet to fire promote correctly.

---

## v0.3 — surfaced during v0.2 review, not yet scheduled

### CI-only Clerk test session for /app(.*) bypass removal
**What:** The `/app(.*)` Clerk public-bypass at `middleware.ts:52` is a pre-launch TODO. When auth is re-enabled for beta, the e2e spec will break (page render redirects to sign-in, promote response 401s).
**Why:** Plan the test-session strategy before auth flip so the e2e doesn't go red the day Clerk auth lands.
**Options:** (a) wire `CLERK_SECRET_KEY` + a sign-in step in the spec, (b) add a shared-secret bypass header that middleware honors only when present.
**Trigger:** scheduled when Clerk auth re-enablement enters the active roadmap.

### Address `/api/properties` auction-virtual SQL column drift
**What:** Adversarial verifier flagged that the auction-virtual SQL references Parcel columns that may not exist on the current Parcel model (`bedrooms`, `bathrooms`, `lastSaleDate`). Out of v0.2 scope but worth a sanity pass.
**Trigger:** opportunistic — bundle with the next leads-page touch.
