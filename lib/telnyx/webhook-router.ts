/**
 * Telnyx Webhook Event Router
 * --------------------------------------------------------------------------
 * Typed dispatcher for Telnyx Call Control webhook events.
 *
 * Status (2026-06-08): PhoneCall Prisma model is NOT YET migrated. All
 * persistence calls are gated behind `PHONECALL_MODEL_READY=1` env var.
 * When the schema patch in prisma/schema.patch.phonecall.prisma is merged
 * and `prisma db push` + `prisma generate` are run, flip the env var on
 * and the router activates without any code change.
 *
 * Event reference: https://developers.telnyx.com/docs/api/v2/call-control
 */

import { prisma } from '@/lib/prisma';

// ----------------------------------------------------------------------------
// Event types (subset — extend as needed)
// ----------------------------------------------------------------------------

export type TelnyxEventType =
  | 'call.initiated'
  | 'call.answered'
  | 'call.hangup'
  | 'call.recording.saved'
  | 'call.transcription.received'
  | 'conversation.ended';

export interface TelnyxWebhookEnvelope<P = unknown> {
  data: {
    record_type: 'event';
    id: string;
    event_type: TelnyxEventType | string;
    occurred_at: string;
    payload: P;
  };
  meta?: { attempt?: number; delivered_to?: string };
}

export interface CallInitiatedPayload {
  call_control_id: string;
  call_leg_id?: string;
  connection_id?: string;
  direction: 'incoming' | 'outgoing';
  from: string;
  to: string;
  state: string;
  client_state?: string;
  start_time?: string;
}

export interface CallAnsweredPayload extends CallInitiatedPayload {
  // Same shape as initiated for our purposes.
}

export interface CallHangupPayload {
  call_control_id: string;
  hangup_cause?: string;
  hangup_source?: string;
  start_time?: string;
  end_time?: string;
}

export interface CallRecordingSavedPayload {
  call_control_id: string;
  recording_urls?: { mp3?: string; wav?: string };
  public_recording_urls?: { mp3?: string; wav?: string };
  duration_millis?: number;
  channels?: 'single' | 'dual';
}

export interface CallTranscriptionReceivedPayload {
  call_control_id: string;
  transcription_data?: {
    transcript?: string;
    confidence?: number;
    is_final?: boolean;
  };
  language?: string;
}

export interface ConversationEndedPayload {
  call_control_id?: string;
  conversation_id?: string;
}

// ----------------------------------------------------------------------------
// Feature flag
// ----------------------------------------------------------------------------

function modelReady(): boolean {
  return process.env.PHONECALL_MODEL_READY === '1';
}

// `phoneCall` does not exist on the Prisma client until the schema patch is
// applied + `prisma generate` runs. The cast is intentional and isolated here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pc(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prisma as any;
  return client?.phoneCall ?? null;
}

// ----------------------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------------------

async function handleCallInitiated(p: CallInitiatedPayload) {
  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] call.initiated', {
      callControlId: p.call_control_id,
      direction: p.direction,
      from: p.from,
      to: p.to,
    });
    return;
  }
  await pc().upsert({
    where: { telnyxCallControlId: p.call_control_id },
    create: {
      telnyxCallControlId: p.call_control_id,
      telnyxLegId: p.call_leg_id,
      telnyxConnectionId: p.connection_id,
      direction: p.direction === 'incoming' ? 'inbound' : 'outbound',
      fromNumber: p.from,
      toNumber: p.to,
      status: 'initiated',
      startedAt: p.start_time ? new Date(p.start_time) : new Date(),
      // userId resolution is intentionally deferred — populated by
      // a downstream resolver that maps `to` (or connection_id) -> User.
      // For now: a placeholder will fail the FK and be caught by route logger.
      // Sprint 3 plan: wire a phone-number -> userId lookup table.
      userId: 'TODO_RESOLVE_USER_FROM_NUMBER',
    },
    update: {
      status: 'initiated',
      startedAt: p.start_time ? new Date(p.start_time) : undefined,
    },
  });
}

async function handleCallAnswered(p: CallAnsweredPayload) {
  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] call.answered', { callControlId: p.call_control_id });
    return;
  }
  await pc().updateMany({
    where: { telnyxCallControlId: p.call_control_id },
    data: {
      status: 'answered',
      answeredAt: new Date(),
    },
  });
}

async function handleCallHangup(p: CallHangupPayload) {
  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] call.hangup', {
      callControlId: p.call_control_id,
      cause: p.hangup_cause,
    });
    return;
  }
  const startedAt = p.start_time ? new Date(p.start_time).getTime() : null;
  const endedAt = p.end_time ? new Date(p.end_time) : new Date();
  const durationSec =
    startedAt !== null ? Math.max(0, Math.round((endedAt.getTime() - startedAt) / 1000)) : null;

  await pc().updateMany({
    where: { telnyxCallControlId: p.call_control_id },
    data: {
      status: 'hangup',
      endedAt,
      hangupCause: p.hangup_cause ?? null,
      hangupSource: p.hangup_source ?? null,
      ...(durationSec !== null ? { durationSec } : {}),
    },
  });
}

async function handleCallRecordingSaved(p: CallRecordingSavedPayload) {
  // Prefer public_recording_urls (presigned) over internal recording_urls.
  const url =
    p.public_recording_urls?.mp3 ??
    p.public_recording_urls?.wav ??
    p.recording_urls?.mp3 ??
    p.recording_urls?.wav ??
    null;
  const durSec = p.duration_millis ? Math.round(p.duration_millis / 1000) : null;

  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] call.recording.saved', {
      callControlId: p.call_control_id,
      url,
      durSec,
    });
    return;
  }
  await pc().updateMany({
    where: { telnyxCallControlId: p.call_control_id },
    data: {
      recordingUrl: url,
      ...(durSec !== null ? { recordingDurationSec: durSec } : {}),
    },
  });
}

async function handleCallTranscriptionReceived(p: CallTranscriptionReceivedPayload) {
  const text = p.transcription_data?.transcript ?? null;
  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] call.transcription.received', {
      callControlId: p.call_control_id,
      length: text?.length ?? 0,
    });
    return;
  }
  if (!text) return;
  // Append to existing transcript (real-time partials append over the life of the call).
  // For Sprint 2 we overwrite with the latest final transcript only.
  if (p.transcription_data?.is_final === false) return;

  await pc().updateMany({
    where: { telnyxCallControlId: p.call_control_id },
    data: {
      transcript: text,
      transcriptLanguage: p.language ?? null,
    },
  });
}

async function handleConversationEnded(p: ConversationEndedPayload) {
  if (!modelReady() || !pc()) {
    console.log('[telnyx:webhook] conversation.ended', {
      callControlId: p.call_control_id,
      conversationId: p.conversation_id,
    });
    return;
  }
  if (!p.call_control_id) return;
  await pc().updateMany({
    where: { telnyxCallControlId: p.call_control_id },
    data: { status: 'hangup', endedAt: new Date() },
  });
}

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

export async function routeTelnyxEvent(
  envelope: TelnyxWebhookEnvelope
): Promise<{ handled: boolean; eventType: string }> {
  const eventType = envelope?.data?.event_type;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = envelope?.data?.payload as any;

  switch (eventType) {
    case 'call.initiated':
      await handleCallInitiated(payload as CallInitiatedPayload);
      return { handled: true, eventType };
    case 'call.answered':
      await handleCallAnswered(payload as CallAnsweredPayload);
      return { handled: true, eventType };
    case 'call.hangup':
      await handleCallHangup(payload as CallHangupPayload);
      return { handled: true, eventType };
    case 'call.recording.saved':
      await handleCallRecordingSaved(payload as CallRecordingSavedPayload);
      return { handled: true, eventType };
    case 'call.transcription.received':
      await handleCallTranscriptionReceived(payload as CallTranscriptionReceivedPayload);
      return { handled: true, eventType };
    case 'conversation.ended':
      await handleConversationEnded(payload as ConversationEndedPayload);
      return { handled: true, eventType };
    default:
      console.log('[telnyx:webhook] unhandled event', { eventType });
      return { handled: false, eventType: eventType ?? 'unknown' };
  }
}
