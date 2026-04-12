# Telnyx Integration Build Spec — FlipOps

**Purpose:** Production build specification for integrating Telnyx into FlipOps to power:
1. **In-Platform Dialer** — browser-based softphone embedded in the Leads/Inbox pages
2. **AI Inbound Calling** — AI voice assistant answers inbound calls, qualifies sellers, routes to agents

**Telnyx Base URL:** `https://api.telnyx.com/v2`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [One-Time Platform Setup](#2-one-time-platform-setup)
3. [Phone Number Provisioning](#3-phone-number-provisioning)
4. [In-Platform Dialer (WebRTC)](#4-in-platform-dialer-webrtc)
5. [AI Inbound Calling](#5-ai-inbound-calling)
6. [Call Recording & Transcription](#6-call-recording--transcription)
7. [SMS Outreach](#7-sms-outreach)
8. [10DLC Compliance](#8-10dlc-compliance)
9. [Webhook Handlers](#9-webhook-handlers)
10. [Database Schema](#10-database-schema)
11. [API Routes to Build](#11-api-routes-to-build)
12. [Environment Variables](#12-environment-variables)
13. [Pricing Estimate](#13-pricing-estimate)
14. [Build Phases](#14-build-phases)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      FlipOps App                         │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Leads Page  │    │  Inbox Page  │                   │
│  │  (Dialer UI) │    │  (Dialer UI) │                   │
│  └──────┬───────┘    └──────┬───────┘                   │
│         │ @telnyx/react-client (WebRTC)                  │
│         └──────────────┬──────────────┘                  │
│                        │ WSS (SIP over WebSocket)         │
└────────────────────────┼────────────────────────────────┘
                         │
                 ┌───────▼───────┐
                 │   Telnyx      │
                 │  Platform     │
                 │               │
                 │ ┌───────────┐ │     ┌──────────────────┐
                 │ │  Dialer   │ │────▶│  Outbound calls  │
                 │ │  (WebRTC) │ │     │  to sellers      │
                 │ └───────────┘ │     └──────────────────┘
                 │               │
                 │ ┌───────────┐ │     ┌──────────────────┐
                 │ │ AI Voice  │ │◀────│  Inbound calls   │
                 │ │ Assistant │ │     │  from sellers    │
                 │ └─────┬─────┘ │     └──────────────────┘
                 └───────┼───────┘
                         │ Webhooks
              ┌──────────▼──────────┐
              │  FlipOps API Server  │
              │  /api/webhooks/voice │
              │  /api/webhooks/sms   │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   PostgreSQL (Prisma)│
              │   Calls, Recordings, │
              │   Transcripts, Leads │
              └─────────────────────┘
```

### Two integration paths

| Path | Purpose | SDK |
|------|---------|-----|
| **Call Control API** | Server-side: initiate/control calls, start AI, record, transfer | `telnyx` (Node.js) |
| **WebRTC JS SDK** | Client-side: browser softphone, audio in/out | `@telnyx/webrtc`, `@telnyx/react-client` |

**Key mental model for Call Control API:**
- Every action is **asynchronous** — you POST a command and get `{"result": "ok"}` immediately
- The actual result arrives as a **webhook event** to your server
- Use `command_id` (UUID) on every command for idempotency — prevents double-speak/double-record on webhook retries
- Use `client_state` (base64 JSON) to pass `leadId`, `dealId`, `callId` through the webhook chain without DB lookups

---

## 2. One-Time Platform Setup

These are created once per environment (dev, prod).

### 2a. Outbound Voice Profile

Required for making outbound calls. Create in Telnyx portal or:

```typescript
POST /v2/outbound_voice_profiles
{
  "name": "FlipOps Outbound",
  "whitelisted_destinations": ["US", "CA"],
  "max_destination_rate": 0.01,
  "daily_spend_limit": "100.00",
  "daily_spend_limit_enabled": true,
  "traffic_type": "conversational",
  "call_recording": {
    "enabled": false  // handled per-call instead
  }
}
// Save: TELNYX_OUTBOUND_VOICE_PROFILE_ID
```

### 2b. Call Control Application (Voice Webhooks)

Handles all inbound/outbound call events. One per environment.

```typescript
POST /v2/call_control_applications
{
  "application_name": "FlipOps Voice [prod|dev]",
  "webhook_event_url": "https://api.flipops.io/webhooks/voice",
  "webhook_event_failover_url": "https://api.flipops.io/webhooks/voice-failover",
  "webhook_api_version": "2",
  "dtmf_type": "RFC 2833",
  "first_command_timeout": true,
  "first_command_timeout_secs": 30,
  "inbound": {
    "channel_limit": 50,
    "shaken_stir_enabled": true
  },
  "outbound": {
    "channel_limit": 50,
    "outbound_voice_profile_id": "TELNYX_OUTBOUND_VOICE_PROFILE_ID"
  }
}
// Save: TELNYX_CALL_CONTROL_APP_ID
```

### 2c. Messaging Profile (SMS Webhooks)

Handles inbound SMS and delivery receipts.

```typescript
POST /v2/messaging_profiles
{
  "name": "FlipOps SMS [prod|dev]",
  "webhook_url": "https://api.flipops.io/webhooks/sms",
  "webhook_failover_url": "https://api.flipops.io/webhooks/sms-failover",
  "webhook_api_version": "2",
  "number_pool_settings": {
    "long_code_weight": 5,
    "toll_free_weight": 1,
    "skip_unhealthy": true,
    "sticky_sender": true,
    "geomatch": true
  }
}
// Save: TELNYX_MESSAGING_PROFILE_ID
```

### 2d. Credential Connection (for WebRTC)

Required to authenticate browser SDK clients.

```typescript
POST /v2/credential_connections
{
  "name": "FlipOps WebRTC",
  "username": "flipops_webrtc",          // 4-32 alphanumeric chars
  "password": "YOUR_STRONG_PASSWORD",    // 8-128 chars
  "sip_uri_calling_preference": "enabled",
  "active": true,
  "outbound_voice_profile_id": "TELNYX_OUTBOUND_VOICE_PROFILE_ID"
}
// Save: TELNYX_CREDENTIAL_CONNECTION_ID
```

### 2e. AI Assistant

The AI persona for inbound seller calls.

```typescript
POST /v2/ai/assistants
{
  "name": "FlipOps Acquisitions AI",
  "model": "anthropic/claude-haiku-4-5",  // Fast, no extra cost
  "instructions": `You are a friendly acquisitions specialist for FlipOps, a real estate investment company that buys properties for cash.

Your goal is to gather information about the property the caller is calling about and determine their level of motivation to sell.

Current caller: {{caller_name}} (or "the property owner" if unknown)
Their number: {{telnyx_end_user_target}}
Lead status: {{lead_status}}
Known property: {{property_address}}

Gather the following information naturally through conversation:
1. Property address (confirm or discover)
2. Why they are looking to sell
3. Their timeline (how quickly they need to close)
4. The condition of the property
5. Their asking price or price expectation
6. Whether anyone else is involved in the decision

If they want to speak to a human, transfer them to our acquisitions team.
If they are not interested in selling, politely thank them and end the call.
Keep responses brief and conversational — this is a phone call, not an email.`,

  "greeting": "Thank you for calling FlipOps. My name is Alex and I'm here to help with your property inquiry. How can I help you today?",

  "voice_settings": {
    "type": "telnyx",
    "voice": "Telnyx.KokoroTTS.af",
    "voice_speed": 1.0
  },

  "transcription_settings": {
    "model": "deepgram/nova-3",
    "language": "en"
  },

  "telephony_settings": {
    "noise_suppression": "krisp",
    "time_limit_secs": 1800,
    "recording_settings": {
      "format": "mp3",
      "channels": "dual"
    }
  },

  "tools": [
    {
      "type": "webhook",
      "name": "lookup_lead",
      "description": "Look up caller in CRM by phone number",
      "url": "https://api.flipops.io/ai/tools/lookup-lead",
      "method": "POST",
      "async": false,
      "timeout_secs": 5
    },
    {
      "type": "webhook",
      "name": "update_lead",
      "description": "Update lead record with information gathered from this call",
      "url": "https://api.flipops.io/ai/tools/update-lead",
      "method": "POST",
      "async": true
    },
    {
      "type": "transfer",
      "name": "transfer_to_agent",
      "description": "Transfer to a human acquisitions agent when the seller requests it or when you have gathered all needed information",
      "destinations": [
        { "name": "Acquisitions Team", "destination": "+YOUR_ACQUISITIONS_NUMBER" }
      ],
      "warm_transfer_instructions": "Brief the agent on: property address, seller's timeline, asking price, and property condition."
    },
    {
      "type": "hangup",
      "name": "end_call",
      "description": "End the call when the conversation is complete"
    }
  ],

  "dynamic_variables_webhook_url": "https://api.flipops.io/ai/dynamic-variables",

  "insight_settings": {
    "insight_group_id": "YOUR_INSIGHT_GROUP_ID"  // configure post-setup
  }
}
// Save: TELNYX_AI_ASSISTANT_ID
```

### 2f. Custom S3 Storage for Recordings

Recording URLs on Telnyx default storage expire in **10 minutes**. Configure S3 immediately.

```typescript
POST /v2/custom_storage_credentials/{TELNYX_CALL_CONTROL_APP_ID}
{
  "backend": "s3",
  "configuration": {
    "bucket_name": "flipops-call-recordings",
    "region": "us-east-1",
    "access_key_id": "AWS_ACCESS_KEY",
    "secret_access_key": "AWS_SECRET_KEY"
  }
}
```

---

## 3. Phone Number Provisioning

### Search available numbers (per market)

```typescript
// GET /v2/available_phone_numbers
const numbers = await client.availablePhoneNumbers.list({
  'filter[national_destination_code]': '720',    // area code
  'filter[features]': ['sms', 'voice'],
  'filter[phone_number_type]': 'local',
  'filter[quickship]': 'true',
  'filter[limit]': 10,
});
```

### Order numbers (assign to both voice app and messaging profile at purchase)

```typescript
// POST /v2/number_orders
const order = await client.numberOrders.create({
  phone_numbers: [{ phone_number: '+17205551234' }],
  connection_id: process.env.TELNYX_CALL_CONTROL_APP_ID,       // voice routing
  messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID, // SMS routing
  customer_reference: 'flipops-market-denver',
});
// Poll GET /v2/number_orders/{id} until status === 'success'
```

### API route: `/api/telnyx/numbers/search`

```typescript
// GET /api/telnyx/numbers/search?areaCode=720&features=sms,voice
// Returns available numbers for UI to display before purchase
```

### API route: `/api/telnyx/numbers/order`

```typescript
// POST /api/telnyx/numbers/order
// Body: { phoneNumber: '+17205551234', market: 'Denver, CO' }
// Creates order, polls for success, saves to DB, returns the number record
```

---

## 4. In-Platform Dialer (WebRTC)

### Stack
- `@telnyx/webrtc` — core SDK
- `@telnyx/react-client` — React hooks/provider

```bash
npm install @telnyx/webrtc @telnyx/react-client
```

### Authentication flow

**Never expose the API key to the browser.** The browser gets a short-lived JWT.

```
Browser                    FlipOps API              Telnyx
  │                            │                       │
  │── GET /api/telnyx/token ──▶│                       │
  │                            │── POST /v2/telephony_ │
  │                            │   credentials/{id}/   │
  │                            │   token ─────────────▶│
  │                            │◀────── { token: JWT } ─│
  │◀─────── { token: JWT } ────│                       │
  │                            │                       │
  │── TelnyxRTCProvider ───────────────────────────────▶
  │   credential={{ login_token: JWT }}
```

### API route: `GET /api/telnyx/token`

```typescript
// app/api/telnyx/token/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(
    `https://api.telnyx.com/v2/telephony_credentials/${process.env.TELNYX_TELEPHONY_CREDENTIAL_ID}/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const { token } = await res.json();
  return NextResponse.json({ token });
}
```

### Provider setup

```tsx
// app/app/layout.tsx — add TelnyxProvider as child of AppLayout
// app/components/telnyx-provider.tsx
'use client';

import { TelnyxRTCProvider } from '@telnyx/react-client';
import { useEffect, useState } from 'react';

export function TelnyxProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/telnyx/token')
      .then(r => r.json())
      .then(d => setToken(d.token));
  }, []);

  if (!token) return <>{children}</>;

  return (
    <TelnyxRTCProvider
      credential={{ login_token: token }}
      options={{
        ringtoneFile: '/sounds/ring.mp3',
        ringbackFile: '/sounds/ringback.mp3',
        debug: process.env.NODE_ENV === 'development',
      }}
    >
      {children}
    </TelnyxRTCProvider>
  );
}
```

### Dialer component

```tsx
// app/app/components/dialer.tsx
'use client';

import { useContext, useState } from 'react';
import { TelnyxRTCContext, useNotification, useCallbacks, Audio } from '@telnyx/react-client';
import { Phone, PhoneOff, Mic, MicOff, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dialer({ leadPhone, leadId }: { leadPhone: string; leadId: string }) {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const call = notification?.call;
  const state = call?.state;
  const [status, setStatus] = useState<'idle' | 'registered' | 'error'>('idle');
  const [muted, setMuted] = useState(false);

  useCallbacks({
    onReady: () => setStatus('registered'),
    onError: () => setStatus('error'),
  });

  const dial = () => {
    client?.newCall({
      destinationNumber: leadPhone,
      callerNumber: process.env.NEXT_PUBLIC_TELNYX_CALLER_ID!,
      callerName: 'FlipOps',
      audio: true,
      video: false,
      clientState: btoa(JSON.stringify({ leadId })),
      customHeaders: [{ name: 'X-Lead-Id', value: leadId }],
    });
  };

  const toggleMute = () => {
    call?.muteAudio();
    setMuted(m => !m);
  };

  return (
    <>
      {/* Active call controls */}
      {state === 'active' && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={toggleMute}>
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => call?.hold()}>
            <PauseCircle className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => call?.hangup()}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dial button */}
      {(!state || state === 'destroy' || state === 'purge') && (
        <Button size="sm" onClick={dial} disabled={status !== 'registered'}>
          <Phone className="h-4 w-4 mr-2" />
          Call
        </Button>
      )}

      {/* Connecting states */}
      {(state === 'trying' || state === 'requesting' || state === 'ringing') && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground animate-pulse">
            {state === 'ringing' ? 'Ringing...' : 'Connecting...'}
          </span>
          <Button size="sm" variant="destructive" onClick={() => call?.hangup()}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Inbound ring (unlikely in Leads/Inbox but handle anyway) */}
      {state === 'ringing' && call?.direction === 'inbound' && (
        <Button size="sm" onClick={() => call.answer()}>
          <Phone className="h-4 w-4 mr-2" />
          Answer
        </Button>
      )}

      {/* Always mount Audio element when call exists */}
      {call && <Audio stream={call.remoteStream} />}
    </>
  );
}
```

### Warm transfer from dialer

Transfer is server-side (Call Control API). The browser passes `call.telnyxIDs.telnyxCallControlId` to an API route:

```typescript
// POST /api/telnyx/transfer
// Body: { callControlId, transferTo }
// Calls POST /v2/calls/{callControlId}/actions/transfer
```

### DTMF pad

```tsx
// For navigating IVR systems during calls
const dtmfKeys = ['1','2','3','4','5','6','7','8','9','*','0','#'];
dtmfKeys.map(key => (
  <button key={key} onClick={() => call?.dtmf(key)}>{key}</button>
))
```

---

## 5. AI Inbound Calling

### Inbound call flow

```
Seller calls FlipOps DID
         │
         ▼
Telnyx: call.initiated webhook ──▶ /webhooks/voice
         │
         ▼
FlipOps: Look up caller in DB by `from` number
         │
         ▼
FlipOps: POST /calls/{id}/actions/answer
         │
         ▼
Telnyx: call.answered webhook ──▶ /webhooks/voice
         │
         ▼
FlipOps: Fetch lead data, POST /ai/dynamic-variables returns vars
         │
         ▼
FlipOps: POST /calls/{id}/actions/ai_assistant_start
         │
         ▼
Telnyx AI: Runs conversation using system prompt + dynamic vars
         │
         ▼ (seller hangs up or AI ends call)
Telnyx: call.conversation.ended webhook
         │
         ▼
FlipOps: GET /conversations/{id}/messages (full transcript)
         │
         ▼
FlipOps: Update lead in DB, create follow-up task, save transcript
```

### Webhook handler: `POST /api/webhooks/voice`

```typescript
// app/api/webhooks/voice/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Telnyx from 'telnyx';

const telnyx = new Telnyx({ apiKey: process.env.TELNYX_API_KEY! });

export async function POST(request: NextRequest) {
  // Always ACK in < 2000ms
  const body = await request.json();
  processWebhook(body).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processWebhook(body: any) {
  const { event_type, payload } = body.data;
  const { call_control_id, from, to, call_leg_id, call_session_id, client_state } = payload;

  // Decode state if present
  const state = client_state
    ? JSON.parse(Buffer.from(client_state, 'base64').toString())
    : {};

  switch (event_type) {

    case 'call.initiated': {
      if (payload.direction !== 'incoming') break;

      // Save call to DB
      const call = await prisma.phoneCall.create({
        data: {
          callControlId: call_control_id,
          callLegId: call_leg_id,
          callSessionId: call_session_id,
          from,
          to,
          direction: 'inbound',
          status: 'initiated',
        }
      });

      // Look up lead
      const lead = await prisma.property.findFirst({
        where: { phoneNumbers: { contains: from } }
      });

      // Answer
      await telnyx.calls.answer(call_control_id, {
        record: 'record-from-answer',
        record_format: 'mp3',
        record_channels: 'dual',
        client_state: Buffer.from(JSON.stringify({
          callDbId: call.id,
          leadId: lead?.id ?? null,
        })).toString('base64'),
      });
      break;
    }

    case 'call.answered': {
      await prisma.phoneCall.update({
        where: { callControlId: call_control_id },
        data: { status: 'answered', answeredAt: new Date() }
      });

      // Start AI assistant
      await telnyx.calls.actions.startAIAssistant(call_control_id, {
        assistant: { id: process.env.TELNYX_AI_ASSISTANT_ID },
        send_message_history_updates: false,
        client_state: payload.client_state, // pass through
      });
      break;
    }

    case 'call.conversation.ended': {
      const { conversation_id } = payload;

      // Retrieve full transcript
      const messages = await fetch(
        `https://api.telnyx.com/v2/conversations/${conversation_id}/messages`,
        { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
      ).then(r => r.json());

      const transcript = messages.data
        .map((m: any) => `${m.role}: ${m.content}`)
        .join('\n');

      await prisma.phoneCall.update({
        where: { callControlId: call_control_id },
        data: {
          status: 'completed',
          endedAt: new Date(),
          transcript,
          conversationId: conversation_id,
        }
      });

      // Create follow-up task if lead found
      if (state.leadId) {
        await prisma.task.create({
          data: {
            title: `Review AI call transcript — ${from}`,
            type: 'follow_up',
            propertyId: state.leadId,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          }
        });
      }
      break;
    }

    case 'call.recording.saved': {
      const { recording_id, public_recording_urls } = payload;
      await prisma.phoneCall.update({
        where: { callControlId: call_control_id },
        data: {
          recordingId: recording_id,
          recordingUrl: public_recording_urls?.mp3 ?? null,
        }
      });
      break;
    }

    case 'call.hangup': {
      await prisma.phoneCall.update({
        where: { callControlId: call_control_id },
        data: {
          status: 'completed',
          endedAt: new Date(),
          hangupCause: payload.hangup_cause,
        }
      });
      break;
    }
  }
}
```

### Dynamic variables webhook: `POST /api/ai/dynamic-variables`

```typescript
// app/api/ai/dynamic-variables/route.ts
// Called by Telnyx at conversation start to inject caller-specific variables

export async function POST(request: NextRequest) {
  const body = await request.json();
  const callerNumber = body.data?.payload?.telnyx_end_user_target;

  // Look up lead in DB
  const lead = await prisma.property.findFirst({
    where: { phoneNumbers: { contains: callerNumber } }
  });

  // Return variables to inject into system prompt
  return NextResponse.json({
    dynamic_variables: {
      caller_name: lead?.ownerName ?? 'the property owner',
      property_address: lead?.address ?? 'unknown',
      lead_status: lead ? 'existing_lead' : 'new_lead',
      lead_score: lead?.score ?? 0,
    }
  });
}
```

### AI Tool handler: `POST /api/ai/tools/lookup-lead`

```typescript
// Called by AI during conversation to look up property info
export async function POST(request: NextRequest) {
  const { phone } = await request.json();
  const lead = await prisma.property.findFirst({
    where: { phoneNumbers: { contains: phone } }
  });
  return NextResponse.json({ found: !!lead, lead: lead ?? null });
}
```

### AI Tool handler: `POST /api/ai/tools/update-lead`

```typescript
// Called by AI to update lead after gathering info
export async function POST(request: NextRequest) {
  const { phone, askingPrice, condition, timeline, situation } = await request.json();
  const lead = await prisma.property.findFirst({
    where: { phoneNumbers: { contains: phone } }
  });
  if (lead) {
    await prisma.property.update({
      where: { id: lead.id },
      data: {
        metadata: JSON.stringify({
          ...JSON.parse(lead.metadata ?? '{}'),
          aiGathered: { askingPrice, condition, timeline, situation },
          lastAICallAt: new Date().toISOString(),
        })
      }
    });
  }
  return NextResponse.json({ updated: true });
}
```

---

## 6. Call Recording & Transcription

### Recording setup
- Start at `call.answered` via `record: "record-from-answer"` in the answer command
- Format: `mp3`, channels: `dual` (caller on left, agent on right)
- Stored in S3 (configured in Section 2f) — URL never expires

### Transcription options

| Option | Cost | Best for |
|--------|------|---------|
| **Deepgram nova-3** (real-time, via AI) | Included in $0.08/min AI base | AI calls |
| **Google Engine A** (post-recording) | ~$0.05/min | Agent-to-seller calls |
| **Telnyx Engine B** (post-recording) | ~$0.025/min | High volume |
| **Deepgram nova-3** (real-time, standalone) | Separate cost | Manual dialer calls |

**For AI calls:** Use AI assistant's built-in transcription. Retrieve via `GET /v2/conversations/{id}/messages` post-call.

**For manual dialer calls:** Start transcription on `call.answered`:

```typescript
await telnyx.calls.transcriptionStart(call_control_id, {
  transcription_engine: 'Google',
  transcription_engine_config: {
    language: 'en-US',
    model: 'phone_call',
    use_enhanced: true,
    enable_speaker_diarization: true,
    min_speaker_count: 2,
    max_speaker_count: 2,
  },
  transcription_tracks: 'both',
  client_state: payload.client_state,
});
```

Handle chunks in webhook:
```typescript
case 'call.transcription': {
  const { transcript, is_final, track } = payload.transcription_data;
  if (is_final) {
    await saveTranscriptChunk(call_control_id, transcript, track);
  }
  break;
}
```

### Recording API routes

```typescript
// GET /api/calls/[callId]/recording
// Returns recording URL for playback in UI

// GET /api/calls/[callId]/transcript
// Returns full transcript text
```

---

## 7. SMS Outreach

### Sending a message

```typescript
// lib/telnyx/sms.ts
import Telnyx from 'telnyx';
const telnyx = new Telnyx({ apiKey: process.env.TELNYX_API_KEY! });

export async function sendSMS(to: string, text: string, from?: string) {
  return telnyx.messages.send({
    from: from ?? undefined,
    messaging_profile_id: from ? undefined : process.env.TELNYX_MESSAGING_PROFILE_ID,
    to,
    text,
    webhook_url: 'https://api.flipops.io/webhooks/sms',
  });
}
```

### Number pool (recommended)

When no `from` is specified, Telnyx auto-selects from the pool using:
- `sticky_sender: true` — always uses same number for same recipient (conversation threading)
- `geomatch: true` — picks a number with same area code as recipient

### Inbound SMS webhook: `POST /api/webhooks/sms`

```typescript
// app/api/webhooks/sms/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  processInboundSMS(body).catch(console.error);
  return NextResponse.json({ received: true });
}

async function processInboundSMS(body: any) {
  const { event_type, payload } = body.data;

  if (event_type === 'message.received') {
    const sender = payload.from.phone_number;
    const text = payload.text?.trim().toUpperCase();
    const receivedOn = payload.to[0].phone_number;
    const messageId = payload.id;

    // Dedup
    const exists = await prisma.smsMessage.findUnique({ where: { telnyxId: messageId } });
    if (exists) return;

    await prisma.smsMessage.create({
      data: {
        telnyxId: messageId,
        from: sender,
        to: receivedOn,
        body: payload.text,
        direction: 'inbound',
        status: 'received',
      }
    });

    // Handle opt-out
    if (['STOP', 'UNSUBSCRIBE', 'QUIT', 'CANCEL'].includes(text)) {
      await handleOptOut(sender);
      return;
    }

    // Route to inbox
    const lead = await prisma.property.findFirst({
      where: { phoneNumbers: { contains: sender } }
    });

    if (lead) {
      // Create inbox conversation message
    }
  }

  if (event_type === 'message.finalized') {
    const status = payload.to[0].status;
    await prisma.smsMessage.update({
      where: { telnyxId: payload.id },
      data: { status }
    });
  }
}
```

---

## 8. 10DLC Compliance

**Required** before sending bulk SMS to US long codes. Do this before launch.

### Step-by-step (one-time, via API or portal)

**Step 1: Create Brand** — `POST /v2/10dlc/brand`
```json
{
  "entityType": "PRIVATE_PROFIT",
  "displayName": "FlipOps",
  "companyName": "FlipOps LLC",
  "ein": "XX-XXXXXXX",
  "phone": "+1XXXXXXXXXX",
  "street": "...",
  "city": "...", "state": "XX", "postalCode": "XXXXX", "country": "US",
  "email": "compliance@flipops.io",
  "website": "https://flipops.io",
  "vertical": "REAL_ESTATE"
}
```
Cost: $4 one-time. Takes 1–7 business days for vetting.

**Step 2: Create Campaign** — `POST /v2/10dlc/campaignBuilder`
```json
{
  "brandId": "BRAND_ID",
  "usecase": "MIXED",
  "description": "Real estate investor outreach for off-market property acquisition",
  "sample1": "Hi [Name], FlipOps here — we're interested in making a cash offer on your property at [Address]. Reply YES for details or STOP to opt out.",
  "sample2": "FlipOps: Your cash offer is ready. Reply INFO for details or STOP to stop messages.",
  "messageFlow": "Property owners opt in via website or respond to direct mail. We send acquisition offers and follow-up messages.",
  "subscriberOptout": true,
  "optoutKeywords": "STOP, UNSUBSCRIBE, QUIT",
  "optoutMessage": "You have been unsubscribed from FlipOps messages.",
  "subscriberOptin": true,
  "helpKeywords": "HELP, INFO",
  "helpMessage": "FlipOps property acquisition. Reply STOP to opt out. flipops.io",
  "embeddedLink": false,
  "embeddedPhone": false,
  "numberPool": true,
  "ageGated": false
}
```
Cost: 3 months upfront, non-refundable.

**Step 3: Assign numbers** to campaign after brand vetting completes.

**Step 4: Assign messaging profile to campaign.**

---

## 9. Webhook Handlers

### Webhook verification (all handlers)

```typescript
// lib/telnyx/verify-webhook.ts
import { createVerify } from 'crypto';

export function verifyTelnyxWebhook(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const signingInput = `${timestamp}|${rawBody}`;
    const verify = createVerify('ed25519');
    verify.update(signingInput);
    return verify.verify(
      `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
      Buffer.from(signature, 'base64')
    );
  } catch {
    return false;
  }
}
```

Usage in route handlers:
```typescript
const rawBody = await request.text();
const isValid = verifyTelnyxWebhook(
  rawBody,
  request.headers.get('telnyx-signature-ed25519') ?? '',
  request.headers.get('telnyx-timestamp') ?? '',
  process.env.TELNYX_PUBLIC_KEY!
);
if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
```

### Idempotency

All webhook handlers must be idempotent. Telnyx retries on any non-2xx. Use `data.id` (event UUID) for deduplication:

```typescript
const eventId = body.data.id;
const existing = await prisma.webhookEvent.findUnique({ where: { telnyxEventId: eventId } });
if (existing) return; // already processed
await prisma.webhookEvent.create({ data: { telnyxEventId: eventId } });
```

### `client_state` pattern

Pass context through the entire call lifecycle without DB lookups:

```typescript
// Encode at call start:
const clientState = Buffer.from(JSON.stringify({
  leadId: 'abc',
  callDbId: 'xyz',
  userId: 'user_123',
})).toString('base64');

// Decode in any subsequent webhook:
const ctx = payload.client_state
  ? JSON.parse(Buffer.from(payload.client_state, 'base64').toString())
  : {};
```

### `command_id` pattern

Prevent duplicate commands on webhook retries:

```typescript
import { randomUUID } from 'crypto';

await telnyx.calls.speak(call_control_id, {
  payload: 'Thank you for calling FlipOps.',
  voice: 'Telnyx.KokoroTTS.af',
  command_id: `speak-${callDbId}-greeting`, // deterministic per call + action
});
```

---

## 10. Database Schema

Add to `prisma/schema.prisma`:

```prisma
model PhoneCall {
  id              String    @id @default(cuid())
  callControlId   String    @unique
  callLegId       String?
  callSessionId   String?
  from            String
  to              String
  direction       String    // 'inbound' | 'outbound'
  status          String    // 'initiated' | 'answered' | 'completed' | 'failed'
  answeredAt      DateTime?
  endedAt         DateTime?
  durationSecs    Int?
  hangupCause     String?
  recordingId     String?
  recordingUrl    String?
  transcript      String?   @db.Text
  conversationId  String?   // Telnyx AI conversation ID
  aiGathered      Json?     // Structured data from AI gather
  callType        String    @default("manual") // 'manual' | 'ai_inbound' | 'ai_outbound'

  // Relations
  propertyId      String?
  property        Property? @relation(fields: [propertyId], references: [id])
  userId          String?
  user            User?     @relation(fields: [userId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model SmsMessage {
  id          String    @id @default(cuid())
  telnyxId    String    @unique
  from        String
  to          String
  body        String    @db.Text
  mediaUrls   Json?     // Array of URLs for MMS
  direction   String    // 'inbound' | 'outbound'
  status      String    // 'queued' | 'sent' | 'delivered' | 'delivery_failed' | 'received'
  segmentCount Int      @default(1)

  // Relations
  propertyId  String?
  property    Property? @relation(fields: [propertyId], references: [id])

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model TelnyxNumber {
  id                  String    @id @default(cuid())
  phoneNumber         String    @unique  // E.164 format
  telnyxNumberId      String?            // Telnyx internal ID
  market              String?            // e.g., "Denver, CO"
  status              String    @default("active")
  features            Json      @default("[]") // ['sms', 'voice']
  monthlyCost         Decimal?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

model WebhookEvent {
  id            String   @id @default(cuid())
  telnyxEventId String   @unique
  eventType     String
  processedAt   DateTime @default(now())
}

model OptOut {
  id          String   @id @default(cuid())
  phoneNumber String   @unique
  channel     String   @default("sms") // 'sms' | 'voice'
  optedOutAt  DateTime @default(now())
}
```

---

## 11. API Routes to Build

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/telnyx/token` | GET | Generate WebRTC JWT for browser |
| `/api/telnyx/numbers/search` | GET | Search available numbers |
| `/api/telnyx/numbers/order` | POST | Purchase a number |
| `/api/telnyx/calls/outbound` | POST | Initiate outbound call (server-side, non-WebRTC) |
| `/api/telnyx/calls/[id]/transfer` | POST | Transfer active call |
| `/api/telnyx/calls/[id]/recording` | GET | Get recording URL |
| `/api/telnyx/calls/[id]/transcript` | GET | Get transcript |
| `/api/telnyx/sms/send` | POST | Send SMS to lead |
| `/api/webhooks/voice` | POST | Handle all voice events |
| `/api/webhooks/sms` | POST | Handle all SMS events |
| `/api/ai/dynamic-variables` | POST | Telnyx calls this to get per-caller variables |
| `/api/ai/tools/lookup-lead` | POST | AI tool: look up lead by phone |
| `/api/ai/tools/update-lead` | POST | AI tool: update lead with gathered info |

---

## 12. Environment Variables

Add to `.env.local` and Railway:

```bash
# Telnyx Core
TELNYX_API_KEY=KEY...
TELNYX_PUBLIC_KEY=...          # For webhook signature verification (from portal)

# One-time setup IDs (from Section 2)
TELNYX_CALL_CONTROL_APP_ID=...
TELNYX_MESSAGING_PROFILE_ID=...
TELNYX_OUTBOUND_VOICE_PROFILE_ID=...
TELNYX_CREDENTIAL_CONNECTION_ID=...
TELNYX_TELEPHONY_CREDENTIAL_ID=...
TELNYX_AI_ASSISTANT_ID=...

# Browser (NEXT_PUBLIC_ = safe to expose)
NEXT_PUBLIC_TELNYX_CALLER_ID=+1XXXXXXXXXX   # Default caller ID for outbound

# AWS S3 (for recording storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_RECORDINGS=flipops-call-recordings
AWS_REGION=us-east-1
```

---

## 13. Pricing Estimate

| Feature | Rate | At 500 calls/mo (10 min avg) |
|---------|------|------------------------------|
| AI inbound calls | $0.08/min | $400/mo |
| Manual dialer (WebRTC) | $0.002/min | $10/mo |
| Outbound voice (PSTN) | ~$0.01/min | $50/mo |
| Real-time transcription (Google) | $0.05/min | $250/mo |
| SMS (outbound) | ~$0.004/msg | $20/mo (5k msgs) |
| Phone numbers | $1–2/mo each | $10–20/mo (10 numbers) |
| **Estimated total** | | **~$740–800/mo** |

**Cost reduction strategies:**
- Use Telnyx Engine B transcription ($0.025/min) instead of Google for non-AI calls — saves ~$125/mo
- AI calls include transcription — don't run separate STT on AI-handled calls
- Use number pool (fewer numbers per market) — saves $10–15/mo

---

## 14. Build Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Create Telnyx account, set up API key
- [ ] Run one-time setup: Outbound Voice Profile, Call Control App, Messaging Profile, Credential Connection
- [ ] Add `TELNYX_*` environment variables to dev + Railway
- [ ] Configure custom S3 storage for recordings
- [ ] Add Prisma schema (`PhoneCall`, `SmsMessage`, `TelnyxNumber`, `WebhookEvent`, `OptOut`)
- [ ] Run migration
- [ ] Build `/api/webhooks/voice` handler (basic: initiated → answer → hangup)
- [ ] Build `/api/webhooks/sms` handler (inbound logging)

### Phase 2 — SMS Outreach (Week 2–3)
- [ ] Order first batch of numbers (per market)
- [ ] Build `/api/telnyx/sms/send` route
- [ ] Wire SMS sending into Campaigns page
- [ ] Handle inbound SMS in Inbox (thread by sender)
- [ ] Submit 10DLC brand + campaign (start early — 1–7 day vetting)

### Phase 3 — Embedded Dialer (Week 3–4)
- [ ] Install `@telnyx/webrtc`, `@telnyx/react-client`
- [ ] Build `/api/telnyx/token` JWT endpoint
- [ ] Build `TelnyxProvider` client component
- [ ] Build `Dialer` component (dial, mute, hold, DTMF, hangup)
- [ ] Add dialer to Leads page (click-to-call from lead card)
- [ ] Add dialer to Inbox (call from conversation thread)
- [ ] Build transfer UI → `/api/telnyx/calls/[id]/transfer`
- [ ] Build recording playback in call log

### Phase 4 — AI Inbound (Week 4–6)
- [ ] Create AI Assistant with system prompt + tools
- [ ] Configure `dynamic_variables_webhook_url`
- [ ] Build AI tool endpoints (`/api/ai/tools/*`)
- [ ] Upgrade `/api/webhooks/voice` for full AI flow
- [ ] Build `call.conversation.ended` handler (save transcript → DB → task)
- [ ] Add call log view to Leads page (recordings, transcripts, AI gathered data)
- [ ] Test with a real inbound call

### Phase 5 — Polish (Week 6+)
- [ ] Call log / history UI in Leads page
- [ ] Recording playback component
- [ ] Transcript viewer with speaker labels
- [ ] AI call insights display (sentiment, gathered fields)
- [ ] Opt-out management
- [ ] Call quality metrics from `call.hangup` payload
- [ ] Number management UI (`/api/telnyx/numbers/*`)

---

## Key Technical Constraints

1. **Webhook ACK in < 2000ms** — always `res.sendStatus(200)` before any async processing
2. **Recording URLs expire in 10 min** — use S3 custom storage (Section 2f) from day 1
3. **`client_state` must be valid base64** — always `Buffer.from(JSON.stringify(obj)).toString('base64')`
4. **`command_id` is required for production** — prevents duplicate commands on webhook retries
5. **AI + real-time transcription are mutually exclusive** — use AI's built-in message history instead
6. **WebRTC requires HTTPS** — works on Vercel/Railway, not plain HTTP localhost
7. **Multi-client WebRTC** — last to register receives calls; use separate credentials per agent
8. **10DLC takes 1–7 days** — start the brand registration before you need SMS at scale
9. **Phone numbers need both `connection_id` AND `messaging_profile_id`** — set both at order time
10. **Conferences expire after 4 hours** regardless of participants

---

*Research sourced from Telnyx official documentation, March 2026.*
*Covers: Call Control API (v2), WebRTC SDK, AI Assistants, TeXML, Numbers API, Messaging API, 10DLC.*
