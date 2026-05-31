import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// NOTE: Use shared prisma singleton, never create new PrismaClient instances

// Schema for skip trace update
const SkipTraceUpdateSchema = z.object({
  phoneNumbers: z.array(z.string()).optional(),
  emails: z.array(z.string()).optional(),
  metadata: z.any().optional(), // Additional data from skip trace provider (allow any structure)
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // API key authentication (required)
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedApiKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

    // SECURITY: Check BOTH that expectedKey exists AND matches
    if (!expectedApiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (id.startsWith('virt-')) {
      return NextResponse.json(
        {
          error: 'Virtual lead — promote it first',
          hint: 'POST /api/properties/promote with { countyFips, apn } to materialize a Property row, then retry against the returned id.',
          code: 'VIRTUAL_LEAD_NOT_PROMOTED',
        },
        { status: 409 },
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const skipTraceData = SkipTraceUpdateSchema.parse(body);

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      enriched: true,
      updatedAt: new Date(),
    };

    if (skipTraceData.phoneNumbers && skipTraceData.phoneNumbers.length > 0) {
      updateData.phoneNumbers = JSON.stringify(skipTraceData.phoneNumbers);
    }

    if (skipTraceData.emails && skipTraceData.emails.length > 0) {
      updateData.emails = JSON.stringify(skipTraceData.emails);
    }

    if (skipTraceData.metadata) {
      // Merge new metadata with existing
      const existingMetadata = property.metadata ? JSON.parse(property.metadata) : {};
      updateData.metadata = JSON.stringify({
        ...existingMetadata,
        skipTrace: {
          ...skipTraceData.metadata,
          enrichedAt: new Date().toISOString(),
        },
      });
    }

    // Update the property with skip trace data
    const updated = await prisma.property.update({
      where: { id },
      data: updateData,
    });

    const phoneCount = skipTraceData.phoneNumbers?.length || 0;
    const emailCount = skipTraceData.emails?.length || 0;

    console.log(`[POST /api/properties/${id}/skip-trace] Enriched property: ${updated.address} (${phoneCount} phones, ${emailCount} emails)`);

    return NextResponse.json({
      success: true,
      message: 'Property enriched successfully',
      data: {
        id: updated.id,
        address: updated.address,
        phoneNumbers: skipTraceData.phoneNumbers,
        emails: skipTraceData.emails,
        enriched: updated.enriched,
      },
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('[POST /api/properties/:id/skip-trace Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
  // NOTE: Do not call prisma.$disconnect() - uses shared singleton
}
