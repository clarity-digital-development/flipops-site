# OPERATIONS — Provisioning, Credentials, Carry-Overs

> Rolling ledger of manual/ops items that aren't feature work. Check off in place.
> These block specific roadmap items as noted.

---

## OPS-1 — Credential rotation (SECURITY, do soon)

All of these were exposed in plaintext during dev sessions (chat logs / CLI output / committed-then-removed files). None are in current source, but treat as compromised:

- [ ] **Railway PG password** (`qTKXEudW...` — exposed in CLI output 2026-06-09). Railway dashboard → Postgres → reset. Then update DATABASE_URL on flipops-site + worker-bullmq + local .env.local. **NOTE: every running scraper/cron dies until vars update — do all three in one sitting.**
- [ ] **FLIPOPS_API_KEY** (`fo_live_1017...` — exposed same dump). Generate new, update Railway both services + any cron callers.
- [ ] **Telnyx API key** (pasted in chat 2026-06-09). Telnyx Portal → API Keys → regenerate. Update .env.local + Railway both services.
- [ ] **n8n JWT** (was hardcoded in deleted scripts). n8n instance is being decommissioned anyway — verify it's dead or rotate.
- [ ] **ATTOM key** `72403894...` (was in 20 deleted scripts). Dead provider; revoke at ATTOM portal if account still exists.
- [ ] **Stale Railway vars cleanup**: CLERK_* stays until M3.6. Remove `BRIGHT_DATA_PROXY_URL` (replaced by DataImpulse PROXY_URL — verify first).

## OPS-2 — Telnyx provisioning (blocks Dialer dogfood)

- [x] Account created, VERIFIED badge (2026-06-09)
- [x] 10DLC brand + campaign registration SUBMITTED (2026-06-09) — **1-3 week regulatory wait; check status weekly at Portal → Messaging → 10DLC**
- [x] Number purchased: **+1-904-622-0099** (Jacksonville local)
- [x] API key + public key in .env.local + Railway (both services)
- [ ] **Messaging Profile → Inbound Settings**: webhook URL `https://flipops.io/api/webhooks/telnyx`, API version 2, failover = same URL
- [ ] Assign +19046220099 to the Messaging Profile
- [x] **TelnyxNumber DB seed** — DONE 2026-06-10: User row self-provisioned (tannercarlson@vvsvault.com) + TelnyxNumber +19046220099 ("Jacksonville primary"). messagingProfileId/connectionId still null — fill when Telnyx portal config lands.
- [ ] Later (Sprint-3 features): Telephony Credential (WebRTC FlipPhone) → TELNYX_TELEPHONY_CREDENTIAL_ID + TELNYX_SIP_USERNAME; Call Control App (RVM) → TELNYX_CALL_CONTROL_CONNECTION_ID; AI Assistant (Oppenheimer) → TELNYX_ASSISTANT_ID

## OPS-3 — Other provider provisioning (each blocks one Sprint-3 feature)

- [ ] **DocuSign** developer account → JWT consent grant → DOCUSIGN_INTEGRATION_KEY / USER_ID / ACCOUNT_ID / PRIVATE_KEY / WEBHOOK_HMAC. Configure Connect webhook → /api/webhooks/docusign. (Blocks Documents e-sign.)
- [ ] **Stripe** account → 2 products/prices (Pro, Enterprise) → Customer Portal config → STRIPE_SECRET_KEY / WEBHOOK_SECRET / PRICE_PRO / PRICE_ENTERPRISE. **Also: add /api/webhooks/stripe to middleware public-route matcher** (code TODO). (Blocks billing.)
- [ ] **Sentry** project → SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN + AUTH_TOKEN/ORG/PROJECT.
- [ ] **Nylas** app → OAuth redirect → NYLAS_API_KEY / CLIENT_ID / API_URI / WEBHOOK_SECRET. (Blocks real-email Inbox.)
- [ ] **AWS S3** (or R2) → bucket + IAM + CORS → AWS_REGION / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY. (Blocks uploads.)
- [ ] **BatchData** → reactivate account, top up → BATCHDATA_API_KEY. (Blocks Skip Trace.)
- [ ] **Mapbox** → public token (pk.*) → NEXT_PUBLIC_MAPBOX_TOKEN on Railway → **REBUILD required** (build-time inlined). URL-allowlist the token. (Blocks Leads map.)

## OPS-4 — Local dev environment

- [ ] `npm install` — package.json gained @telnyx/webrtc, @sentry/nextjs, stripe, @stripe/stripe-js (Sprint 3) but local node_modules doesn't have them (dev server shows module-not-found warnings; Railway installs fine on deploy).
- [ ] Dev server note: port 3000 often occupied → lands on 3001.
- [ ] Next.js 16 deprecation: middleware → proxy convention rename (cosmetic, future).

## OPS-5 — Standing verification rituals

- **Dogfood test plan**: `.gstack/qa-reports/DOGFOOD-TEST-PLAN-2026-06-08.md` — the full
  Sprint 1-3 verification checklist. Run after the OPS-2/OPS-3 provisioning lands.
- **Sam walkthrough loop**: the 2-agent visual+QA pipeline (walkthrough-script-2026-06-05.md)
  reached 10.0/10 on 2026-06-06. Re-run after major UI changes (M1.7, M3.4, M3.5).
- **prisma db push cadence**: after any schema change. Sequence: edit schema → db push →
  generate → THEN write code referencing new models (parallel agents writing code against
  unpushed schema = typecheck noise).

## OPS-7 — USER ACTION: request prior-vintage SDF files from FL DOR (2026-06-10)

The 2009-2023 sale history (M2.7) is NOT downloadable anywhere — DOR's portal hosts only 2025F
(verified dead ends: SharePoint vintage folders, Wayback, FGDL (layers pulled Oct 2025), old DOR
FTP, EDR). Prior vintages are **free by email request**:

- [ ] **Email PTOTechnology@floridarevenue.com**: request "Final SDF files, vintages 2010F
  through 2024F, all 67 counties" (each vintage V covers sale years V-1..V).
- [ ] When zips arrive: drop in `data/raw/fl-dor-sdf-backfill/<vintage>/` and run
  `npx tsx -r dotenv/config scripts/fl-dor-sdf-backfill.ts dotenv_config_path=.env.local`
  — auto-detects, newest-first, cross-vintage dedup via saleYear caps. ~30-60 min/vintage.
- Unlocks: comps depth, AVM training (M3.3), time-on-market features, propensity label depth.

## OPS-8 — RESOLVED: 2captcha solver wired for Landmark (2026-06-11)

DECISION (user 2026-06-11): provision a 2captcha-class solver. Built `lib/scrapers/base/captcha-solver.ts` (reCAPTCHA v2, provider-agnostic via `TWOCAPTCHA_API_KEY`, optional `CAPTCHA_SOLVER_BASE_URL` for anti-captcha/capmonster, ~$1-3/1k solves). Wired into the Landmark adapter + `run-landmark-local.ts --solve`. Registry row self-activates when the key is present.

USER ACTION to turn it on:
- [ ] Create a 2captcha.com account, fund it (~$10 covers thousands of solves), copy the API key.
- [ ] Add `TWOCAPTCHA_API_KEY=<key>` to `.env.local` (local) AND Railway `worker-bullmq`.
- [ ] Smoke local: `SCRAPER_DIRECT_EGRESS=1 TWOCAPTCHA_API_KEY=<key> DATABASE_URL=<public> npx tsx scripts/run-landmark-local.ts --county 12099 --days 3 --solve` → expect `outcome=ok` with persisted mortgage/lien rows for Palm Beach.
- [ ] Re-run `npx tsx prisma/seed-scrape-registry.ts` (with the key in env) to flip the registry row `enabled=true`.
- Levy (12075) = the small-county-reuse proof, identical code path. Lee (12071) needs proxy egress (datacenter direct times out).

## OPS-6 — govhub/TaxSys scrapers are residential-egress-only (2026-06-10)

The Broward + Hillsborough tax-delinquent CSV scrapers (TaxSys govhub portals) CANNOT run on the Railway worker yet:
- Datacenter egress: page 200s but report links absent (bot-wall).
- DataImpulse proxy: per-request IP rotation breaks the multi-step Playwright session (listing loads on IP A, CSV format button vanishes on IP B). **Fix = sticky-session proxy support** in PlaywrightSession (DataImpulse supports session pinning via username params) — backlog item.
- Operator runbook (residential machine): `SCRAPER_DIRECT_EGRESS=1 DATABASE_URL=<public> npx tsx scripts/run-tax-scrape-local.ts --scraper broward-tax-delinquent` (same for `hillsborough-tax-delinquent`), then `rescore-tax-delinquent.ts`. Cadence: monthly is plenty (certificates are an annual cycle).
- `SCRAPER_DIRECT_EGRESS=1` maps to useProxy **undefined** — explicit `useProxy:false` sets Chromium `direct://`, which times out page.goto on local Windows.
- Suspected nightly report-regeneration window (~1-2 AM ET) hides the CSV format button — retry outside that window before debugging.

## Known landmines (learned the hard way — don't re-trip)

- Railway DB endpoint can rotate (mainline→turntable happened once). ECONNRESETs = check Connect tab.
- `railway variables --set` without `--skip-deploys` triggers immediate redeploy per call — batch flags.
- `railway service` (no args) opens an interactive TUI that hangs headless shells — always pass `--service <name>`. Services: `flipops-site`, `worker-bullmq`.
- Workflow-tool scripts reject literal `Math.random()` / `Date.now()` / `new Date()` SUBSTRINGS anywhere in the script including inside agent prompt strings — write around them.
- Parallel apply-agents with strict JSON schemas sometimes fail StructuredOutput on big lanes — use minimal schemas ({applied, failed, notes}) and skip in-agent typechecks.
- Bash heredocs choke on apostrophes in commit messages — use `git commit -F <file>`.
- HTML entities in Workflow patch JSON (&lt; &gt; &amp;) must be unescaped before Edit.
