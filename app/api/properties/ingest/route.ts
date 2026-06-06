import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { skipTraceProperty, isBatchDataConfigured } from '@/lib/batchdata';

const log = logger.child({ endpoint: '/api/properties/ingest' });

// API key for service-level access (scripts, cron jobs)
const SERVICE_API_KEY = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

/**
 * Validate service API key from header
 */
function validateServiceKey(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  // Support both "Bearer <key>" and just "<key>"
  const key = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return key === SERVICE_API_KEY;
}

/**
 * Property ingest schema - accepts data from BatchData, REAPI, or manual sources
 */
const PropertyIngestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  source: z.enum(['batchdata', 'manual', 'google_sheets']),
  properties: z.array(z.object({
    // Required fields
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),

    // Optional property details
    county: z.string().nullable().optional(),
    apn: z.string().nullable().optional(),
    ownerName: z.string().nullable().optional(),
    propertyType: z.string().nullable().optional(),
    bedrooms: z.number().int().nullable().optional(),
    bathrooms: z.number().nullable().optional(),
    squareFeet: z.number().int().nullable().optional(),
    lotSize: z.number().int().nullable().optional(),
    yearBuilt: z.number().int().nullable().optional(),

    // Financial
    assessedValue: z.number().nullable().optional(),
    taxAmount: z.number().nullable().optional(),
    lastSaleDate: z.string().nullable().optional(),
    lastSalePrice: z.number().nullable().optional(),
    estimatedValue: z.number().nullable().optional(),

    // Listing/Market info
    listingDate: z.string().nullable().optional(),  // ISO date string
    daysOnMarket: z.number().int().nullable().optional(),

    // Distress flags
    foreclosure: z.boolean().default(false),
    preForeclosure: z.boolean().default(false),
    taxDelinquent: z.boolean().default(false),
    vacant: z.boolean().default(false),
    bankruptcy: z.boolean().default(false),
    absenteeOwner: z.boolean().default(false),

    // Source tracking
    sourceId: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.any()).optional(),  // FIX: Explicitly specify key type for Zod v4 compatibility
  }))
});

/**
 * POST /api/properties/ingest
 *
 * Bulk property ingest endpoint - accepts properties from any source
 * and stores them with proper user isolation.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const reqLog = log.child({ requestId });

  try {
    // Validate service API key for automated ingestion
    if (!validateServiceKey(req)) {
      reqLog.warn('Invalid or missing API key');
      return NextResponse.json(
        { error: 'Unauthorized - valid API key required', requestId },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = PropertyIngestSchema.safeParse(body);

    if (!validationResult.success) {
      reqLog.warn({ errors: validationResult.error.issues }, 'Validation failed');
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
          requestId
        },
        { status: 400 }
      );
    }

    const { userId, source, properties } = validationResult.data;
    reqLog.info({ userId, source, count: properties.length }, 'Ingesting properties');

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, minScore: true }
    });

    if (!user) {
      reqLog.warn({ userId }, 'User not found');
      return NextResponse.json(
        {
          error: 'User not found',
          userId,
          requestId
        },
        { status: 404 }
      );
    }

    // Process properties in batches
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      enriched: 0,
      errors: [] as string[]
    };

    const skipTraceEnabled = isBatchDataConfigured();

    for (const property of properties) {
      try {
        // Check if property already exists for this user
        const existing = await prisma.property.findUnique({
          where: {
            userId_address_city_state_zip: {
              userId,
              address: property.address,
              city: property.city,
              state: property.state,
              zip: property.zip
            }
          }
        });

        if (existing) {
          // Update existing property with new data
          await prisma.property.update({
            where: { id: existing.id },
            data: {
              // Update property details
              county: property.county ?? existing.county,
              apn: property.apn ?? existing.apn,
              ownerName: property.ownerName ?? existing.ownerName,
              propertyType: property.propertyType ?? existing.propertyType,
              bedrooms: property.bedrooms ?? existing.bedrooms,
              bathrooms: property.bathrooms ?? existing.bathrooms,
              squareFeet: property.squareFeet ?? existing.squareFeet,
              lotSize: property.lotSize ?? existing.lotSize,
              yearBuilt: property.yearBuilt ?? existing.yearBuilt,

              // Update financial
              assessedValue: property.assessedValue ?? existing.assessedValue,
              taxAmount: property.taxAmount ?? existing.taxAmount,
              lastSaleDate: property.lastSaleDate ?? existing.lastSaleDate,
              lastSalePrice: property.lastSalePrice ?? existing.lastSalePrice,
              estimatedValue: property.estimatedValue ?? existing.estimatedValue,

              // Update distress flags
              foreclosure: property.foreclosure,
              preForeclosure: property.preForeclosure,
              taxDelinquent: property.taxDelinquent,
              vacant: property.vacant,
              bankruptcy: property.bankruptcy,
              absenteeOwner: property.absenteeOwner,

              // Update metadata
              dataSource: source,
              sourceId: property.sourceId ?? existing.sourceId,
              metadata: property.metadata ? JSON.stringify(property.metadata) : existing.metadata,
              updatedAt: new Date()
            }
          });

          results.updated++;
        } else {
          // Skip trace the property before creating (if BatchData is configured)
          let skipTraceData: {
            ownerName?: string | null;
            phoneNumbers?: string;
            emails?: string;
            enriched: boolean;
          } = { enriched: false };

          if (isBatchDataConfigured()) {
            try {
              const skipResult = await skipTraceProperty({
                address: property.address,
                city: property.city,
                state: property.state,
                zip: property.zip,
              });

              if (skipResult.success) {
                skipTraceData = {
                  ownerName: skipResult.ownerName || property.ownerName,
                  phoneNumbers: skipResult.phoneNumbers?.length ? JSON.stringify(skipResult.phoneNumbers) : undefined,
                  emails: skipResult.emails?.length ? JSON.stringify(skipResult.emails) : undefined,
                  enriched: true,
                };
                results.enriched++;
                reqLog.info({ address: property.address }, 'Skip traced successfully');
              }
            } catch (skipError) {
              reqLog.warn({ skipError, address: property.address }, 'Skip trace failed, continuing without enrichment');
            }
          }

          // Create new property with skip trace data
          await prisma.property.create({
            data: {
              userId,
              address: property.address,
              city: property.city,
              state: property.state,
              zip: property.zip,

              county: property.county,
              apn: property.apn,
              ownerName: skipTraceData.ownerName || property.ownerName,
              propertyType: property.propertyType,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              squareFeet: property.squareFeet,
              lotSize: property.lotSize,
              yearBuilt: property.yearBuilt,

              assessedValue: property.assessedValue,
              taxAmount: property.taxAmount,
              lastSaleDate: property.lastSaleDate,
              lastSalePrice: property.lastSalePrice,
              estimatedValue: property.estimatedValue,

              listingDate: property.listingDate ? new Date(property.listingDate) : null,
              daysOnMarket: property.daysOnMarket,

              foreclosure: property.foreclosure,
              preForeclosure: property.preForeclosure,
              taxDelinquent: property.taxDelinquent,
              vacant: property.vacant,
              bankruptcy: property.bankruptcy,
              absenteeOwner: property.absenteeOwner,

              dataSource: source,
              sourceId: property.sourceId,
              metadata: property.metadata ? JSON.stringify(property.metadata) : null,
              enriched: skipTraceData.enriched,
              phoneNumbers: skipTraceData.phoneNumbers,
              emails: skipTraceData.emails,
            }
          });

          results.created++;
        }
      } catch (propertyError) {
        reqLog.error({ propertyError, property }, 'Failed to process property');
        results.errors.push(`${property.address}: ${propertyError instanceof Error ? propertyError.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    const duration = Date.now() - startTime;

    reqLog.info({
      userId,
      source,
      results,
      duration
    }, 'Properties ingested');

    return NextResponse.json({
      success: true,
      userId,
      source,
      results,
      skipTraceEnabled,
      duration,
      nextSteps: {
        scoring: results.created > 0 ? `Trigger scoring for ${results.created} new properties` : 'No new properties to score',
        notification: results.created > 0 ? `Consider sending digest to user` : null,
        skipTrace: skipTraceEnabled
          ? `${results.enriched} of ${results.created} properties enriched with contact info`
          : 'Configure BATCHDATA_API_KEY to enable automatic skip tracing'
      },
      requestId
    }, { status: 200 });

  } catch (error) {
    reqLog.error({ error }, 'Failed to ingest properties');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
          requestId
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId
      },
      { status: 500 }
    );
  }
  // NOTE: Do not call prisma.$disconnect() - uses shared singleton
}
