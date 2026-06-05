import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/rentals/[id]/tenant
 * Add a tenant to a rental property
 * Body: {
 *   name: string,
 *   email?: string,
 *   phone?: string,
 *   emergencyContact?: object,
 *   leaseStart: string,
 *   leaseEnd: string,
 *   monthlyRent: number,
 *   deposit?: number,
 *   moveInDate?: string,
 *   paymentMethod?: string,
 *   autoPay?: boolean
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.leaseStart || !body.leaseEnd || body.monthlyRent === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, leaseStart, leaseEnd, monthlyRent' },
        { status: 400 }
      );
    }

    // Verify rental belongs to user
    const rental = await prisma.rental.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!rental) {
      return NextResponse.json(
        { error: 'Rental not found or does not belong to user' },
        { status: 404 }
      );
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        rentalId: id,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        emergencyContact: body.emergencyContact ? JSON.stringify(body.emergencyContact) : null,
        leaseStart: new Date(body.leaseStart),
        leaseEnd: new Date(body.leaseEnd),
        monthlyRent: body.monthlyRent,
        deposit: body.deposit || null,
        status: 'active',
        moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
        paymentMethod: body.paymentMethod || null,
        autoPay: body.autoPay || false,
      },
    });

    // Update rental status to leased and update lease dates
    await prisma.rental.update({
      where: { id },
      data: {
        status: 'leased',
        leaseStart: new Date(body.leaseStart),
        leaseEnd: new Date(body.leaseEnd),
        monthlyRent: body.monthlyRent,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: {
        ...tenant,
        emergencyContact: tenant.emergencyContact ? JSON.parse(tenant.emergencyContact) : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
