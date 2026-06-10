import { NextRequest, NextResponse } from 'next/server';
import type { ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-helpers';
import { ContractDocument, ContractData } from '@/lib/pdf-templates';

/**
 * POST /api/documents/generate-contract
 * Generate a contract PDF
 *
 * Body can contain:
 * - contractId: string (to generate from existing contract)
 * - bidId: string (to generate vendor contract from bid)
 * OR
 * - Custom contract data for ad-hoc generation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    const body = await request.json();
    let contractData: ContractData;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    if (body.contractId) {
      // Generate from existing purchase contract
      const contract = await prisma.contract.findFirst({
        where: { id: body.contractId, userId },
        include: {
          property: true,
          offer: true,
          assignment: {
            include: {
              buyer: true,
            },
          },
        },
      });

      if (!contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      // Check if this is an assignment contract
      if (contract.assignment) {
        contractData = {
          contractNumber: `ASN-${contract.id.slice(-8).toUpperCase()}`,
          contractDate: contract.assignment.createdAt.toISOString(),
          contractType: 'assignment',
          party1: {
            name: user?.companyName || user?.name || 'Assignor',
            email: user?.email || undefined,
            role: 'Assignor',
          },
          party2: {
            name: contract.assignment.buyer.name,
            email: contract.assignment.buyer.email || undefined,
            phone: contract.assignment.buyer.phone || undefined,
            role: 'Assignee',
          },
          property: {
            address: contract.property.address,
            city: contract.property.city,
            state: contract.property.state,
            zip: contract.property.zip,
            type: contract.property.propertyType || undefined,
          },
          terms: {
            totalAmount: contract.assignment.assignmentFee,
            closingDate: contract.closingDate?.toISOString(),
          },
          additionalTerms: [
            'Assignor hereby assigns all rights, title, and interest in the original purchase contract to Assignee.',
            'Assignee agrees to fulfill all obligations under the original purchase contract.',
            'Assignment fee is due upon closing of the property.',
          ],
        };
      } else {
        // Regular purchase contract
        contractData = {
          contractNumber: `PUR-${contract.id.slice(-8).toUpperCase()}`,
          contractDate: contract.createdAt.toISOString(),
          contractType: 'purchase',
          party1: {
            name: user?.companyName || user?.name || 'Buyer',
            email: user?.email || undefined,
            role: 'Buyer',
          },
          party2: {
            name: contract.property.ownerName || 'Seller',
            role: 'Seller',
          },
          property: {
            address: contract.property.address,
            city: contract.property.city,
            state: contract.property.state,
            zip: contract.property.zip,
            type: contract.property.propertyType || undefined,
          },
          terms: {
            totalAmount: contract.purchasePrice,
            depositAmount: contract.offer?.earnestMoney || undefined,
            closingDate: contract.closingDate?.toISOString(),
          },
          additionalTerms: [
            'This sale is contingent upon satisfactory inspection within 10 business days.',
            'Seller agrees to provide clear and marketable title at closing.',
            'All utilities shall be transferred to Buyer upon closing.',
          ],
        };
      }
    } else if (body.bidId) {
      // Generate vendor contract from awarded bid
      const bid = await prisma.bid.findUnique({
        where: { id: body.bidId },
        include: {
          vendor: true,
          deal: true,
        },
      });

      if (!bid) {
        return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
      }

      // Parse bid items
      let scopeItems: { description: string; quantity: string; price: number }[] = [];
      try {
        const items = JSON.parse(bid.items);
        scopeItems = items.map((item: any) => ({
          description: `${item.trade} - ${item.task}`,
          quantity: `${item.quantity} ${item.unit}`,
          price: item.totalPrice,
        }));
      } catch {
        scopeItems = [{
          description: 'Services as per bid',
          quantity: '1 job',
          price: bid.subtotal,
        }];
      }

      contractData = {
        contractNumber: `VND-${bid.id.slice(-8).toUpperCase()}`,
        contractDate: new Date().toISOString(),
        contractType: 'vendor',
        party1: {
          name: user?.companyName || user?.name || 'Property Owner',
          email: user?.email || undefined,
          role: 'Property Owner',
        },
        party2: {
          name: bid.vendor?.name || 'Contractor',
          email: bid.vendor?.email || undefined,
          phone: bid.vendor?.phone || undefined,
          role: 'Contractor',
        },
        property: {
          address: bid.deal.address,
          city: '',
          state: bid.deal.region || '',
          zip: '',
        },
        terms: {
          totalAmount: bid.subtotal,
          depositAmount: bid.subtotal * 0.25, // 25% deposit default
          paymentSchedule: '25% deposit, 25% at midpoint, 50% upon completion',
          startDate: body.startDate || new Date().toISOString(),
          endDate: body.endDate,
        },
        scopeItems,
        additionalTerms: [
          'Contractor shall obtain all necessary permits and inspections.',
          'Work shall be performed in a workmanlike manner and in compliance with all applicable codes.',
          'Contractor shall maintain liability insurance throughout the project duration.',
          'Any changes to the scope of work must be documented in a written change order.',
        ],
      };
    } else {
      // Use provided contract data (ad-hoc generation)
      if (!body.party1 || !body.party2 || !body.property || !body.terms) {
        return NextResponse.json(
          { error: 'Missing required fields: party1, party2, property, terms' },
          { status: 400 }
        );
      }

      contractData = {
        contractNumber: body.contractNumber || `CTR-${Date.now().toString(36).toUpperCase()}`,
        contractDate: body.contractDate || new Date().toISOString(),
        contractType: body.contractType || 'vendor',
        party1: body.party1,
        party2: body.party2,
        property: body.property,
        terms: body.terms,
        scopeItems: body.scopeItems,
        additionalTerms: body.additionalTerms,
        notes: body.notes,
      };
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ContractDocument({ data: contractData }) as ReactElement<DocumentProps>
    );

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contract-${contractData.contractNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate contract PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/generate-contract?contractId=xxx
 * Quick way to download a contract PDF
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    const searchParams = request.nextUrl.searchParams;
    const contractId = searchParams.get('contractId');
    const bidId = searchParams.get('bidId');

    if (!contractId && !bidId) {
      return NextResponse.json({ error: 'contractId or bidId is required' }, { status: 400 });
    }

    // Redirect to POST with appropriate body
    const requestBody = contractId ? { contractId } : { bidId };

    // Create a new request with body
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers),
      },
    });

    return POST(postRequest);
  } catch (error) {
    console.error('Error generating contract PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate contract PDF' },
      { status: 500 }
    );
  }
}
