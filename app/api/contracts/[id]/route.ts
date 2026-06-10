import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { emitLeadEvent, buildPropertySnapshot } from '@/lib/events/emit';

// GET /api/contracts/[id]
// Get contract details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    // Get the contract
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        property: true,
        offer: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Verify ownership
    if (contract.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to access this contract' }, { status: 403 });
    }

    return NextResponse.json({
      contract: {
        id: contract.id,
        propertyId: contract.propertyId,
        offerId: contract.offerId,
        purchasePrice: contract.purchasePrice,
        status: contract.status,
        closingDate: contract.closingDate,
        signedAt: contract.signedAt,
        escrowOpenedAt: contract.escrowOpenedAt,
        closedAt: contract.closedAt,
        notes: contract.notes,
        documentUrls: contract.documentUrls ? JSON.parse(contract.documentUrls) : [],
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        property: contract.property,
        offer: contract.offer,
      },
    });
  } catch (error) {
    console.error('Error fetching contract:', error);
    return NextResponse.json({ error: 'Failed to fetch contract' }, { status: 500 });
  }
}

// PATCH /api/contracts/[id]
// Update contract status and details
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;
    const body = await request.json();
    const { status, closingDate, signedAt, escrowOpenedAt, closedAt, notes, documentUrls } = body;

    // Get the contract (property included for the 'closed' outcome snapshot)
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Verify ownership
    if (contract.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to update this contract' }, { status: 403 });
    }

    // Validate status if provided
    const validStatuses = ['pending', 'signed', 'escrow', 'closed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (status !== undefined) updateData.status = status;
    if (closingDate !== undefined) updateData.closingDate = closingDate ? new Date(closingDate) : null;
    if (signedAt !== undefined) updateData.signedAt = signedAt ? new Date(signedAt) : null;
    if (escrowOpenedAt !== undefined) updateData.escrowOpenedAt = escrowOpenedAt ? new Date(escrowOpenedAt) : null;
    if (closedAt !== undefined) updateData.closedAt = closedAt ? new Date(closedAt) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (documentUrls !== undefined) updateData.documentUrls = JSON.stringify(documentUrls);

    // Update the contract; when the status transitions to 'closed', emit the
    // 'closed' behavioral outcome label in the SAME transaction (M1.1) —
    // outcome labels are server-side, never client best-effort.
    const becameClosed = status === 'closed' && contract.status !== 'closed';
    const updatedContract = await prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: updateData,
        include: {
          property: true,
          offer: true,
        },
      });

      if (becameClosed) {
        await emitLeadEvent(tx, {
          userId,
          propertyId: contract.propertyId,
          eventType: 'closed',
          leadSnapshot: buildPropertySnapshot(contract.property),
          metadata: {
            contractId: contract.id,
            purchasePrice: contract.purchasePrice,
            source: 'api/contracts/[id]#PATCH',
          },
        });
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      contract: {
        id: updatedContract.id,
        propertyId: updatedContract.propertyId,
        offerId: updatedContract.offerId,
        purchasePrice: updatedContract.purchasePrice,
        status: updatedContract.status,
        closingDate: updatedContract.closingDate,
        signedAt: updatedContract.signedAt,
        escrowOpenedAt: updatedContract.escrowOpenedAt,
        closedAt: updatedContract.closedAt,
        notes: updatedContract.notes,
        documentUrls: updatedContract.documentUrls ? JSON.parse(updatedContract.documentUrls) : [],
        createdAt: updatedContract.createdAt,
        updatedAt: updatedContract.updatedAt,
        property: updatedContract.property,
        offer: updatedContract.offer,
      },
    });
  } catch (error) {
    console.error('Error updating contract:', error);
    return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
  }
}

// DELETE /api/contracts/[id]
// Cancel/delete a contract
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const { id } = await params;

    // Get the contract
    const contract = await prisma.contract.findUnique({
      where: { id },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Verify ownership
    if (contract.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this contract' }, { status: 403 });
    }

    // Instead of hard delete, mark as cancelled
    await prisma.contract.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({
      success: true,
      message: 'Contract cancelled successfully',
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return NextResponse.json({ error: 'Failed to delete contract' }, { status: 500 });
  }
}
