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

/**
 * Look up the User who owns a FlipOps Telnyx phone number.
 *
 * Returns the owning userId, or null if no TelnyxNumber row matches.
 * This is the foundation for owner-scoped property lookups: by resolving
 * the inbound 'to' (or outbound 'from') FlipOps-owned number to a User,
 * we can scope ALL downstream Property/CampaignRecipient queries to that
 * tenant — eliminating cross-tenant contamination by construction rather
 * than by ambiguity-refusal.
 */
async function findTelnyxNumberOwner(toE164: string): Promise<{ userId: string } | null> {
  try {
    const row = await prisma.telnyxNumber.findUnique({
      where: { phoneNumber: toE164 },
      select: { userId: true },
    });
    return row ?? null;
  } catch (e) {
    console.error('[telnyx:webhook] findTelnyxNumberOwner failed', e);
    return null;
  }
}

/**
 * Find a Property whose `phoneNumbers` JSON contains `fromE164`, scoped to
 * the User who owns the FlipOps `toE164` number.
 *
 * Owner scoping is the long-term fix for cross-tenant contamination: we no
 * longer scan ALL users hoping the exact-quote substring is unique. We first
 * resolve `toE164` -> owning userId via TelnyxNumber, then constrain the
 * Property query by that userId.
 *
 * Return sentinels:
 *   'unknown_to' — inbound landed on a phone number we don't own. Treat as
 *                  drop-on-floor: the SMS was delivered to us in error or the
 *                  TelnyxNumber row hasn't been provisioned yet.
 *   'ambiguous'  — owning user has multiple Properties whose phoneNumbers JSON
 *                  contains the same `fromE164`. With owner scoping this is a
 *                  legitimate scenario (e.g. one owner has multiple distress
 *                  signals surfaced as separate Property rows). Tiebreaker:
 *                  we pick the most-recently-updated Property as a
 *                  deterministic, sensible default for the single-tenant
 *                  context (no cross-tenant risk once the owner is fixed),
 *                  so this sentinel is NEVER actually returned today. It's
 *                  preserved on the type union so callers stay forward-
 *                  compatible if we ever want to switch back to strict
 *                  refusal-on-multi-match.
 *
 * Uses the same double-quote-wrapped substring match from the post-security-fix
 * `findPropertyByPhone` to avoid partial-digit collisions with zip codes, EINs,
 * or other numeric fields encoded in the JSON column.
 */
async function findPropertyByPhoneScopedToOwner(
  fromE164: string,
  toE164: string
): Promise<
  | { id: string; userId: string; contactNotes: string | null }
  | 'unknown_to'
  | 'ambiguous'
  | null
> {
  const owner = await findTelnyxNumberOwner(toE164);
  if (!owner) {
    console.warn('[telnyx:webhook] inbound to unknown FlipOps number', { to: toE164 });
    return 'unknown_to';
  }

  try {
    // JSON arrays stored as strings look like `["+19045551234","+19045555678"]`;
    // wrapping the needle in double-quotes ensures we only hit exact-string
    // elements, never partial substrings inside other JSON fields.
    const digits = fromE164.replace(/\D/g, '');
    const rows = await prisma.property.findMany({
      where: {
        userId: owner.userId,
        OR: [
          { phoneNumbers: { contains: '"' + fromE164 + '"' } },
          { phoneNumbers: { contains: '"' + digits + '"' } },
        ],
      },
      select: { id: true, userId: true, contactNotes: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    if (rows.length === 0) return null;
    if (rows.length > 1) {
      // Owner-scoped multi-match: legitimate scenario (single user with several
      // Property rows for the same phone — multiple distress signals tied to
      // the same owner). Deterministic tiebreaker: take the most-recently-
      // updated Property (orderBy updatedAt desc above). Logged for ops.
      console.warn(
        '[telnyx:webhook] owner-scoped multi-match — picking most-recently-updated Property',
        {
          fromE164,
          toE164,
          userId: owner.userId,
          matchCount: rows.length,
          matches: rows.map((r) => ({ propertyId: r.id, updatedAt: r.updatedAt })),
          chosen: rows[0].id,
        }
      );
    }
    const { id, userId, contactNotes } = rows[0];
    return { id, userId, contactNotes };
  } catch (e) {
    console.error('[telnyx:webhook] findPropertyByPhoneScopedToOwner failed', e);
    return null;
  }
}

/**
 * M1.1 step 6: stamp CampaignRecipient.repliedAt when an inbound SMS arrives
 * from a number we recently messaged.
 *
 * Looks up the most recent CampaignRecipient for `fromE164` (the lead's phone,
 * which was the outbound `toPhoneNumber`) with sentAt within the last 30 days
 * and repliedAt still null — first reply wins, repeat replies don't re-stamp
 * or double-count. Bumps the parent Campaign.replyCount once per recipient.
 *
 * Best-effort like the Notification/Activity blocks: failures must NEVER
 * break the inbound SMS webhook ack to Telnyx.
 */
async function stampCampaignReply(fromE164: string, occurredAt: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recipient = await prisma.campaignRecipient.findFirst({
      where: {
        toPhoneNumber: fromE164,
        sentAt: { gte: since },
        repliedAt: null,
      },
      orderBy: { sentAt: 'desc' },
      select: { id: true, campaignId: true },
    });
    if (!recipient) return;

    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { repliedAt: occurredAt ? new Date(occurredAt) : new Date() },
    });
    await prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: { replyCount: { increment: 1 } },
    });
    console.log('[telnyx:webhook] campaign reply stamped', {
      recipientId: recipient.id,
      campaignId: recipient.campaignId,
      from: fromE164,
    });
  } catch (e) {
    console.error('[telnyx:webhook] stampCampaignReply failed (non-fatal)', e);
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
  const toE164 = normalizeE164(toRaw);

  console.log('[telnyx:webhook] message.received', {
    telnyxMessageId: p.id,
    from: fromE164,
    to: toE164,
    length: text.length,
  });

  if (!fromE164) {
    return { action: 'inbound_dropped_no_from', propertyId: null };
  }
  if (!toE164) {
    // Without a 'to' we can't resolve the owning user — drop rather than
    // fall back to scanning all tenants.
    return { action: 'inbound_dropped_no_to', propertyId: null };
  }

  // M1.1: stamp repliedAt for EVERY valid inbound SMS — deliberately BEFORE
  // property resolution, because CampaignRecipient is keyed by phone number
  // and a reply can match a recipient even when no Property row matches
  // (the exact case the property-unmatched early returns below would skip).
  await stampCampaignReply(fromE164, occurredAt);

  const property = await findPropertyByPhoneScopedToOwner(fromE164, toE164);
  if (property === 'unknown_to') {
    // Inbound SMS landed on a number we don't own (or haven't provisioned
    // yet). Webhook still 200s; warn logged inside the lookup helper.
    return { action: 'inbound_to_unowned_number', propertyId: null };
  }
  if (property === 'ambiguous') {
    // Reserved sentinel — see findPropertyByPhoneScopedToOwner. Today the
    // helper tiebreaks via most-recently-updated so this branch is never
    // taken, but preserving it keeps the security-fix refusal behavior
    // available if we ever opt back into strict mode.
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

  // Best-effort: create a Notification row for the owning user. Wrapped in
  // try/catch so a notification insert failure (e.g. schema not yet migrated,
  // duplicate eventId on Telnyx redelivery) never breaks the inbound SMS flow.
  //
  // Schema note: Notification has a single `message` column, not title/body.
  // We JSON-encode { title, body } into `message` so /api/notifications/me can
  // decode and surface the structured shape the UI expects.
  try {
    const body = text.slice(0, 280);
    await prisma.notification.create({
      data: {
        eventId: `sms.inbound:${p.id}`,
        userId: property.userId,
        type: 'sms.inbound',
        message: JSON.stringify({ title: 'New SMS reply', body }),
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        createdAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
  } catch (e) {
    console.error('[telnyx:webhook] notification.create failed (non-fatal)', e);
  }

  // Lane 3: mirror inbound SMS into Activity. Wrapped in try/catch — the SMS
  // ingest path is load-bearing; a missing/changed Activity model must NEVER
  // fail the webhook acknowledgement to Telnyx.
  try {
    await prisma.activity.create({
      data: {
        userId: property.userId,
        propertyId: property.id,
        type: 'sms_received',
        occurredAt: new Date(occurredAt || new Date().toISOString()),
        notes: text.slice(0, 500),
      },
    });
  } catch (e) {
    console.error('[telnyx:webhook] activity.create(sms_received) failed (non-fatal)', e);
  }

  return { action: 'inbound_logged', propertyId: property.id };
}

async function handleMessageSent(
  p: TelnyxMessagePayload
): Promise<{ action: string; telnyxMessageId: string }> {
  // The dialer-dispatch worker has already marked CampaignRecipient.status='sent'
  // immediately after sendSMS() returned a messageId. Telnyx 'message.sent' fires
  // AFTER our worker, so this handler is just a no-op / log for idempotency.
  // We still verify the row exists for observability.
  //
  // Owner-lookup hook (Lane 4 prep): outbound 'from' is a FlipOps-owned number,
  // so resolve owner now and thread userId into observability. When Lane 4
  // wires owner-scoped CampaignRecipient lookups, this same userId will be the
  // safety scope on the findUnique above.
  const fromE164 = normalizeE164(p.from?.phone_number);
  const owner = fromE164 ? await findTelnyxNumberOwner(fromE164) : null;
  try {
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { telnyxMessageId: p.id },
      select: { id: true, campaignId: true, status: true },
    });
    console.log('[telnyx:webhook] message.sent', {
      telnyxMessageId: p.id,
      messagingProfileId: p.messaging_profile_id,
      from: fromE164,
      to: p.to?.[0]?.phone_number,
      ownerUserId: owner?.userId ?? null,
      recipientFound: !!recipient,
      campaignId: recipient?.campaignId,
      currentStatus: recipient?.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telnyx:webhook] message.sent recipient lookup failed', msg);
  }
  return { action: 'sent_logged', telnyxMessageId: p.id };
}

async function handleMessageFinalized(
  p: TelnyxMessagePayload
): Promise<{ action: string; status: string }> {
  const status = p.to?.[0]?.status ?? 'unknown';
  // Owner-lookup hook (Lane 4 prep): outbound 'from' is a FlipOps-owned number.
  // Threading userId now means Lane 4 (CampaignRecipient lookup by
  // telnyxMessageId) can scope by userId for safety once the join is wired.
  const fromE164 = normalizeE164(p.from?.phone_number);
  const owner = fromE164 ? await findTelnyxNumberOwner(fromE164) : null;
  // Resolve CampaignRecipient by telnyxMessageId and flip status to
  // 'delivered' or 'failed' + bump the parent Campaign counter. Wrapped in
  // try/catch — counter drift must never break the webhook ack to Telnyx.
  try {
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { telnyxMessageId: p.id },
      select: { id: true, campaignId: true, status: true },
    });
    if (recipient) {
      if (status === 'delivered') {
        // Idempotency guard: Telnyx can re-deliver webhooks on retry; skip
        // the increment if we've already recorded delivery for this row.
        if (recipient.status !== 'delivered') {
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'delivered', deliveredAt: new Date() },
          });
          await prisma.campaign.update({
            where: { id: recipient.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });
        }
      } else if (status === 'delivery_failed' || status === 'sending_failed') {
        if (recipient.status !== 'failed') {
          const reason =
            p.errors?.[0]?.detail ??
            p.errors?.[0]?.title ??
            p.errors?.[0]?.code ??
            status;
          await prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
              failureReason: reason,
            },
          });
          await prisma.campaign.update({
            where: { id: recipient.campaignId },
            data: { failedCount: { increment: 1 } },
          });
        }
      }
    }
    console.log('[telnyx:webhook] message.finalized', {
      telnyxMessageId: p.id,
      status,
      from: fromE164,
      ownerUserId: owner?.userId ?? null,
      errors: p.errors,
      recipientFound: !!recipient,
      campaignId: recipient?.campaignId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telnyx:webhook] message.finalized counter update failed', msg);
  }
  return { action: 'finalized_logged', status };
}

async function handleMessageDeliveryFailed(
  p: TelnyxMessagePayload
): Promise<{ action: string; status: string }> {
  const status = p.to?.[0]?.status ?? 'delivery_failed';
  // Owner-lookup hook (Lane 4 prep): outbound 'from' is a FlipOps-owned number.
  // Threading userId now means Lane 4 (CampaignRecipient lookup by
  // telnyxMessageId) can scope by userId for safety once the join is wired.
  const fromE164 = normalizeE164(p.from?.phone_number);
  const owner = fromE164 ? await findTelnyxNumberOwner(fromE164) : null;
  // Same failed-branch logic as handleMessageFinalized; Telnyx fires this in
  // addition to message.finalized when delivery hard-fails. Idempotency
  // guard (status !== 'failed') prevents double-counting.
  try {
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { telnyxMessageId: p.id },
      select: { id: true, campaignId: true, status: true },
    });
    if (recipient && recipient.status !== 'failed') {
      const reason =
        p.errors?.[0]?.detail ??
        p.errors?.[0]?.title ??
        p.errors?.[0]?.code ??
        status;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: reason,
        },
      });
      await prisma.campaign.update({
        where: { id: recipient.campaignId },
        data: { failedCount: { increment: 1 } },
      });
    }
    console.error('[telnyx:webhook] message.delivery_failed', {
      telnyxMessageId: p.id,
      status,
      from: fromE164,
      ownerUserId: owner?.userId ?? null,
      errors: p.errors,
      to: p.to?.[0]?.phone_number,
      recipientFound: !!recipient,
      campaignId: recipient?.campaignId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telnyx:webhook] message.delivery_failed counter update failed', msg);
  }
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
