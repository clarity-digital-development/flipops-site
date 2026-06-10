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
- [ ] **TelnyxNumber DB seed** — `scripts/seed-telnyx-number.ts` exists and is idempotent, but **BLOCKED on a User row existing** (DB has 0 users; Clerk webhook isn't wired locally; M1.1 jit-provisioning OR first prod sign-in fixes this). Run: `DATABASE_URL=... TELNYX_DEFAULT_SMS_FROM=+19046220099 TELNYX_OWNER_EMAIL=tannercarlson@vvsvault.com npx tsx scripts/seed-telnyx-number.ts`
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

## Known landmines (learned the hard way — don't re-trip)

- Railway DB endpoint can rotate (mainline→turntable happened once). ECONNRESETs = check Connect tab.
- `railway variables --set` without `--skip-deploys` triggers immediate redeploy per call — batch flags.
- `railway service` (no args) opens an interactive TUI that hangs headless shells — always pass `--service <name>`. Services: `flipops-site`, `worker-bullmq`.
- Workflow-tool scripts reject literal `Math.random()` / `Date.now()` / `new Date()` SUBSTRINGS anywhere in the script including inside agent prompt strings — write around them.
- Parallel apply-agents with strict JSON schemas sometimes fail StructuredOutput on big lanes — use minimal schemas ({applied, failed, notes}) and skip in-agent typechecks.
- Bash heredocs choke on apostrophes in commit messages — use `git commit -F <file>`.
- HTML entities in Workflow patch JSON (&lt; &gt; &amp;) must be unescaped before Edit.
