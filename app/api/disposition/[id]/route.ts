// ---------------------------------------------------------------------------
// /api/disposition/[id] — update + delete a single disposition listing.
//
//   PATCH  -> { listing: DispositionListingDTO }
//   DELETE -> { ok: true }
//
// Both 404 when the listing isn't owned by the caller. PATCH auto-stamps
// listedAt / soldAt on the listed/sold transitions and JSON-stringifies an
// incoming prepChecklist array. DTO shape comes from the shared mapper in
// ../route.ts so the wire contract is defined exactly once.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { dispositionInclude, toDispositionDTO } from '../route';

// Fields a client may patch. Anything else in the body is ignored.
const STRING_FIELDS = [
  'status',
  'listAgentName',
  'listAgentBrokerage',
  'listAgentPhone',
  'listAgentEmail',
  'notes',
] as const;

const NUMBER_FIELDS = [
  'listPrice',
  'commissionPct',
  'closingCostPct',
  'payoffAmount',
  'soldPrice',
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Ownership check (404 if not owned).
    const existing = await prisma.dispositionListing.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Disposition listing not found or does not belong to user' },
        { status: 404 },
      );
    }

    // Loosely-typed accumulator: indexing a Prisma*UpdateInput by a union key
    // collapses to the intersection of every field's update type, which rejects
    // `null` for the non-nullable columns. We build a plain record and cast once
    // at the update call instead.
    const data: Record<string, unknown> = {};

    // status / commissionPct / closingCostPct are NON-nullable in the schema;
    // payoffAmount is nullable but the DTO guarantees a number on the wire (0 =
    // no payoff), so never let a PATCH null it either. Never write null to these.
    const NON_NULLABLE = new Set<string>([
      'status',
      'commissionPct',
      'closingCostPct',
      'payoffAmount',
    ]);

    for (const field of STRING_FIELDS) {
      if (body[field] === undefined) continue;
      if (body[field] === null) {
        if (NON_NULLABLE.has(field)) continue;
        data[field] = null; // clear a nullable text field
      } else {
        data[field] = String(body[field]);
      }
    }

    for (const field of NUMBER_FIELDS) {
      if (body[field] === undefined) continue;
      if (body[field] === null) {
        if (NON_NULLABLE.has(field)) continue;
        data[field] = null;
      } else {
        data[field] = Number(body[field]);
      }
    }

    // prepChecklist may arrive as an array (parsed DTO shape) or a string.
    if (body.prepChecklist !== undefined) {
      data.prepChecklist =
        body.prepChecklist === null
          ? null
          : typeof body.prepChecklist === 'string'
            ? body.prepChecklist
            : JSON.stringify(body.prepChecklist);
    }

    // Explicit date overrides (accept ISO string or null).
    let listedAtProvided = false;
    let soldAtProvided = false;
    if (body.listedAt !== undefined) {
      listedAtProvided = true;
      data.listedAt = body.listedAt ? new Date(body.listedAt) : null;
    }
    if (body.soldAt !== undefined) {
      soldAtProvided = true;
      data.soldAt = body.soldAt ? new Date(body.soldAt) : null;
    }

    // Auto-stamp on status transitions when the caller didn't supply the date.
    if (
      body.status === 'listed' &&
      !listedAtProvided &&
      existing.listedAt === null
    ) {
      data.listedAt = new Date();
    }
    if (
      body.status === 'sold' &&
      !soldAtProvided &&
      existing.soldAt === null
    ) {
      data.soldAt = new Date();
    }

    await prisma.dispositionListing.update({
      where: { id },
      data: data as Prisma.DispositionListingUpdateInput,
    });

    // Re-fetch with relations so the shared mapper has everything it needs.
    const withRelations = await prisma.dispositionListing.findUniqueOrThrow({
      where: { id },
      include: dispositionInclude,
    });

    return NextResponse.json({ listing: await toDispositionDTO(withRelations) });
  } catch (error) {
    console.error('Error updating disposition listing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    const existing = await prisma.dispositionListing.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Disposition listing not found or does not belong to user' },
        { status: 404 },
      );
    }

    await prisma.dispositionListing.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting disposition listing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
