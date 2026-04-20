import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// CallTools webhook payload schema
// Covers: call completed, disposition, voicemail drop, SMS reply, etc.
// ---------------------------------------------------------------------------

const CallerInfoSchema = z.object({
  phone: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

const AgentInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});

const CallDataSchema = z.object({
  // Call identifiers
  call_id: z.string(),
  campaign_id: z.string().optional(),
  campaign_name: z.string().optional(),
  list_id: z.string().optional(),

  // Call details
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
  disposition: z.string().optional(),               // "Interested", "No Answer", "Voicemail", "DNC", etc.
  duration: z.number().optional(),                   // seconds
  talk_time: z.number().optional(),                  // seconds of actual conversation
  hold_time: z.number().optional(),                  // seconds on hold
  wrap_time: z.number().optional(),                  // seconds in after-call work

  // Timestamps
  call_start: z.string().optional(),                 // ISO 8601
  call_end: z.string().optional(),

  // Recording
  recording_url: z.string().url().optional().or(z.literal('')),

  // Caller / lead info
  caller: CallerInfoSchema.optional(),

  // Agent info (who handled the call)
  agent: AgentInfoSchema.optional(),

  // Notes & tags
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),

  // Custom fields passed through from CallTools
  custom_fields: z.record(z.any()).optional(),
});

const WebhookPayloadSchema = z.object({
  event: z.string(),                                 // "call.completed", "call.dispositioned", etc.
  data: CallDataSchema,
  timestamp: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Normalize phone to digits-only for matching against Property.phoneNumbers
// ---------------------------------------------------------------------------

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Strip leading "1" country code if 11 digits
  return digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;
}

// ---------------------------------------------------------------------------
// POST — receive webhook events from CallTools
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // --- Auth: API key (required) ---
    // Accepts dedicated CALLTOOLS_API_KEY or the shared FO_API_KEY
    const apiKey =
      request.headers.get('x-api-key') ??
      request.headers.get('authorization')?.replace('Bearer ', '');
    const calltoolsKey = process.env.CALLTOOLS_API_KEY;
    const foKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    const keyMatch =
      (calltoolsKey && apiKey === calltoolsKey) ||
      (foKey && apiKey === foKey);

    if (!keyMatch) {
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 401 },
      );
    }

    // --- Signature verification (if secret is configured) ---
    const rawBody = await request.text();
    const webhookSecret = process.env.CALLTOOLS_WEBHOOK_SECRET;
    const signature = request.headers.get('x-calltools-signature');

    if (webhookSecret && signature) {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json(
          { error: 'Invalid signature', requestId },
          { status: 401 },
        );
      }
    }

    // --- Parse & validate ---
    const body = JSON.parse(rawBody);
    const parsed = WebhookPayloadSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[CallTools Webhook] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues, requestId },
        { status: 400 },
      );
    }

    const { event, data } = parsed.data;
    const callerPhone = data.caller?.phone ? normalizePhone(data.caller.phone) : null;

    console.log('[CallTools Webhook]', {
      requestId,
      event,
      callId: data.call_id,
      disposition: data.disposition,
      callerPhone,
      duration: data.duration,
    });

    // --- Match to a property lead ---
    let matchedProperty: { id: string; userId: string; address: string } | null = null;

    if (callerPhone) {
      // phoneNumbers is stored as a JSON-stringified array — search with contains
      matchedProperty = await prisma.property.findFirst({
        where: { phoneNumbers: { contains: callerPhone } },
        select: { id: true, userId: true, address: true },
      });
    }

    // --- Store the call record ---
    // Using a generic metadata JSON approach so we don't need a migration right away.
    // When the PhoneCall model from the Telnyx spec is migrated, these can move there.
    const callRecord = {
      calltoolsCallId: data.call_id,
      event,
      direction: data.direction,
      disposition: data.disposition ?? null,
      duration: data.duration ?? null,
      talkTime: data.talk_time ?? null,
      callerPhone: callerPhone ?? data.caller?.phone ?? null,
      callerName: data.caller?.name ?? null,
      agentName: data.agent?.name ?? null,
      agentId: data.agent?.id ?? null,
      campaignId: data.campaign_id ?? null,
      campaignName: data.campaign_name ?? null,
      recordingUrl: data.recording_url || null,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      customFields: data.custom_fields ?? {},
      callStart: data.call_start ?? null,
      callEnd: data.call_end ?? null,
      matchedPropertyId: matchedProperty?.id ?? null,
      receivedAt: new Date().toISOString(),
    };

    // Store as an audit event for replay / debugging
    const payloadJson = JSON.stringify(callRecord);
    const checksum = crypto.createHash('sha256').update(payloadJson).digest('hex');

    await prisma.event.create({
      data: {
        actor: 'calltools',
        artifact: `call:${data.call_id}`,
        action: event,
        diff: payloadJson,
        checksum,
      },
    });

    // --- Update the matched property's outreach fields ---
    if (matchedProperty && data.disposition) {
      const now = new Date();
      const disposition = data.disposition.toLowerCase();

      // Map CallTools dispositions → FlipOps outreach status
      let outreachStatus: string | undefined;
      let ownerResponse: string | undefined;
      let sentiment: string | undefined;

      if (['interested', 'hot lead', 'callback', 'appointment set'].includes(disposition)) {
        outreachStatus = 'contacted';
        ownerResponse = 'interested';
        sentiment = 'positive';
      } else if (['not interested', 'not selling', 'dnc', 'do not call'].includes(disposition)) {
        outreachStatus = 'contacted';
        ownerResponse = 'not_interested';
        sentiment = 'negative';
      } else if (['no answer', 'busy', 'disconnected', 'wrong number'].includes(disposition)) {
        outreachStatus = 'attempted';
        ownerResponse = 'no_answer';
      } else if (['voicemail', 'left voicemail', 'left message'].includes(disposition)) {
        outreachStatus = 'attempted';
        ownerResponse = 'no_answer';
      } else if (['callback', 'call back', 'follow up'].includes(disposition)) {
        outreachStatus = 'contacted';
        ownerResponse = 'callback';
        sentiment = 'neutral';
      } else {
        // Unknown disposition — mark as attempted at minimum
        outreachStatus = 'attempted';
      }

      // Build contact note entry
      const noteEntry = {
        date: now.toISOString(),
        method: 'phone',
        note: `CallTools: ${data.disposition}${data.notes ? ` — ${data.notes}` : ''}`,
        sentiment: sentiment ?? 'neutral',
        source: 'calltools',
        callId: data.call_id,
        duration: data.duration ?? null,
        agent: data.agent?.name ?? null,
      };

      // Read existing notes, append
      const existing = await prisma.property.findUnique({
        where: { id: matchedProperty.id },
        select: { contactNotes: true },
      });

      const existingNotes: unknown[] = existing?.contactNotes
        ? JSON.parse(existing.contactNotes)
        : [];
      existingNotes.push(noteEntry);

      await prisma.property.update({
        where: { id: matchedProperty.id },
        data: {
          outreachStatus,
          ownerResponse,
          sentiment,
          lastContactDate: now,
          lastContactMethod: 'phone',
          contactNotes: JSON.stringify(existingNotes),
          ...(ownerResponse === 'callback'
            ? { nextFollowUpDate: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
            : {}),
        },
      });

      console.log('[CallTools Webhook] Updated property', {
        propertyId: matchedProperty.id,
        address: matchedProperty.address,
        outreachStatus,
        ownerResponse,
      });
    }

    // --- Create a follow-up task for positive dispositions ---
    if (
      matchedProperty &&
      data.disposition &&
      ['interested', 'hot lead', 'callback', 'appointment set', 'call back', 'follow up'].includes(
        data.disposition.toLowerCase(),
      )
    ) {
      await prisma.task.create({
        data: {
          userId: matchedProperty.userId,
          propertyId: matchedProperty.id,
          type: 'follow_up',
          title: `Follow up — ${data.disposition} (${matchedProperty.address})`,
          description: data.notes
            ? `CallTools notes: ${data.notes}`
            : `Disposition: ${data.disposition}. Call duration: ${data.duration ?? 0}s.`,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          priority: data.disposition.toLowerCase() === 'hot lead' ? 'high' : 'medium',
        },
      });
    }

    return NextResponse.json({
      success: true,
      requestId,
      matched: !!matchedProperty,
      propertyId: matchedProperty?.id ?? null,
    });
  } catch (error) {
    console.error('[CallTools Webhook Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues, requestId },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', requestId },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — health check
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhooks/calltools',
    timestamp: new Date().toISOString(),
    acceptedEvents: [
      'call.completed',
      'call.dispositioned',
      'voicemail.dropped',
      'sms.received',
    ],
    authMethods: ['api-key (x-api-key header)', 'signature (x-calltools-signature header)'],
  });
}
