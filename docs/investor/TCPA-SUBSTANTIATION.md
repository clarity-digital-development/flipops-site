# FlipOps TCPA Compliance — Substantiation & Honest Status

> M3.7 deliverable. The roadmap's intent was "TCPA-safe by construction must become
> audited fact, not intent." This doc is that audit — and it is **honest**: the control
> *architecture* is real and well-designed, but three load-bearing pieces (consent capture,
> DNC scrub, STOP handling) are stubbed/unmigrated today.
>
> **Defensible claim:** *"Compliance architecture in place; vendor integrations and
> consent-capture UX pending before live outreach."*
> **Indefensible claim:** any operational metric (consents captured, numbers scrubbed,
> calls deferred) — those are currently zero.
>
> Verified against code 2026-06-12.

---

## 1. What's real (the control architecture — with evidence)

### Single outbound chokepoint
Every Telnyx send is reachable **only** through the dialer-dispatch worker. All non-doc callers of `sendSMS`/`sendRinglessVoicemail` are inside the worker (`lib/queues/workers/dialer-dispatch-worker.ts:77-78,100-101`). No API route or component calls the Telnyx wrappers directly. The `buyer-blasts` producer (`app/api/buyer-blasts/route.ts:250-259`) enqueues via the worker — it does not send directly. Live voice is WebRTC (outside this pipeline by design). Worker is registered at boot (`lib/cron/worker-bullmq.ts:554`).

### Gates run in the correct order and fail closed
`processDialerDispatchJob` (`dialer-dispatch-worker.ts:250-425`):
1. **Tenant required** (`:264-274`) — no `userId` → audit `tcpa-missing-tenant` + throw.
2. **Consent** (`:284-306`) — `hasConsent({ requireExpress: jobType !== "voice" })` (SMS/voicemail demand **express** consent per the FCC 2024 one-to-one rule). No consent → audit `tcpa-no-consent` + no send.
3. **DNC** (`:315-328`) — `checkDNC(toNumber)`; on-list → audit `tcpa-on-dnc` + return.
4. **State resolution** (`:330-343`) — `propertyState` else area-code fallback; unresolved → `tcpa-unknown-state` + throw (fails loud).
5. **Quiet hours** (`:345-381`) — `isWithinQuietHours`; outside window → re-enqueue with computed delay, audit `tcpa-deferred`.
6. Only then `dispatchToTelnyx` (`:386-388`).

This ordering and fail-closed posture is real, executable code.

### Quiet-hours data table — substantive
`lib/dialer/quiet-hours.ts:53-199` is a complete **50-state + DC** lookup with stricter-than-federal overrides cited to statute (FL §501.059, TX §304.052, CT §42-288a, …). `isWithinQuietHours` + `nextPermittedTime` are real pure functions. **(See gap #4 — timezone.)**

### Audit trail
Every gate outcome writes a `BulkIngestJob` row (`writeDispatchAudit`, `:194-248`) with `consentRecordId`, `dncCheckedAt`, deferred-until, state, status — best-effort so audit failure never masks a result.

---

## 2. Current gaps (honest — must close before claiming operational compliance)

| # | Gap | Evidence | Severity |
|---|---|---|---|
| 1 | **No consent CAPTURE.** Consent is *checked* (`lib/consent/check.ts` is real and fails closed) but **never written** — zero `consentRecord.create`/`upsert` anywhere. The `ConsentRecord` model isn't even in the live schema (only `prisma/schema.patch.consent.prisma`, unmerged). | grep `consentRecord.create` → none; `prisma/schema.prisma` has no `ConsentRecord` | **Blocker** |
| 2 | **DNC scrub does nothing.** `checkDNC` is a hardcoded stub returning `onDNC:false` (`lib/consent/dnc.ts:6,62`). No federal/state/litigator/internal list. The gate is structurally present but can never block a number. | `dnc.ts:6` ("STUB") | **Blocker** |
| 3 | **No STOP / opt-out handler.** The inbound SMS handler (`lib/telnyx/webhook-router.ts:482-579`) stamps `repliedAt` + notes but never inspects the body for STOP/UNSUBSCRIBE, never writes a revocation, never suppresses. Only Telnyx's carrier-level auto opt-out applies. | grep `STOP`/`revoke` in router → none | **Blocker** (hard TCPA requirement) |
| 4 | **Quiet hours use SERVER-local time, not recipient-local.** `getHours()` with no timezone conversion (`quiet-hours.ts:236,251`). On a UTC server (Railway default), an 8am–9pm FL window is evaluated in UTC → wrong wall-clock for the recipient. | `quiet-hours.ts:236,251` (no `Intl`/`timeZone`) | **Correctness bug** |
| 5 | **State→area-code resolution covers only FL + TX** ("subset for demo," `quiet-hours.ts:271`). Non-FL/TX numbers without `propertyState` fail closed (safe, but fallback is largely non-functional). | `quiet-hours.ts:270-285` | Medium |
| 6 | **No tests for any compliance module.** No `*{consent,dnc,quiet-hours,dialer-dispatch}*.test.ts`. The gating logic has zero automated proof it behaves as claimed. | glob → none | Medium |
| 7 | **UI is cosmetic.** `ConsentBadge` + the Oppenheimer quiet-hours display render from props/`DEMO_USER_STATE="FL"` (`oppenheimer.tsx:145`) — no enforcement. | `consent-badge.tsx`; `oppenheimer.tsx:672-683` | Low (display only) |

Current net effect: because consent-check fails closed when `ConsentRecord` is absent, **every SMS/voicemail job is refused today** — the pipeline sends nothing. That is *safe*, but "consent enforcement" is true only vacuously.

---

## 3. Remediation path to operational TCPA-safe (ordered)

1. **Migrate `ConsentRecord`** — apply `schema.patch.consent.prisma` (`db push` + `generate`). Add `channel` + (recommended) `ipAddress` fields; the model already has `consentSource`/`consentedAt`/`evidenceUrl`.
2. **Build consent capture** — landing-page opt-in writer + skip-trace-consent ingest + inbound-consent path. Nothing should be sent to a number without a written record.
3. **Wire a real DNC vendor** — federal FTC + state DNC + litigator/RND scrub + internal suppression list; fail closed on vendor error (the TODO is in `dnc.ts:8-37`).
4. **Add a STOP/opt-out handler** in `webhook-router.ts` — parse STOP/UNSUBSCRIBE → write `revokedAt` + internal DNC suppression.
5. **Fix quiet-hours timezone** — map state → IANA timezone and evaluate `nextPermittedTime` in recipient-local time (`Intl.DateTimeFormat`), not server-local.
6. **Expand area-code → state** beyond FL/TX.
7. **Add compliance tests** — unit-cover each gate (consent absent/present/revoked, DNC hit, quiet-hours window boundaries across timezones) so the substantiation is provable.

---

## 4. One-line verdict

The TCPA **control surface** (single chokepoint, correct gate order, fail-closed defaults, 50-state quiet-hours table, audit rows) is real and well-architected. **Consent capture, DNC scrub, and STOP-revocation are stubbed/absent, the consent table isn't migrated, and quiet-hours compares server-local time.** It is **"TCPA-safe by design intent," not yet "by construction."** Present it that way.

**Evidence index:** real gating `dialer-dispatch-worker.ts:264-425`, `quiet-hours.ts:53-262` · stubs/gaps `dnc.ts:6,62`, `check.ts:68-81`, `schema.patch.consent.prisma` (unmerged) · missing STOP `webhook-router.ts:482-579` · timezone bug `quiet-hours.ts:236,251` · cosmetic UI `consent-badge.tsx`, `oppenheimer.tsx:145`.
