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
  | 'conversation.ended'
  | 'message.received'
  | 'message.sent'
  | 'message.finalized'
  | 'message.delivery_failed';

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
// SMS event payloads (Telnyx Messaging webhook v2)
// Reference: https://developers.telnyx.com/docs/api/v2/messaging
// ----------------------------------------------------------------------------

export interface TelnyxMessageAddress {
  phone_number: string;
  carrier?: string;
  line_type?: string;
  status?: 'queued' | 'sending' | 'sent' | 'delivered' | 'delivery_failed' | 'sending_failed' | string;
}

export interface TelnyxMessagePayload {
  id: string;
  record_type?: 'message';
  direction?: 'inbound' | 'outbound';
  type?: 'SMS' | 'MMS' | string;
  messaging_profile_id?: string;
  from?: { phone_number: string; carrier?: string; line_type?: string };
  to?: TelnyxMessageAddress[];
  text?: string;
  encoding?: string;
  parts?: number;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
  received_at?: string;
  sent_at?: string;
  completed_at?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Normalize an inbound phone number to E.164-ish: strip non-digits, prefix '+'. */
function normalizeE164(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return `+${digits}`;
}

// TODO: replace with User→TelnyxNumber owner lookup. Inbound SMS arrives at a
// FlipOps-owned 'to' number; we know which User owns that number, so we should
// scope the Property search to ONLY that User's Properties. Requires either a
// TelnyxNumber{number,userId} table or a User.telnyxNumbers JSON column. Until
// then this exact-quote + ambiguity-refusal pattern prevents cross-tenant
// contamination.
/**
 * Find the first Property whose `phoneNumbers` JSON string contains the
 * given E.164 number. Scans across ALL users because inbound SMS arrives at
 * a Telnyx-owned number and we cannot pre-filter by userId here.
 *
 * Uses a substring `contains` match against the JSON-encoded column wrapped in
 * double-quotes so we only match exact-string array elements (never partial
 * digit runs that could collide with zip codes, EINs, or other property
 * numbers). Limit 10 results; if more than one row matches we refuse to act
 * and return the literal 'ambiguous' so the caller can drop the inbound SMS
 * rather than mutate the wrong tenant's Property.
 */
async function findPropertyByPhone(
  e164: string
): Promise<{ id: string; userId: string; contactNotes: string | null } | 'ambiguous' | null> {
  try {
    // Match either with '+' prefix or just the digits — covers both stored shapes.
    // JSON arrays stored as strings look like `["+19045551234","+19045555678"]`;
    // wrapping the needle in double-quotes ensures we only hit exact-string
    // elements, never partial substrings inside other JSON fields.
    const digits = e164.replace(/\D/g, '');
    const rows = await prisma.property.findMany({
      where: {
        OR: [
          { phoneNumbers: { contains: '"' + e164 + '"' } },
          { phoneNumbers: { contains: '"' + digits + '"' } },
        ],
      },
      select: { id: true, userId: true, contactNotes: true },
      take: 10,
    });
    if (rows.length === 0) return null;
    if (rows.length > 1) {
      console.error('[telnyx:webhook] findPropertyByPhone ambiguous match — refusing to act', {
        e164,
        matchCount: rows.length,
        matches: rows.map((r) => ({ propertyId: r.id, userId: r.userId })),
      });
      return 'ambiguous';
    }
    return rows[0];
  } catch (e) {
    console.error('[telnyx:webhook] findPropertyByPhone failed', e);
    return null;
  }
}

/** Append a single note entry to a Property.contactNotes JSON array, creating the array if needed. */
async function appendContactNote(
  propertyId: string,
  existing: string | null,
  entry: { date: string; note: string; method: string; source: string; sentiment: string | null }
): Promise<void> {
  let arr: unknown[] = [];
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      // Existing value was not valid JSON — drop it rather than crash.
      arr = [];
    }
  }
  arr.push(entry);
  await prisma.property.update({
    where: { id: propertyId },
    data: {
      contactNotes: JSON.stringify(arr),
      lastContactDate: new Date(entry.date),
      lastContactMethod: 'sms',
    },
  });
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
// SMS handlers
// ----------------------------------------------------------------------------

async function handleMessageReceived(
  p: TelnyxMessagePayload,
  occurredAt: string
): Promise<{ action: string; propertyId: string | null }> {
  const fromRaw = p.from?.phone_number;
  const toRaw = p.to?.[0]?.phone_number;
  const text = (p.text ?? '').trim();
  const fromE164 = normalizeE164(fromRaw);

  console.log('[telnyx:webhook] message.received', {
    telnyxMessageId: p.id,
    from: fromE164,
    to: toRaw,
    length: text.length,
  });

  if (!fromE164) {
    return { action: 'inbound_dropped_no_from', propertyId: null };
  }

  const property = await findPropertyByPhone(fromE164);
  if (property === 'ambiguous') {
    // Multiple Properties across (potentially different) tenants share this
    // phone number — refuse to mutate any of them. Webhook still 200s; ops
    // can review the log line emitted inside findPropertyByPhone.
    return { action: 'inbound_ambiguous_dropped', propertyId: null };
  }
  if (!property) {
    return { action: 'inbound_unmatched', propertyId: null };
  }

  await appendContactNote(property.id, property.contactNotes, {
    date: occurredAt || new Date().toISOString(),
    note: text,
    method: 'sms',
    source: 'telnyx-inbound',
    sentiment: null,
  });

  return { action: 'inbound_logged', propertyId: property.id };
}

async function handleMessageSent(
  p: TelnyxMessagePayload
): Promise<{ action: string; telnyxMessageId: string }> {
  // Campaign-level status update is deferred — schema has no recipient mapping
  // table and no Campaign.sentCount field. Log for observability.
  console.log('[telnyx:webhook] message.sent', {
    telnyxMessageId: p.id,
    messagingProfileId: p.messaging_profile_id,
    to: p.to?.[0]?.phone_number,
  });
  return { action: 'sent_logged', telnyxMessageId: p.id };
}

async function handleMessageFinalized(
  p: TelnyxMessagePayload
): Promise<{ action: string; status: string }> {
  const status = p.to?.[0]?.status ?? 'unknown';
  // Campaign.deliveredCount / failedCount don't exist on the current schema —
  // log only. When the mapping table + counter fields land (sprint 3 L3), wire
  // increments here keyed by telnyxMessageId -> Campaign.
  console.log('[telnyx:webhook] message.finalized', {
    telnyxMessageId: p.id,
    status,
    errors: p.errors,
  });
  return { action: 'finalized_logged', status };
}

async function handleMessageDeliveryFailed(
  p: TelnyxMessagePayload
): Promise<{ action: string; status: string }> {
  const status = p.to?.[0]?.status ?? 'delivery_failed';
  console.error('[telnyx:webhook] message.delivery_failed', {
    telnyxMessageId: p.id,
    status,
    errors: p.errors,
    to: p.to?.[0]?.phone_number,
  });
  return { action: 'delivery_failed_logged', status };
}

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

export async function routeTelnyxEvent(
  envelope: TelnyxWebhookEnvelope
): Promise<{ handled: boolean; eventType: string; action?: string; propertyId?: string | null; telnyxMessageId?: string; status?: string; error?: string }> {
  const eventType = envelope?.data?.event_type;
  const occurredAt = envelope?.data?.occurred_at ?? new Date().toISOString();
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
    case 'message.received':
      try {
        const r = await handleMessageReceived(payload as TelnyxMessagePayload, occurredAt);
        return { handled: true, eventType, action: r.action, propertyId: r.propertyId };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telnyx:webhook] message.received handler threw', msg);
        return { handled: false, eventType, error: msg };
      }
    case 'message.sent':
      try {
        const r = await handleMessageSent(payload as TelnyxMessagePayload);
        return { handled: true, eventType, action: r.action, telnyxMessageId: r.telnyxMessageId };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telnyx:webhook] message.sent handler threw', msg);
        return { handled: false, eventType, error: msg };
      }
    case 'message.finalized':
      try {
        const r = await handleMessageFinalized(payload as TelnyxMessagePayload);
        return { handled: true, eventType, action: r.action, status: r.status };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telnyx:webhook] message.finalized handler threw', msg);
        return { handled: false, eventType, error: msg };
      }
    case 'message.delivery_failed':
      try {
        const r = await handleMessageDeliveryFailed(payload as TelnyxMessagePayload);
        return { handled: true, eventType, action: r.action, status: r.status };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[telnyx:webhook] message.delivery_failed handler threw', msg);
        return { handled: false, eventType, error: msg };
      }
    default:
      console.log('[telnyx:webhook] unhandled event', { eventType });
      return { handled: false, eventType: eventType ?? 'unknown' };
  }
}
