import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Schema for notification data
const NotificationSchema = z.object({
  type: z.enum(['success', 'error', 'warning', 'info', 'webhook_success', 'webhook_error', 'batch_complete', 'g1.denied', 'g2.denied', 'g3.denied', 'g4.denied', 'property.alert']).optional().default('info'),
  source: z.string().optional().default('internal'),
  workflow: z.string().optional(),
  message: z.string().optional(),
  dealId: z.string().optional(),
  data: z.any().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  stats: z.object({
    total: z.number().optional(),
    success: z.number().optional(),
    failed: z.number().optional(),
    skipped: z.number().optional(),
    duration: z.number().optional(),
  }).optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // API key authentication
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const parsed = NotificationSchema.parse({
      ...body,
      timestamp: body.timestamp || new Date().toISOString(),
    });

    // Generate unique eventId
    const eventId = crypto.randomUUID();

    // Combine metadata with stats and data
    const metadata = JSON.stringify({
      source: parsed.source,
      stats: parsed.stats,
      data: parsed.data,
      ...parsed.metadata,
    });

    // Store in database
    const notification = await prisma.notification.create({
      data: {
        eventId,
        type: parsed.type || 'info',
        dealId: parsed.dealId || null,
        message: parsed.message || `${parsed.type} notification from ${parsed.source}`,
        metadata,
        occurredAt: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
        processed: false,
      },
    });

    // Log to console for debugging
    console.log('[Notification]', {
      id: notification.id,
      type: parsed.type,
      source: parsed.source,
      workflow: parsed.workflow,
      message: parsed.message,
    });

    return NextResponse.json({
      success: true,
      message: 'Notification stored',
      id: notification.id,
      eventId: notification.eventId,
      timestamp: notification.occurredAt.toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('[Notification Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to retrieve recent notifications
// API-key-only. The Notification model has no userId field, so allowing
// Clerk session auth here would expose all users' notifications (IDOR).
// The Dashboard widget will show empty until a userId column + migration
// ships in a follow-up phase.
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const dealId = searchParams.get('dealId');
    const processed = searchParams.get('processed');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Build query
    const where: any = {};
    if (type) where.type = type;
    if (dealId) where.dealId = dealId;
    if (processed !== null) where.processed = processed === 'true';

    // Query database
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    // Format response
    const formatted = notifications.map(n => ({
      id: n.id,
      eventId: n.eventId,
      type: n.type,
      dealId: n.dealId,
      message: n.message,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      occurredAt: n.occurredAt.toISOString(),
      processed: n.processed,
    }));

    return NextResponse.json({
      success: true,
      count: formatted.length,
      total,
      notifications: formatted,
    }, { status: 200 });

  } catch (error) {
    console.error('[Notification GET Error]', error);

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// PATCH endpoint to mark notifications as processed
export async function PATCH(req: NextRequest) {
  try {
    // API key authentication
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ids, processed } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        error: 'ids array is required',
      }, { status: 400 });
    }

    const updated = await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { processed: processed !== false },
    });

    return NextResponse.json({
      success: true,
      updated: updated.count,
    }, { status: 200 });

  } catch (error) {
    console.error('[Notification PATCH Error]', error);

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
