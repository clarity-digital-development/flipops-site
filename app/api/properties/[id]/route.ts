import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * Helper to get the database user ID from the canonical requireUser() guard.
 * Returns null on any auth failure — handlers below map that to 401, which
 * matches this route's historical behavior.
 */
async function getDbUserId(): Promise<string | null> {
  const guard = await requireUser();
  if ('error' in guard) return null;
  return guard.userId;
}

/**
 * Option A guardrail — virtual leads (Parcel+TaxDelinquencySummary join)
 * carry synthetic `virt-{countyFips}-{apn}` ids. They must be promoted to a
 * real Property row before any mutation. Returns true if the id is virtual.
 */
function isVirtualLeadId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('virt-');
}

function virtualLeadError() {
  return NextResponse.json(
    {
      error: 'Virtual lead — promote it first',
      hint: 'POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.',
      code: 'VIRTUAL_LEAD_NOT_PROMOTED',
    },
    { status: 409 },
  );
}

/**
 * GET /api/properties/[id]
 * Get a single property by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: {
        id,
        userId, // Ensure user can only access their own properties
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    return NextResponse.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/properties/[id]
 * Update a property's outreach tracking fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (isVirtualLeadId(id)) return virtualLeadError();

    const body = await request.json();

    // Verify the property belongs to the user
    const existing = await prisma.property.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Allowed fields for update (outreach tracking only)
    const allowedFields = [
      'outreachStatus',
      'lastContactDate',
      'lastContactMethod',
      'ownerResponse',
      'nextFollowUpDate',
      'sentiment',
      'offerAmount',
      'offerDate',
      'offerStatus',
    ];

    // Filter body to only include allowed fields
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update the property
    const updated = await prisma.property.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/properties/[id]
 * Delete a property
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getDbUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (isVirtualLeadId(id)) return virtualLeadError();

    // Verify the property belongs to the user
    const existing = await prisma.property.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    await prisma.property.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
