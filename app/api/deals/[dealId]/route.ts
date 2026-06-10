import { NextRequest, NextResponse } from 'next/server';

// Mocked deal enrichment - TODO: Wire to real database
function getMockedDealData(dealId: string) {
  // Generate deterministic values based on dealId hash
  const hash = dealId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseValue = 100000 + (hash * 1000);

  return {
    address: `${hash % 999} Main Street, Miami FL`,
    stage: ['discovery', 'analysis', 'negotiation', 'closing'][hash % 4],
    investorId: `inv_${(hash % 10).toString().padStart(3, '0')}`,
    p50: Math.round(baseValue * 0.85),
    p80: Math.round(baseValue * 1.0),
    p95: Math.round(baseValue * 1.15),
    url: `https://flipops.com/deals/${dealId}`
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;

    if (!dealId) {
      return NextResponse.json(
        { error: 'Deal ID is required' },
        { status: 400 }
      );
    }

    // TODO: Replace with real database query
    // const deal = await prisma.dealSpec.findUnique({
    //   where: { id: dealId }
    // });

    // For now, return mocked enrichment data
    const dealData = getMockedDealData(dealId);

    return NextResponse.json(dealData);

  } catch (error) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}