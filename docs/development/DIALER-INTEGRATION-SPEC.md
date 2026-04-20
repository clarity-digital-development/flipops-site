# Dialer Integration Build Spec — FlipOps

**Purpose:** Production build specification for FlipOps's unified Dialer surface — replacing the removed Campaigns page.

**Four products on one page (`/app/dialer`):**
1. **Flip Phone** — browser WebRTC softphone (Telnyx WebRTC SDK)
2. **Oppenheimer** — AI voice dialer (Telnyx AI Assistants + ElevenLabs voices)
3. **External integrations** — Mojo Dialer, CallTools, smrtPhone (fourth slot open)
4. **Call History** — unified log across all four sources

---

## Table of Contents

1. [Legal Foundation — TCPA compliance model](#1-legal-foundation--tcpa-compliance-model)
2. [Consent model in the database](#2-consent-model-in-the-database)
3. [Flip Phone (WebRTC)](#3-flip-phone-webrtc)
4. [Oppenheimer (AI Dialer)](#4-oppenheimer-ai-dialer)
5. [External integrations](#5-external-integrations)
6. [Shared infrastructure](#6-shared-infrastructure)
7. [Environment variables](#7-environment-variables)
8. [Phased build plan](#8-phased-build-plan)
9. [Cost model](#9-cost-model)
10. [Open questions](#10-open-questions)

---

## 1. Legal Foundation — TCPA compliance model

The TCPA and the Feb 2024 FCC ruling on AI voices define what's legal. Everything in the UI layer enforces this model.

### What's always legal
- **Inbound calls** — seller calls us, AI or human may speak freely
- **Human-initiated outbound to cell phones** that aren't on DNC (no consent required for manually-dialed live-caller calls; TCPA auto-dialer restrictions don't apply when a human physically dials)
- **Outbound AI calls to leads with prior express written consent** naming the caller, authorizing automated voice

### What's never legal (hard blocks in the UI)
- **AI outbound to a cell phone without prior express written consent** — $500–$1,500 per violation, Feb 2024 FCC explicitly covers AI voices
- **Any outbound to a number on Federal/State DNC** (exceptions: EBR, prior written consent specifically naming DNC override)
- **Calls outside permitted hours** in the recipient's timezone — federal floor 8am–9pm; several states stricter

### Edges we can ride (the "cusp")
- **Established Business Relationship (EBR)** — brief window (3–18 months depending on interaction type) where prior contact allows follow-up without fresh consent. Works for landlines robustly; narrower for cells.
- **Preview dialing with AI coaching** — AI listens to human agent's call and provides on-screen coaching. AI never speaks to the seller. 100% legal.
- **Callback within reasonable time after inbound** — when a seller calls, we may return that call (AI or human) within a short window without fresh consent
- **Ringless voicemail drops** — circuit-split, widely used, litigation risk. FlipOps will expose this as a toggle with explicit user acknowledgment of risk.

### How the UI enforces this

Every lead carries a `ConsentState`:

```
ai_legal     — documented PEWC (prior express written consent). AI may call.
human_only   — not on DNC, no documented consent. Humans may dial; AI may not.
dnc          — DNC-registered or explicit opt-out. NO outbound.
unknown      — DNC scrub not run yet. Treat as human_only; Oppenheimer blocks.
```

The `<ConsentBadge>` (components/dialer/consent-badge.tsx) renders next to every phone number across Leads, Flip Phone queue, Oppenheimer audience, and Call History.

Oppenheimer's "Launch campaign" button is GATED by four explicit checkboxes (the "TCPA compliance rail"):
1. Consent records verified
2. DNC scrub run within 7 days
3. AI identifies itself at call start (required by FCC Feb 2024)
4. Opt-out path enabled (voice "stop" / press 9 → calls `end_call` tool → writes to OptOut table)

Failing any gate disables Launch with a specific reason displayed.

---

## 2. Consent model in the database

Add to `prisma/schema.prisma`:

```prisma
// Every documented opt-in, opt-out, and consent event.
// Oppenheimer only calls leads whose most recent ConsentRecord = GRANTED.
model ConsentRecord {
  id          String   @id @default(cuid())
  phoneNumber String   // E.164
  propertyId  String?
  userId      String

  channel     String   // "voice" | "sms" | "email"
  type        String   // "granted" | "revoked"
  source      String   // "web_form" | "verbal_live_call" | "inbound_call" | "direct_mail_response" | "manual_entry"
  evidence    String?  @db.Text // URL to signed form, recording clip ID, form submission JSON

  capturedAt  DateTime @default(now())
  expiresAt   DateTime? // Some state laws require re-consent (e.g. annually)

  ipAddress   String?  // For web form consent
  userAgent   String?

  // Relations
  property    Property? @relation(fields: [propertyId], references: [id])
  user        User      @relation(fields: [userId], references: [id])

  @@index([phoneNumber])
  @@index([propertyId])
  @@index([capturedAt])
}

// Separate opt-out ledger for fast DNC lookups.
// A number is AI-blocked if it appears here, regardless of ConsentRecord state.
model OptOut {
  id          String   @id @default(cuid())
  phoneNumber String   @unique
  channel     String   @default("all") // "voice" | "sms" | "all"
  reason      String?  // "verbal_stop", "sms_stop", "federal_dnc", "state_dnc", "litigator_flag"
  source      String   // which call / SMS triggered it
  optedOutAt  DateTime @default(now())
}

// Federal DNC scrub cache — refreshed weekly via cron.
model DncScrubResult {
  id            String   @id @default(cuid())
  phoneNumber   String   @unique
  scrubbedAt    DateTime @default(now())
  onFederalDnc  Boolean
  onStateDnc    Json     // { "FL": true, "OK": false, ... }
  isLitigator   Boolean  @default(false) // BatchData flags known TCPA plaintiffs
  provider      String   // "batchdata" | "internal"
}
```

### Deriving ConsentState at query time

```ts
function resolveConsentState(phone: string): ConsentState {
  if (optOut(phone)) return "dnc";
  if (scrubFederal(phone) || scrubAnyState(phone)) return "dnc";
  const latest = latestConsentRecord(phone);
  if (latest?.type === "granted" && !expired(latest)) return "ai_legal";
  if (scrubStale(phone)) return "unknown";
  return "human_only";
}
```

---

## 3. Flip Phone (WebRTC)

UI shell: `components/dialer/flip-phone.tsx` (already built).

### Under the hood (when wired)
- Authentication: `GET /api/telnyx/token` returns short-lived JWT (see TELNYX-INTEGRATION-SPEC.md §4)
- Provider: `<TelnyxRTCProvider credential={{ login_token: jwt }}>` wraps the app subtree
- Dialer hook: `useContext(TelnyxRTCContext)` → `client.newCall({ destinationNumber, callerNumber, audio: true, clientState: btoa(JSON.stringify({ leadId })) })`
- Call events (state transitions, remote stream attach): `useNotification()` + `useCallbacks()`
- Recording: set `record: 'record-from-answer'` on dial options; Telnyx uploads to the S3 we configure

### Enforcement at the UI layer
- If active lead has `consent === 'dnc'`, the green Call button is replaced with `"On DNC — cannot call"` and disabled
- Recording toggle defaults ON — user can disable per-call but we log both the toggle and the user ID for audit

### Live features in the shell (mock-implemented, waiting for Telnyx JWT)
- Dial pad that composes DTMF while on a call
- Mute / hold / audio output selection
- Live transcript panel (streams via Telnyx real-time transcription once wired)
- Caller ID selector (populated from purchased Telnyx numbers)
- Disposition + notes panel writes to `PhoneCall` + `Property.contactNotes` on save

---

## 4. Oppenheimer (INBOUND AI + callback automation)

**Pivot note (2026-04-20):** Cold outbound AI was dropped after a partner review concluded TCPA liability outweighed the upside. Oppenheimer now handles inbound calls and returns of inbound-initiated contact only — both legally safe paths.

UI shell: `components/dialer/oppenheimer.tsx` (rewritten for inbound-first).

### UX principles baked into the UI
- **Personality presets** (friendly / professional / brief / custom) replace the raw system prompt in the primary surface. The full prompt lives inside an "Advanced settings" disclosure.
- **Quiet hours are locked** and displayed read-only. Each state's rule is surfaced in the summary; the backend enforces per-recipient on every callback attempt.
- **No "max concurrent" control** — it was technical jargon. Inbound concurrency is a Telnyx-side channel limit (backend). Callback pacing is handled by the callback-policy picker (instant / 5min / 15min / human-first).
- **Haiku auto-disposition** — every completed call runs through a cheap LLM call that extracts disposition, sentiment, key notes, asking price, timeline. Results appear on the Recent Calls card and in the full Call History detail sheet.

### Stack

| Layer | Provider | Notes |
|---|---|---|
| Orchestration | Telnyx AI Assistants (`/v2/ai/assistants`) | Manages conversation loop, tools, transcription |
| LLM | Anthropic Claude Haiku (via Telnyx) | Cheap, fast, good enough for qualification conversations |
| Voice | ElevenLabs (via Telnyx bridge) OR Telnyx KokoroTTS | ElevenLabs = more natural, costs extra; Telnyx = free tier |
| PSTN | Telnyx Call Control API | Actual phone network, WebRTC bridge |

### Telnyx AI Assistant configuration for Oppenheimer

```ts
POST /v2/ai/assistants
{
  "name": "Oppenheimer — Acquisitions",
  "model": "anthropic/claude-haiku-4-5",
  "instructions": "<system prompt from UI campaign builder>",
  "greeting": "Hi, this is Alex calling from FlipOps. This is an automated call — I can pull you straight to a human anytime if you prefer.",
  "voice_settings": {
    "type": "elevenlabs",
    "voice_id": "<ELEVENLABS_VOICE_ID from env>",
    "model_id": "eleven_turbo_v2_5"
  },
  "transcription_settings": { "model": "deepgram/nova-3", "language": "en" },
  "telephony_settings": {
    "noise_suppression": "krisp",
    "time_limit_secs": 900,
    "recording_settings": { "format": "mp3", "channels": "dual" }
  },
  "tools": [
    { "type": "webhook", "name": "lookup_lead", "url": "https://flipops.io/api/ai/tools/lookup-lead", "method": "POST", "async": false, "timeout_secs": 4 },
    { "type": "webhook", "name": "log_disposition", "url": "https://flipops.io/api/ai/tools/log-disposition", "method": "POST", "async": true },
    { "type": "transfer", "name": "transfer_to_agent", "destinations": [{ "name": "Acquisitions", "destination": "<ACQUISITIONS_NUMBER>" }], "warm_transfer_instructions": "Brief on: property, timeline, price, condition." },
    { "type": "hangup", "name": "end_call", "description": "Hang up — pass reason=dnc_request to log opt-out" }
  ],
  "dynamic_variables_webhook_url": "https://flipops.io/api/ai/dynamic-variables"
}
```

### The legal first-utterance

Mandatory under FCC Feb 2024. The greeting contains identification as automated. If the user's script doesn't include it, we prepend automatically before uploading to Telnyx. UI surface: greeting preview with highlighted "auto-disclosure" span.

### Inbound + callback dial loop

**Inbound (primary):**
1. Seller calls a FlipOps DID → Telnyx posts `call.initiated` webhook
2. Our handler: `POST /v2/calls/{id}/actions/answer`
3. On `call.answered` → `POST /v2/calls/{id}/actions/ai_assistant_start` with Oppenheimer's assistant ID
4. Conversation runs until seller or AI hangs up
5. On `call.conversation.ended` → pull transcript → auto-disposition pipeline (see §4a)

**Callback (secondary, legally safe — returning a contact initiated by the seller):**
1. Missed inbound detected OR voicemail received
2. Resolve recipient's state from phone area code → look up quiet-hours rule
3. If current time is inside recipient's permitted window → schedule callback per callback-policy (instant / 5min / 15min)
4. If outside window → queue for next permitted time at the start of the next day in their state
5. Execute callback same as a normal outbound, but with `client_state.source="callback"` so we can audit that it was inbound-derived

### 4a. Auto-disposition pipeline (Haiku)

After `call.conversation.ended`, run a single Haiku call to extract structured metadata. This replaces manual note-taking.

```ts
// app/api/ai/disposition/route.ts
import Anthropic from "@anthropic-ai/sdk";

const PROMPT = `You analyze recorded phone calls between a real-estate investor's AI
and a property owner. Return JSON only:

{
  "disposition": "appt_set" | "interested" | "callback" | "not_interested" | "voicemail" | "no_answer" | "dnc_request" | "wrong_number",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "hot" | "warm" | "cold",
  "key_notes": string[],        // 3-5 bullets, each under 120 chars
  "asking_price": number | null,
  "timeline_days": number | null,
  "motivation": string | null,  // one-line summary of why they're selling
  "condition_notes": string | null
}

Transcript:
{{transcript}}`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const res = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 400,
  messages: [{ role: "user", content: PROMPT.replace("{{transcript}}", transcript) }],
});
const parsed = JSON.parse(res.content[0].text);
```

Cost: ~500 input tokens + 200 output = ~$0.0005 per call. Negligible.

Write fields to `PhoneCall`:
- `disposition`, `sentiment`, `urgency`, `keyNotes` (JSON array)
- `askingPrice`, `timelineDays`, `motivation`, `conditionNotes`

Then update the linked `Property`:
- `outreachStatus` ← derived from disposition
- `ownerResponse`, `sentiment` ← AI outputs
- Append a `contactNotes` entry with the key notes bullets

### 4b. Where users see call notes

Three surfaces, all fed by the same `PhoneCall` + AI-extracted fields:

1. **Oppenheimer → Recent calls card** — compact preview with first 2 key notes inline
2. **History tab → row click → detail sheet** — full transcript, extracted fields, recording playback, editable disposition
3. **Leads drawer → Calls tab** (future) — every call for this property, chronological

### 4c. State-law quiet hours lookup

Backend resolves recipient state from phone area code, applies stricter of federal + state:

| State | Hours (local) | Source |
|---|---|---|
| FL (Florida FTSA) | 9am–8pm weekdays, 9am–8pm weekends (no Sunday pre-9am) | FL Stat. § 501.059 |
| OK (Oklahoma) | 8am–8pm | 15 O.S. § 775A.3 |
| WA (Washington) | 8am–8pm weekdays only | RCW 19.158 |
| AL, AK, AR, LA (varied) | 8am–9pm + Sunday restrictions | state TCPA analogs |
| All others (federal floor) | 8am–9pm | TCPA 47 U.S.C. § 227(b) |

FlipOps default applied to the Oppenheimer UI: **9am–8pm recipient local time** (strictest common-denominator), widened per-recipient to the actual state-law window at call attempt time. Users cannot edit.

### Opt-out handling (non-negotiable)

If the caller says "stop", "remove me", "do not call", or presses 9:
1. AI calls `end_call` tool with `reason=dnc_request`
2. Webhook handler writes `OptOut` row
3. Next nightly cron: cross-check all active campaigns, remove any queued calls to that number
4. Email digest to user: "3 sellers requested DNC today"

### Concurrency & rate

UI exposes `max_concurrent` (1–20). Default 3. Telnyx Call Control App has channel limit (set to 50). Campaign scheduler respects both caps.

---

## 5. External integrations

Each card on the Integrations tab. Pattern is the same for all three: push leads out, receive call events via webhook, mirror dispositions back onto FlipOps Property records.

### CallTools — already wired

- Webhook receiver: `app/api/webhooks/calltools/route.ts` (live)
- Auth: `CALLTOOLS_API_KEY` (dedicated key, separate from `FO_API_KEY`)
- Inbound: CallTools POSTs call events → we match by phone → update `Property.outreachStatus` + `contactNotes`, auto-create follow-up tasks for positive dispositions
- Outbound push: `POST /api/calltools/push-list` (to build) — sends selected Property IDs into a CallTools campaign list

### Mojo Dialer

- REST API: https://api.mojosells.com (requires OAuth2 client credential grant)
- Env: `MOJO_CLIENT_ID`, `MOJO_CLIENT_SECRET`
- Push leads: `POST /api/v1/lists/{listId}/contacts`
- Webhook for call events: Mojo supports outbound webhooks on call completion — register ours at `/api/webhooks/mojo`
- Handler writes same-shape `PhoneCall` row as CallTools

### smrtPhone

- REST API: https://api.smrtphone.io/v1
- Env: `SMRTPHONE_API_KEY`
- Push leads: `POST /contacts/import` → `POST /campaigns/{id}/assign`
- Webhook: POST to `/api/webhooks/smrtphone` (register via `PUT /webhooks`)
- Bonus: smrtPhone SMS can feed the Inbox page (out of Dialer scope)

### Fourth slot — user TBD

Good candidates for real-estate:
- **Batch Dialer** (from BatchData — ecosystem fit, likely)
- **PhoneBurner** (well-known generic)
- **Kixie** (CRM-forward)

### Universal webhook receiver

`POST /api/webhooks/dialer` — generic receiver with field mapping configurable in Settings → Integrations. For any dialer that can POST JSON events. HMAC-signed with `FO_API_KEY`.

---

## 6. Shared infrastructure

### `PhoneCall` Prisma model (already specced in TELNYX-INTEGRATION-SPEC.md §10)

One unified shape across all four sources. Add:
- `source` — "flip_phone" | "oppenheimer" | "calltools" | "mojo" | "smrtphone" | "generic"
- `campaignId` — references `DialerCampaign` for Oppenheimer runs
- `consentRecordId` — which consent record authorized this call (null for human-dialed)

### `DialerCampaign` (Oppenheimer-specific)

```prisma
model DialerCampaign {
  id              String   @id @default(cuid())
  userId          String
  name            String
  status          String   @default("draft") // "draft" | "active" | "paused" | "completed"
  voiceId         String   // ElevenLabs voice ID or Telnyx voice name
  systemPrompt    String   @db.Text
  maxConcurrent   Int      @default(3)
  quietHoursStart String   // "09:00"
  quietHoursEnd   String   // "19:00"
  respectTimezone Boolean  @default(true)

  // Compliance snapshot at launch time — audit trail
  consentVerifiedAt DateTime?
  dncScrubbedAt     DateTime?
  disclosureEnabled Boolean @default(true)
  optOutEnabled     Boolean @default(true)

  audienceIds     Json     // property IDs queued
  createdAt       DateTime @default(now())
  launchedAt      DateTime?
  completedAt     DateTime?

  user            User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}
```

### Routes to build

| Route | Method | Purpose |
|---|---|---|
| `/api/dialer/flip-phone/token` | GET | Browser JWT for Telnyx WebRTC |
| `/api/dialer/campaigns` | POST | Create Oppenheimer campaign |
| `/api/dialer/campaigns/[id]/launch` | POST | Re-verify compliance + originate first calls |
| `/api/dialer/campaigns/[id]/pause` | POST | Halt queue |
| `/api/dialer/consent` | POST | Record a new consent event |
| `/api/dialer/consent/scrub` | POST | Run DNC scrub against federal + state registries |
| `/api/dialer/opt-out` | POST | Record opt-out (fires when AI tool calls end_call) |
| `/api/calltools/push-list` | POST | Push selected Property IDs to CallTools |
| `/api/mojo/push-list` | POST | Push selected Property IDs to Mojo |
| `/api/smrtphone/push-list` | POST | Push to smrtPhone |
| `/api/webhooks/mojo` | POST | Receive Mojo call events |
| `/api/webhooks/smrtphone` | POST | Receive smrtPhone call events |
| `/api/webhooks/dialer` | POST | Universal generic receiver |
| `/api/ai/tools/lookup-lead` | POST | Oppenheimer tool: find lead by phone |
| `/api/ai/tools/log-disposition` | POST | Oppenheimer tool: write disposition to lead |
| `/api/ai/dynamic-variables` | POST | Oppenheimer: inject per-caller vars at call start |
| `/api/ai/live-events` | POST | Oppenheimer: push live call progress to monitor UI |

---

## 7. Environment variables

```bash
# Telnyx (all required for both Flip Phone and Oppenheimer)
TELNYX_API_KEY=KEY...
TELNYX_PUBLIC_KEY=...                      # webhook Ed25519 signature verification
TELNYX_CALL_CONTROL_APP_ID=...
TELNYX_MESSAGING_PROFILE_ID=...
TELNYX_OUTBOUND_VOICE_PROFILE_ID=...
TELNYX_CREDENTIAL_CONNECTION_ID=...        # browser SIP auth
TELNYX_TELEPHONY_CREDENTIAL_ID=...         # for /v2/telephony_credentials/.../token JWT
TELNYX_AI_ASSISTANT_ID=...                 # Oppenheimer's assistant
NEXT_PUBLIC_TELNYX_CALLER_ID=+1XXXXXXXXXX  # default outbound caller ID

# ElevenLabs (Oppenheimer's voice)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID_ALEX=...               # friendly acquisitions voice
ELEVENLABS_VOICE_ID_JAMIE=...              # professional voice
ELEVENLABS_VOICE_ID_PAT=...                # conversational voice

# AWS S3 (call recording storage — Telnyx default recordings expire in 10 min)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_RECORDINGS=flipops-call-recordings
AWS_REGION=us-east-1

# External dialers (only required once user opts in)
CALLTOOLS_API_KEY=lgci_xgz5_0gbJVy-3Gvy2JNngU0q9H1fkwOpLH3wLk  # already provisioned
MOJO_CLIENT_ID=...
MOJO_CLIENT_SECRET=...
SMRTPHONE_API_KEY=...
```

---

## 8. Phased build plan

### Phase A — Foundation (already shipped)
- [x] Dialer page scaffold with 4 tabs
- [x] FlipPhone, Oppenheimer, IntegrationsPanel, CallHistory components (visual shells)
- [x] ConsentBadge shared compliance indicator
- [x] Campaigns page removed, nav updated
- [x] CallTools webhook live

### Phase B — Foundation wiring (1–2 weeks, after user provides keys)
- [ ] Run Telnyx one-time setup per TELNYX-INTEGRATION-SPEC.md §2
- [ ] Add Prisma models: `ConsentRecord`, `OptOut`, `DncScrubResult`, `DialerCampaign`
- [ ] Build `/api/dialer/flip-phone/token` JWT endpoint
- [ ] Wire FlipPhone component to `@telnyx/webrtc` (visual shell → real WebRTC)

### Phase C — Oppenheimer (2–3 weeks)
- [ ] Create Telnyx AI Assistant via API with ElevenLabs voice config
- [ ] Build `/api/ai/dynamic-variables`, `/api/ai/tools/*`, `/api/ai/live-events`
- [ ] Build `/api/dialer/campaigns` CRUD + launch flow with compliance re-verification
- [ ] Build DNC scrub job (BatchData API + federal registry)
- [ ] Wire live monitor to receive progress events via Server-Sent Events

### Phase D — Integrations (1–2 weeks)
- [ ] CallTools push-list endpoint (webhook is already live)
- [ ] Mojo: OAuth2 + push-list + webhook receiver
- [ ] smrtPhone: API key + push-list + webhook receiver
- [ ] Universal webhook receiver with field-mapping config UI

### Phase E — Polish (ongoing)
- [ ] Live transcript streaming in FlipPhone (Telnyx real-time transcription)
- [ ] Barge-in for Oppenheimer live calls (human agent can take over)
- [ ] Analytics rollup: Oppenheimer vs Flip Phone vs external dialer ROI
- [ ] Recording playback with waveform UI

---

## 9. Cost model

At 500 outbound AI calls/month (10-min avg) + 1,000 human-dialed calls/month + 5,000 external-dialer calls/month:

| Line item | Rate | Monthly |
|---|---|---|
| Telnyx AI calls (includes LLM + transcription) | $0.08/min | $400 |
| ElevenLabs Turbo voice (via Telnyx bridge) | $0.15/min | $750 |
| Telnyx PSTN outbound (Flip Phone) | $0.01/min | $100 |
| Telnyx WebRTC bridge | $0.002/min | $20 |
| BatchData DNC scrubs (1,500/mo @ $0.05 each) | $75 | $75 |
| AWS S3 recording storage | ~$10 | $10 |
| Phone numbers (10 DIDs) | $1.50 ea | $15 |
| Mojo subscription (user-provided) | ~$99 | $99 |
| smrtPhone subscription (user-provided) | ~$75 | $75 |
| CallTools subscription (user-provided) | varies | varies |
| **Subtotal (FlipOps-side infra)** |  | **~$1,370** |

**Cost levers:**
- Switch Oppenheimer voice to Telnyx KokoroTTS → saves $750 but lower-quality voice
- Use Telnyx Engine B transcription for Flip Phone ($0.025/min vs Google $0.05/min) → ~$30/mo savings
- Cache DNC scrubs 7 days → avoid duplicate scrubs on re-queued leads

---

## 10. Open questions

Items requiring user decision / credentials before shipping:

1. **Telnyx account** — do you have one? If not, we'll register and spec one account per environment (dev + prod). Need credit-card-backed spending limits configured per Phase B.
2. **ElevenLabs voices** — which voices do you want as Alex/Jamie/Pat? Recommend cloning a voice for FlipOps brand consistency ($22/mo Creator plan or $99/mo Pro for voice cloning + commercial license).
3. **10DLC brand/campaign** — required for SMS at scale. Not required for voice alone but start registration now (1–7 day vetting). Covered in TELNYX-INTEGRATION-SPEC.md §8.
4. **Fourth integration slot** — confirm: Batch Dialer / PhoneBurner / Kixie / something else?
5. **Consent capture UI** — we need a dedicated consent capture surface in the Leads flow so `ai_legal` state starts accumulating. Should be its own mini-build after Phase B.
6. **Ringless voicemail** — enable as an opt-in toggle with risk acknowledgment, or skip entirely? Growing litigation risk says "skip" but it's heavily used in the industry.
7. **Barge-in UX** — should human supervisors be able to silently monitor or whisper-coach active Oppenheimer calls?

---

*Research sourced from TCPA 47 U.S.C. § 227, FCC Feb 8 2024 Declaratory Ruling on AI-generated voices, Telnyx Call Control API v2 docs, ElevenLabs API docs, industry case law on ringless voicemail (Karle v. Southwest Credit Systems, Boshears v. PeopleConnect, Insurance Marketing Coalition v. FCC).*
