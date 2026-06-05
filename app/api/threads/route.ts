import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/threads
//
// Phase 5 MVP: synthesizes message threads from Property.contactNotes JSON.
// There is no Message / Conversation / Thread Prisma model yet — contactNotes
// is the existing source of truth (CallTools webhook + manual notes both write
// here). One Thread per Property that has at least one contactNote entry.
//
// Shape contract:
//   Thread { id, leadId, leadName, leadAddress, lastMessage, lastMessageTime,
//            unreadCount, channels[], sentiment?, score, stage, tags[],
//            phoneNumbers[], emails[], optInStatus{sms,email},
//            messages: Message[] }
//   Message { id, threadId, direction, channel, body, status, timestamp,
//             sender?, sentiment? }
//
// Deferred (acknowledged TODOs, not built here):
//   - Outbound reply via Nylas / Telnyx SMS
//   - Real-time webhook -> thread updates (server-sent events / pusher)
//   - Sentiment recomputation
// ---------------------------------------------------------------------------

type RawContactNote = {
  date?: string;
  note?: string;
  method?: string;
  sentiment?: string;
  source?: string;
  callId?: string;
  duration?: number | null;
  agent?: string | null;
};

function safeParseNotes(raw: string | null | undefined): RawContactNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RawContactNote[]) : [];
  } catch {
    return [];
  }
}

function methodToChannel(method?: string): 'sms' | 'email' | 'voicemail' {
  const m = (method ?? '').toLowerCase();
  if (m === 'email') return 'email';
  if (m === 'voicemail' || m === 'vm') return 'voicemail';
  // 'phone', 'sms', 'text', anything else -> sms (closest UI fit)
  if (m === 'phone') return 'voicemail';
  return 'sms';
}

function normalizeSentiment(s?: string): 'positive' | 'neutral' | 'negative' | undefined {
  const v = (s ?? '').toLowerCase();
  if (v === 'positive' || v === 'neutral' || v === 'negative') return v;
  return undefined;
}

function stageFromOutreachStatus(status?: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'not_contacted':
      return 'New';
    case 'attempted':
      return 'Contacted';
    case 'contacted':
      return 'Engaged';
    case 'offer_made':
    case 'negotiating':
      return 'Negotiating';
    case 'under_contract':
      return 'Under Contract';
    case 'closed':
      return 'Won';
    case 'dead':
      return 'Lost';
    default:
      return 'New';
  }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function buildTags(p: {
  preForeclosure: boolean;
  foreclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  bankruptcy: boolean;
  absenteeOwner: boolean;
}): string[] {
  const tags: string[] = [];
  if (p.preForeclosure) tags.push('Pre-foreclosure');
  if (p.foreclosure) tags.push('Foreclosure');
  if (p.taxDelinquent) tags.push('Tax Delinquent');
  if (p.vacant) tags.push('Vacant');
  if (p.bankruptcy) tags.push('Bankruptcy');
  if (p.absenteeOwner) tags.push('Absentee Owner');
  return tags;
}

export async function GET(_request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    // Properties with at least one contactNote entry. We can't easily filter on
    // "non-empty JSON array" in Postgres without a structured column, so we use
    // a coarse `not: null` filter and let the in-memory parse drop empties.
    const properties = await prisma.property.findMany({
      where: {
        userId,
        contactNotes: { not: null },
      },
      select: {
        id: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        ownerName: true,
        score: true,
        outreachStatus: true,
        sentiment: true,
        phoneNumbers: true,
        emails: true,
        contactNotes: true,
        lastContactDate: true,
        preForeclosure: true,
        foreclosure: true,
        taxDelinquent: true,
        vacant: true,
        bankruptcy: true,
        absenteeOwner: true,
      },
      orderBy: { lastContactDate: 'desc' },
      take: 200,
    });

    const threads = properties
      .map((p) => {
        const notes = safeParseNotes(p.contactNotes);
        if (notes.length === 0) return null;

        const phoneNumbers = parseJsonArray(p.phoneNumbers);
        const emails = parseJsonArray(p.emails);
        const tags = buildTags(p);
        const leadAddress = [p.address, p.city, p.state].filter(Boolean).join(', ');
        const leadName = p.ownerName?.trim() || 'Unknown Owner';
        const threadId = `thread-${p.id}`;

        // Sort notes ascending so the last entry is the most recent message.
        const sortedNotes = [...notes].sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return da - db;
        });

        const messages = sortedNotes.map((n, i) => {
          const ts = n.date ? new Date(n.date) : new Date();
          // Heuristic: if the note text starts with "CallTools:" or has source
          // === 'calltools', it's an inbound disposition log. Otherwise treat
          // it as an outbound action recorded by the operator.
          const isInbound =
            n.source === 'calltools' || (n.note ?? '').toLowerCase().startsWith('calltools:');
          return {
            id: `msg-${p.id}-${i}`,
            threadId,
            direction: isInbound ? 'in' : 'out',
            channel: methodToChannel(n.method),
            body: n.note ?? '',
            status: 'delivered',
            timestamp: ts.toISOString(),
            sender: isInbound ? leadName.split(' ')[0] : 'You',
            sentiment: normalizeSentiment(n.sentiment),
          };
        });

        const last = messages[messages.length - 1];
        const channelSet = new Set<string>(messages.map((m) => m.channel));

        return {
          id: threadId,
          leadId: p.id,
          leadName,
          leadAddress,
          lastMessage: last?.body ?? '',
          // Send ISO strings; the client coerces back to Date via new Date(...)
          lastMessageTime: (last ? new Date(last.timestamp) : p.lastContactDate ?? new Date()).toISOString(),
          unreadCount: 0, // TODO(phase 6): track read state
          channels: Array.from(channelSet),
          sentiment: normalizeSentiment(p.sentiment ?? undefined),
          score: p.score ?? 0,
          stage: stageFromOutreachStatus(p.outreachStatus),
          tags,
          phoneNumbers,
          emails,
          // TODO(phase 6): real opt-in tracking from a ConsentLog. Default to true
          // so the composer doesn't hard-block; CallTools webhook enforces DNC.
          optInStatus: { sms: true, email: true },
          messages,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('[GET /api/threads] error', error);
    return NextResponse.json(
      { error: 'Internal server error', threads: [] },
      { status: 500 },
    );
  }
}
