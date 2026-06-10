import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const markSeenSchema = z.object({
  eventId: z.string().min(1),
  processedAt: z.string().datetime().optional()
});

// POST /api/events/mark-seen - Mark event as seen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = markSeenSchema.parse(body);

    const processedAt = validated.processedAt || new Date().toISOString();

    // Notification.metadata is a JSON string column — parse, merge, re-serialize.
    const existing = await prisma.notification.findUnique({
      where: { eventId: validated.eventId },
      select: { metadata: true }
    });
    let existingMeta: Record<string, unknown> = {};
    if (existing?.metadata) {
      try {
        existingMeta = JSON.parse(existing.metadata) ?? {};
      } catch {
        existingMeta = {};
      }
    }

    // Upsert notification with minimal data to mark as seen
    const notification = await prisma.notification.upsert({
      where: { eventId: validated.eventId },
      update: {
        processed: true,
        metadata: JSON.stringify({ ...existingMeta, processedAt })
      },
      create: {
        eventId: validated.eventId,
        type: 'seen',
        message: `Event marked as seen at ${processedAt}`,
        processed: true,
        metadata: JSON.stringify({ processedAt })
      }
    });

    console.log(`Marked event as seen: ${notification.eventId}`);

    return NextResponse.json({
      success: true,
      eventId: notification.eventId,
      processed: notification.processed
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error marking event as seen:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}