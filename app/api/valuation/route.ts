import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { resolveCountyFromZip } from '@/lib/data-sources/zip-to-county';
import { FL_COUNTIES } from '@/lib/data-sources/bulk/fl-counties';
import { computeZipLiquidity } from '@/lib/valuation/zip-liquidity';

/**
 * GET /api/valuation — the AVM v1 model prior for a single parcel, plus the
 * parcel's ZIP liquidity grade + data-driven holding-period default.
 *
 * The Underwriting page already computes a COMPS-based ARV from /api/comps.
 * This route surfaces the INDEPENDENT model anchor (ParcelValuation, written by
 * scripts/ml/avm/apply-avm.ts) so the page can (a) show the AVM v1 estimate
 * with its honest low/high band + model provenance, and (b) flag when the
 * comps-based ARV diverges materially from the model.
 *
 * SCORING-ARCHITECTURE invariant #1: every estimate carries its ModelVersion.
 * We resolve the ModelVersion that produced the stored row and return its key +
 * version so the UI labels the prior ("AVM v1") honestly.
 *
 * Honest absence: a parcel with no ParcelValuation row (land / 0-sqft / outside
 * the scored metros) returns `valuation: null` — the UI shows NO prior rather
 * than a fabricated one.
 *
 * Query params:
 *   - countyFips: 5-digit FL county FIPS ("12086"). Strongest locator.
 *   - county:     FL county name — resolved via the FL crosswalk.
 *   - zip:        subject ZIP — county fallback + ZIP-liquidity lookup.
 *   - apn (required with a resolved county): the parcel key into ParcelValuation.
 */

const QuerySchema = z.object({
  countyFips: z.string().regex(/^12\d{3}$/, 'must be a 5-digit FL county FIPS').optional(),
  county: z.string().min(2).optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'must be a 5- or 9-digit ZIP').optional(),
  apn: z.string().min(1).max(40).optional(),
  state: z.string().length(2).optional(),
});

function resolveCountyFips(q: { countyFips?: string; county?: string; zip?: string }): string | null {
  if (q.countyFips) return q.countyFips;
  if (q.county) {
    const norm = q.county.trim().toLowerCase().replace(/\s+county$/, '').replace(/[^a-z]/g, '');
    const hit = FL_COUNTIES.find((c) => c.name.toLowerCase().replace(/[^a-z]/g, '') === norm);
    if (hit) return hit.fips;
  }
  if (q.zip) {
    const ref = resolveCountyFromZip(q.zip);
    if (ref) return ref.fips;
  }
  return null;
}

interface ValuationRow {
  estimatedValue: number;
  lowEstimate: number | null;
  highEstimate: number | null;
  modelVersionId: string;
  computedAt: Date;
  situsZip: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;

    const raw: Record<string, string> = {};
    for (const key of ['countyFips', 'county', 'zip', 'apn', 'state'] as const) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null && value.trim() !== '') raw[key] = value.trim();
    }
    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const q = parsed.data;

    // ParcelValuation coverage is FL-only (scored metros). Non-FL → empty.
    if (q.state && q.state.toUpperCase() !== 'FL') {
      return NextResponse.json({ valuation: null, liquidity: null, coverage: 'FL_ONLY' });
    }

    const countyFips = resolveCountyFips(q);
    const zip5 = (q.zip ?? '').slice(0, 5) || null;

    // ---- AVM prior (ParcelValuation) — requires a county + apn key ----------
    let valuation: {
      estimatedValue: number;
      lowEstimate: number | null;
      highEstimate: number | null;
      modelKey: string;
      modelVersion: number;
      modelVersionId: string;
      computedAt: string;
    } | null = null;
    let valuationZip: string | null = null;

    if (countyFips && q.apn) {
      // Join ParcelValuation → ParcelFeature (for situsZip → liquidity) by the
      // shared (countyFips, apn) natural key. ParcelValuation is typed in the
      // generated client, but we LEFT JOIN ParcelFeature for the ZIP in one
      // round-trip via raw SQL.
      const rows = await prisma.$queryRawUnsafe<ValuationRow[]>(
        `SELECT pv."estimatedValue"  AS "estimatedValue",
                pv."lowEstimate"     AS "lowEstimate",
                pv."highEstimate"    AS "highEstimate",
                pv."modelVersionId"  AS "modelVersionId",
                pv."computedAt"      AS "computedAt",
                pf."situsZip"        AS "situsZip"
         FROM flipops."ParcelValuation" pv
         LEFT JOIN flipops."ParcelFeature" pf
           ON pf."countyFips" = pv."countyFips" AND pf."apn" = pv."apn"
         WHERE pv."countyFips" = $1 AND pv."apn" = $2
         LIMIT 1`,
        countyFips,
        q.apn,
      );
      const row = rows[0];
      if (row) {
        valuationZip = row.situsZip ? row.situsZip.slice(0, 5) : null;
        // Resolve the ModelVersion for honest "AVM v1" provenance (invariant #1).
        const mv = await prisma.$queryRawUnsafe<Array<{ modelKey: string; version: number }>>(
          `SELECT "modelKey", version FROM flipops."ModelVersion" WHERE id = $1 LIMIT 1`,
          row.modelVersionId,
        );
        valuation = {
          estimatedValue: row.estimatedValue,
          lowEstimate: row.lowEstimate,
          highEstimate: row.highEstimate,
          modelKey: mv[0]?.modelKey ?? 'avm',
          modelVersion: Number(mv[0]?.version ?? 1),
          modelVersionId: row.modelVersionId,
          computedAt: new Date(row.computedAt).toISOString(),
        };
      }
    }

    // ---- ZIP liquidity (ZipMarketStats) -------------------------------------
    // Prefer the parcel's own ZIP from ParcelFeature, else the query ZIP.
    const liqZip = valuationZip ?? zip5;
    let liquidity: ReturnType<typeof computeZipLiquidity> & { zip: string } | null = null;
    if (liqZip) {
      const zipStats = await prisma.zipMarketStats.findUnique({
        where: { zip: liqZip },
        select: { saleVelocity12mo: true, sampleSize: true },
      });
      liquidity = {
        zip: liqZip,
        ...computeZipLiquidity(zipStats?.saleVelocity12mo ?? null, zipStats?.sampleSize ?? null),
      };
    }

    return NextResponse.json({
      valuation,
      liquidity,
      provenance: 'FL-DOR-AVM',
    });
  } catch (error) {
    console.error('Error fetching valuation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
