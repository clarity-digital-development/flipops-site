// ---------------------------------------------------------------------------
// /api/disposition — list + create disposition listings.
//
//   GET  /api/disposition  -> { listings: DispositionListingDTO[] }  (newest first)
//   POST /api/disposition  -> { listing: DispositionListingDTO, created: boolean }
//
// Also the home of the shared DTO mapper `toDispositionDTO`, imported by the
// [id] route so the DispositionListingDTO shape is defined exactly once. The
// mapper does the AVM lookup, parses prepChecklist (falling back to the default
// checklist), and surfaces purchasePrice from the linked contract.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import {
  DEFAULT_PREP_CHECKLIST,
  type PrepChecklistItem,
} from '@/lib/disposition/net-sheet';

// --- Shared include shape --------------------------------------------------
// Every place that maps a listing to a DTO must pull these relations so the
// mapper has property (for AVM key + DTO block) and contract (for purchasePrice
// + payoff default). dealSpec is included for arvAtList fallback / DTO id.
export const dispositionInclude = {
  property: true,
  contract: true,
  dealSpec: true,
} satisfies Prisma.DispositionListingInclude;

export type ListingWithRelations = Prisma.DispositionListingGetPayload<{
  include: typeof dispositionInclude;
}>;

// --- DTO shapes ------------------------------------------------------------
export interface AvmBlock {
  estimatedValue: number;
  lowEstimate: number | null;
  highEstimate: number | null;
}

export interface DispositionListingDTO {
  id: string;
  propertyId: string;
  status: string;
  property: {
    id: string;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    yearBuilt: number | null;
    countyFips: string | null;
    apn: string | null;
  };
  listAgentName: string | null;
  listAgentBrokerage: string | null;
  listAgentPhone: string | null;
  listAgentEmail: string | null;
  listPrice: number | null;
  listedAt: Date | null;
  arvAtList: number | null;
  avm: AvmBlock | null;
  commissionPct: number;
  closingCostPct: number;
  payoffAmount: number; // always a number on the wire (mapper coalesces null -> 0)
  soldPrice: number | null;
  soldAt: Date | null;
  prepChecklist: PrepChecklistItem[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contractId: string | null;
  dealSpecId: string | null;
  purchasePrice: number | null;
}

// --- AVM lookup helper -----------------------------------------------------
async function lookupAvm(
  countyFips: string | null | undefined,
  apn: string | null | undefined,
): Promise<AvmBlock | null> {
  if (!countyFips || !apn) return null;
  const valuation = await prisma.parcelValuation.findUnique({
    where: { countyFips_apn: { countyFips, apn } },
  });
  if (!valuation) return null;
  return {
    estimatedValue: valuation.estimatedValue,
    lowEstimate: valuation.lowEstimate,
    highEstimate: valuation.highEstimate,
  };
}

// --- prepChecklist parsing -------------------------------------------------
// Persisted as a JSON string. Falls back to DEFAULT_PREP_CHECKLIST (all
// done:false) when null/blank/unparseable so the UI always has 6 items.
function parsePrepChecklist(raw: string | null | undefined): PrepChecklistItem[] {
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => ({
          key: String(item?.key ?? ''),
          label: String(item?.label ?? ''),
          done: Boolean(item?.done),
        }));
      }
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_PREP_CHECKLIST.map((i) => ({ ...i, done: false }));
}

// --- Shared DTO mapper -----------------------------------------------------
/**
 * Map a DispositionListing (with property + contract + dealSpec included) into
 * the wire DTO the UI consumes. Performs the AVM lookup by (countyFips, apn).
 */
export async function toDispositionDTO(
  listing: ListingWithRelations,
): Promise<DispositionListingDTO> {
  const { property, contract } = listing;
  const avm = await lookupAvm(property.countyFips, property.apn);

  return {
    id: listing.id,
    propertyId: listing.propertyId,
    status: listing.status,
    property: {
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
      yearBuilt: property.yearBuilt,
      countyFips: property.countyFips,
      apn: property.apn,
    },
    listAgentName: listing.listAgentName,
    listAgentBrokerage: listing.listAgentBrokerage,
    listAgentPhone: listing.listAgentPhone,
    listAgentEmail: listing.listAgentEmail,
    listPrice: listing.listPrice,
    listedAt: listing.listedAt,
    arvAtList: listing.arvAtList,
    avm,
    commissionPct: listing.commissionPct,
    closingCostPct: listing.closingCostPct,
    payoffAmount: listing.payoffAmount ?? 0,
    soldPrice: listing.soldPrice,
    soldAt: listing.soldAt,
    prepChecklist: parsePrepChecklist(listing.prepChecklist),
    notes: listing.notes,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    contractId: listing.contractId,
    dealSpecId: listing.dealSpecId,
    purchasePrice: contract ? contract.purchasePrice : null,
  };
}

// --- GET /api/disposition --------------------------------------------------
export async function GET() {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const listings = await prisma.dispositionListing.findMany({
      where: { userId },
      include: dispositionInclude,
      orderBy: { createdAt: 'desc' },
    });

    const dtos = await Promise.all(listings.map((l) => toDispositionDTO(l)));
    return NextResponse.json({ listings: dtos });
  } catch (error) {
    console.error('Error listing disposition listings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- POST /api/disposition -------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await req.json().catch(() => ({}));
    const dealSpecId: string | undefined = body?.dealSpecId ?? undefined;
    const contractId: string | undefined = body?.contractId ?? undefined;
    let propertyId: string | undefined = body?.propertyId ?? undefined;

    // Resolve the supporting records (user-scoped) so we can derive propertyId,
    // snapshot AVM/ARV, and default payoff.
    const dealSpec = dealSpecId
      ? await prisma.dealSpec.findFirst({ where: { id: dealSpecId, userId } })
      : null;
    const contract = contractId
      ? await prisma.contract.findFirst({ where: { id: contractId, userId } })
      : null;

    // Resolve propertyId: explicit > dealSpec.propertyId > contract.propertyId.
    if (!propertyId) {
      propertyId = dealSpec?.propertyId ?? contract?.propertyId ?? undefined;
    }
    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId could not be resolved from body, dealSpec, or contract' },
        { status: 400 },
      );
    }

    // Idempotent on (userId, propertyId): return the existing listing if present.
    const existing = await prisma.dispositionListing.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
      include: dispositionInclude,
    });
    if (existing) {
      return NextResponse.json({
        listing: await toDispositionDTO(existing),
        created: false,
      });
    }

    // Verify the property belongs to this user before linking.
    const property = await prisma.property.findFirst({
      where: { id: propertyId, userId },
    });
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found or does not belong to user' },
        { status: 400 },
      );
    }

    // AVM snapshot for arvAtList: AVM estimate > dealSpec.arv > null.
    const avm = await lookupAvm(property.countyFips, property.apn);
    const arvAtList = avm?.estimatedValue ?? dealSpec?.arv ?? null;

    // Seed the prep checklist (all unchecked).
    const prepChecklist = JSON.stringify(
      DEFAULT_PREP_CHECKLIST.map((i) => ({ ...i, done: false })),
    );

    const created = await prisma.dispositionListing.create({
      data: {
        userId,
        propertyId,
        contractId: contract?.id ?? null,
        dealSpecId: dealSpec?.id ?? null,
        status: 'prepping',
        arvAtList,
        payoffAmount: contract?.purchasePrice ?? 0,
        prepChecklist,
      },
      include: dispositionInclude,
    });

    return NextResponse.json({
      listing: await toDispositionDTO(created),
      created: true,
    });
  } catch (error) {
    console.error('Error creating disposition listing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
