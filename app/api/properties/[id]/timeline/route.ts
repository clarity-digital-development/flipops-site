import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/timeline
//
// Returns the one-shot payload that powers /app/properties/[id] — the
// canonical single-property cross-section view. Every join is owner-scoped
// via requireUser() so users can only see their own data, even when the URL
// is shared or guessed.
//
// Shape:
//   {
//     property: Property,
//     contactNotes: ParsedContactNote[],   // parsed from Property.contactNotes JSON
//     offers: Offer[],
//     contracts: Contract[],
//     dealAnalyses: DealAnalysis[],
//     renovations: DealSpec[],             // renovation projects
//     rentals: Rental[],
//   }
//
// Virtual lead ids (`virt-{countyFips}-{apn}`) cannot have any joins because
// they aren't materialized rows yet. We return a 404 with the canonical hint.
// ---------------------------------------------------------------------------

interface ParsedContactNote {
  date: string | null;
  note: string;
  method: string | null;
  sentiment: string | null;
}

function parseContactNotes(raw: string | null | undefined): ParsedContactNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      date: typeof entry?.date === 'string' ? entry.date : null,
      note: typeof entry?.note === 'string' ? entry.note : '',
      method: typeof entry?.method === 'string' ? entry.method : null,
      sentiment: typeof entry?.sentiment === 'string' ? entry.sentiment : null,
    }));
  } catch {
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    if (typeof id === 'string' && id.startsWith('virt-')) {
      return NextResponse.json(
        {
          error: 'Virtual lead — promote it first',
          hint: 'POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.',
          code: 'VIRTUAL_LEAD_NOT_PROMOTED',
        },
        { status: 409 },
      );
    }

    // Owner-scoped property lookup. If this fails, every downstream query is
    // skipped — we never want to leak the existence of a property the caller
    // does not own.
    const property = await prisma.property.findFirst({
      where: { id, userId },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Run independent joins in parallel. Each is owner-scoped against User.id
    // (the internal Prisma id, not the Clerk id) to defend against any future
    // schema drift where Property.userId could diverge from related-row userId.
    const [offers, contracts, dealAnalyses, renovations, rentals] = await Promise.all([
      prisma.offer.findMany({
        where: { propertyId: id, userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.findMany({
        where: { propertyId: id, userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dealAnalysis.findMany({
        where: { propertyId: id, userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dealSpec.findMany({
        where: { propertyId: id, userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rental.findMany({
        where: { propertyId: id, userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const contactNotes = parseContactNotes(property.contactNotes);

    return NextResponse.json({
      property,
      contactNotes,
      offers,
      contracts,
      dealAnalyses,
      renovations,
      rentals,
    });
  } catch (error) {
    console.error('Error fetching property timeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
