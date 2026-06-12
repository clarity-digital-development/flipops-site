// ---------------------------------------------------------------------------
// GET /api/disposition/candidates -> { candidates: CandidateDTO[] }
//
// Completed renovations (DealSpec status='completed') that have a property and
// do NOT yet have a DispositionListing for that (userId, propertyId). These are
// the "ready to list" candidates surfaced in the disposition pipeline.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

interface AvmBlock {
  estimatedValue: number;
  lowEstimate: number | null;
  highEstimate: number | null;
}

interface CandidateDTO {
  dealSpecId: string;
  propertyId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  completedAt: string | null; // ISO string on the wire (Date is JSON-serialized)
  renovationArv: number | null;
  avm: AvmBlock | null;
  contractId: string | null;
  purchasePrice: number | null;
}

export async function GET() {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    // Completed renovations with a property attached.
    const dealSpecs = await prisma.dealSpec.findMany({
      where: {
        userId,
        status: 'completed',
        propertyId: { not: null },
      },
      include: {
        property: true,
        contract: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    // Exclude any whose (userId, propertyId) already has a DispositionListing.
    const propertyIds = Array.from(
      new Set(
        dealSpecs
          .map((d) => d.propertyId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const existingListings = propertyIds.length
      ? await prisma.dispositionListing.findMany({
          where: { userId, propertyId: { in: propertyIds } },
          select: { propertyId: true },
        })
      : [];
    const listedPropertyIds = new Set(existingListings.map((l) => l.propertyId));

    const candidates: CandidateDTO[] = [];
    for (const ds of dealSpecs) {
      // propertyId is guaranteed non-null by the query filter, but narrow for TS.
      if (!ds.propertyId || !ds.property) continue;
      if (listedPropertyIds.has(ds.propertyId)) continue;

      const property = ds.property;
      const avm =
        property.countyFips && property.apn
          ? await prisma.parcelValuation.findUnique({
              where: {
                countyFips_apn: {
                  countyFips: property.countyFips,
                  apn: property.apn,
                },
              },
            })
          : null;

      candidates.push({
        dealSpecId: ds.id,
        propertyId: ds.propertyId,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        completedAt: ds.completedAt ? ds.completedAt.toISOString() : null,
        renovationArv: ds.arv ?? null,
        avm: avm
          ? {
              estimatedValue: avm.estimatedValue,
              lowEstimate: avm.lowEstimate,
              highEstimate: avm.highEstimate,
            }
          : null,
        contractId: ds.contract?.id ?? null,
        purchasePrice: ds.contract?.purchasePrice ?? null,
      });
    }

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error listing disposition candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
