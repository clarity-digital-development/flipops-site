import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { calculateDistressScoreFromProperty } from '@/lib/reapi/utils/distress-scorer';

// ---------------------------------------------------------------------------
// POST /api/properties/promote — Option A Phase A5
//
// Promotes a virtual lead (Parcel + TaxDelinquencySummary join) to a real
// tenant-owned Property row for the authenticated user.
//
// Called by the leads UI immediately before the first action a user takes on
// a virtual lead (Skip Trace, Add Note, Send to Dialer, etc.) — the
// engagement is the implicit "I want to work this." The frontend wraps the
// action handler: if lead.virtual, POST here, swap in the returned id, then
// continue with the action.
//
// Body:
//   { countyFips: string, apn: string }
//
// Response:
//   { property: Property }  — the freshly-created (or already-existing) row
//
// Idempotent: if a Property with (userId, countyFips, apn) already exists,
// return it instead of creating a duplicate.
// ---------------------------------------------------------------------------

interface PromoteBody {
  countyFips?: unknown;
  apn?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = dbUser.id;

    // -----------------------------------------------------------------------
    // Validate body
    // -----------------------------------------------------------------------
    let body: PromoteBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const countyFips = typeof body.countyFips === 'string' ? body.countyFips.trim() : '';
    const apn = typeof body.apn === 'string' ? body.apn.trim() : '';
    if (!countyFips || !apn) {
      return NextResponse.json(
        { error: 'Both countyFips and apn are required' },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Idempotency: if the user already has a Property for this APN, return it.
    // -----------------------------------------------------------------------
    const existing = await prisma.property.findFirst({
      where: { userId, countyFips, apn },
    });
    if (existing) {
      return NextResponse.json({ property: existing, created: false });
    }

    // -----------------------------------------------------------------------
    // Look up the virtual lead's source data: Parcel + TaxDelinquencySummary
    // + AuctionSummary (M2.3). A parcel can have both tax-delinquent AND
    // scheduled-auction signals — surface both on promote.
    // -----------------------------------------------------------------------
    const [parcel, summary, auctionSummary] = await Promise.all([
      prisma.parcel.findUnique({
        where: { countyFips_apn: { countyFips, apn } },
      }),
      prisma.taxDelinquencySummary.findUnique({
        where: { countyFips_apn: { countyFips, apn } },
      }),
      prisma.auctionSummary.findUnique({
        where: { countyFips_apn: { countyFips, apn } },
      }),
    ]);

    if (!parcel && !summary && !auctionSummary) {
      // Nothing to promote from — this APN isn't a known virtual lead.
      return NextResponse.json(
        { error: `No virtual lead found for countyFips=${countyFips} apn=${apn}` },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Mint the Property row. Sources:
    //   - Address / property characteristics come from Parcel
    //   - Tax-delinquent fields come from TaxDelinquencySummary
    //   - Foreclosure / auction signals come from AuctionSummary (M2.3)
    //   - Score is computed fresh by calculateDistressScoreFromProperty
    //     so the in-app score and the materialized aggregate stay in sync
    //     post-promote (the aggregate's score may be stale relative to
    //     latest scoring weights).
    // -----------------------------------------------------------------------
    const isTaxDelinquent = !!summary;
    const taxDelinquentAmount = summary?.totalAmount ?? null;
    const taxDelinquentYearsCount = summary?.yearsCount ?? null;
    const taxDelinquentEarliestYear = summary?.earliestYear ?? null;
    const taxDelinquentLatestYear = summary?.latestYear ?? null;

    const hasScheduledAuction = !!auctionSummary?.nextAuctionDate;
    const isForeclosure = !!auctionSummary; // any auction activity = foreclosure family
    const isPreForeclosure = hasScheduledAuction; // scheduled future auction

    // Fresh score from the canonical scorer v2.1 — includes the new
    // FUTURE_AUCTION signal so promoted auction-virtual rows carry their
    // imminent-auction boost into the Property table.
    const distressScore = calculateDistressScoreFromProperty({
      foreclosure: isForeclosure,
      preForeclosure: isPreForeclosure,
      taxDelinquent: isTaxDelinquent,
      vacant: false,
      bankruptcy: false,
      absenteeOwner: false,
      estimatedValue: parcel?.marketValue ?? null,
      assessedValue: parcel?.assessedValue ?? null,
      taxDelinquentAmount,
      taxDelinquentYearsCount,
      taxDelinquentEarliestYear,
      hasScheduledAuction,
      nextAuctionDate: auctionSummary?.nextAuctionDate ?? null,
      hasLisPendens: false,
    });

    const address = parcel?.situsAddress ?? '(address pending)';
    const city = parcel?.situsCity ?? '';
    const state = parcel?.state ?? 'FL';
    const zip = parcel?.situsZip ?? '';

    // Edge case: the Property unique key is (userId, address, city, state, zip)
    // — if the user already has a property at that address from a different
    // source path (e.g. manual entry), we don't want to throw. Use upsert.
    // Parcel from FL DOR roll doesn't carry bedroom/bathroom counts — those
    // come from the per-county property appraiser SDF (separate ingest) or
    // ATTOM/REAPI enrichment. Leave them null on promote; the user can
    // enrich via skip-trace or ATTOM later.
    const lastSaleDateStr = parcel?.lastSaleYear
      ? `${parcel.lastSaleYear}-01-01`
      : null;

    const property = await prisma.property.upsert({
      where: {
        userId_address_city_state_zip: { userId, address, city, state, zip },
      },
      create: {
        userId,
        address,
        city,
        state,
        zip,
        county: null,
        countyFips,
        apn,
        ownerName: parcel?.ownerName ?? null,
        propertyType: parcel?.propertyType ?? null,
        bedrooms: null,
        bathrooms: null,
        squareFeet: parcel?.squareFeet ?? null,
        lotSize: parcel?.lotSize ?? null,
        yearBuilt: parcel?.yearBuilt ?? null,
        assessedValue: parcel?.assessedValue ?? null,
        estimatedValue: parcel?.marketValue ?? null,
        lastSaleDate: lastSaleDateStr,
        lastSalePrice: parcel?.lastSalePrice ?? null,
        latitude: parcel?.latitude ?? null,
        longitude: parcel?.longitude ?? null,
        taxDelinquent: isTaxDelinquent,
        taxDelinquentAmount,
        taxDelinquentYearsCount,
        taxDelinquentEarliestYear,
        taxDelinquentLatestYear,
        foreclosure: isForeclosure,
        preForeclosure: isPreForeclosure,
        score: distressScore.score,
        scoreBreakdown: JSON.stringify({
          score: distressScore.score,
          grade: distressScore.grade,
          motivation: distressScore.motivation,
          signals: distressScore.signals,
        }),
        scoredAt: new Date(),
        dataSource: auctionSummary ? 'parcel-auction-bridge' : 'parcel-lien-bridge',
        sourceId: auctionSummary
          ? `virt-fc-${countyFips}-${apn}`
          : `virt-${countyFips}-${apn}`,
      },
      update: {
        // Merge in the bridge fields if a Property happened to exist at this
        // address from a different source. Preserve user-modified fields like
        // outreachStatus, contactNotes, etc. (Prisma's update only touches
        // the listed fields.)
        countyFips,
        apn,
        taxDelinquent: isTaxDelinquent,
        taxDelinquentAmount,
        taxDelinquentYearsCount,
        taxDelinquentEarliestYear,
        taxDelinquentLatestYear,
        foreclosure: isForeclosure,
        preForeclosure: isPreForeclosure,
        score: distressScore.score,
        scoreBreakdown: JSON.stringify({
          score: distressScore.score,
          grade: distressScore.grade,
          motivation: distressScore.motivation,
          signals: distressScore.signals,
        }),
        scoredAt: new Date(),
      },
    });

    return NextResponse.json({ property, created: true });
  } catch (error) {
    console.error('[/api/properties/promote] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
