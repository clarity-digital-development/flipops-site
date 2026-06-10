import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Check if event has been seen (exists in Notification table)
    const notification = await prisma.notification.findUnique({
      where: { eventId },
      select: { id: true }
    });

    return NextResponse.json({
      seen: notification !== null
    });

  } catch (error) {
    console.error('Error checking event:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}