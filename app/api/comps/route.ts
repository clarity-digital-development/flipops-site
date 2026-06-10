import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';
import { FL_COUNTIES, flCountyByFips } from '@/lib/data-sources/bulk/fl-counties';
import { resolveCountyFromZip } from '@/lib/data-sources/zip-to-county';

/**
 * GET /api/comps — recorded-sale comps from the FL DOR SDF dataset (M1.2).
 *
 * Data source: flipops."ParcelSale" (1.97M recorded sales, 2024+) JOIN
 * flipops."Parcel" (11M FL parcels). Replaces the original implementation that
 * compped against the user's own distressed-lead Property table (selection-
 * biased — systematically depresses ARV) and fabricated distance with a
 * pseudo-random placeholder.
 *
 * Query params (all optional unless noted):
 *   - countyFips: 5-digit FL county FIPS ("12031"). Strongest subject locator.
 *   - county:     FL county name ("Duval") — resolved via the FL crosswalk.
 *   - zip:        subject ZIP — fallback county resolution + same-ZIP ranking.
 *   - apn:        subject parcel number — pulls the subject Parcel row for
 *                 coords + sqft/yearBuilt/ZIP backfill, and excludes the
 *                 subject from its own comp set.
 *   - sqft:       subject living area → comps filtered to ±25%.
 *   - yearBuilt:  subject year built → comps filtered to ±15 years.
 *   - lat, lng:   explicit subject coords (else taken from the subject Parcel).
 *   - state:      'FL' expected; any other state returns an empty FL_ONLY result.
 *   - limit:      max comps (default 10, max 25).
 *   At least one of countyFips / county / zip must resolve to an FL county.
 *
 * Distance policy: `distance` is REAL haversine miles on Parcel lat/lng and is
 * null whenever either side lacks coordinates (geocode backfill = M1.3). The
 * UI falls back to the `zipMatch` flag. No fabricated values, ever.
 *
 * Demo path: the underwriting page's demo property short-circuits client-side
 * (DEMO_PROPERTY_ID) with synthetic comps and never calls this route.
 */

// FL DOR sale-qualification codes that mark an arms-length, comp-grade sale.
// Verified empirically against the live 1.97M-row ParcelSale table (2026-06-09):
//   '01' qualified arms-length        n=720,057  median $358,600  <- comp-grade
//   '02' qualified, docs examined     n=111,568  median $400,000  <- comp-grade
//   '05' qualified MULTI-parcel sale  n=145,462  median $1,638,000 — the price
//        spans multiple parcels, poisonous for single-property $/sqft. Excluded.
//   '11'/'14' nominal-consideration transfers (median $100). Excluded.
//   '18'/'19' financial-institution / distressed transfers. Excluded — the
//        point of this route is an ARV not depressed by distress sales.
const ARMS_LENGTH_QUAL_CODES = ['01', '02'];

// Floor out $100-deed noise that survives county qual-coding mistakes.
const MIN_COMP_PRICE = 10_000;

// Recorded-sale recency window (SDF saleDate is month-precision).
const SALE_WINDOW_MONTHS = 18;

// Candidate pool fetched before in-process ranking (distance / similarity).
const CANDIDATE_POOL = 150;

const QuerySchema = z.object({
  countyFips: z.string().regex(/^12\d{3}$/, 'must be a 5-digit FL county FIPS').optional(),
  county: z.string().min(2).optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'must be a 5- or 9-digit ZIP').optional(),
  apn: z.string().min(1).max(40).optional(),
  state: z.string().length(2).optional(),
  city: z.string().optional(), // legacy param — accepted, not used for matching
  sqft: z.coerce.number().int().positive().optional(),
  yearBuilt: z.coerce.number().int().min(1700).max(2100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

interface RawCompRow {
  apn: string;
  sale_date: Date | null;
  sale_price: number;
  qual_code: string | null;
  situs_address: string | null;
  situs_city: string | null;
  situs_zip: string | null;
  square_feet: number;
  year_built: number | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Resolve the subject's FL county FIPS: explicit fips → county name → ZIP. */
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

/** Great-circle distance in miles. Only called when BOTH sides have coords. */
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.7613; // mean Earth radius, miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;

    // Collect only present, non-empty params so zod optionals behave.
    // (Legacy params beds/baths/propertyType/excludeId are silently ignored —
    // the DOR roll has no bed/bath data and the subject is excluded by APN.)
    const raw: Record<string, string> = {};
    const keys = ['countyFips', 'county', 'zip', 'apn', 'state', 'city', 'sqft', 'yearBuilt', 'lat', 'lng', 'limit'] as const;
    for (const key of keys) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null && value.trim() !== '') raw[key] = value.trim();
    }
    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const q = parsed.data;

    // ParcelSale coverage is FL-only today. Non-FL subjects get an explicit
    // empty result (not an error) so the UI renders its comps empty state.
    if (q.state && q.state.toUpperCase() !== 'FL') {
      return NextResponse.json({
        comps: [],
        stats: { totalFound: 0, returned: 0, avgPricePerSqft: 0, medianPricePerSqft: 0 },
        coverage: 'FL_ONLY',
        provenance: 'FL-DOR-SDF',
      });
    }

    const countyFips = resolveCountyFips(q);
    if (!countyFips) {
      return NextResponse.json(
        { error: 'Unable to resolve an FL county. Provide countyFips, an FL county name, or a covered ZIP.' },
        { status: 400 }
      );
    }

    // Subject parcel — gives us coords (when geocoded) plus sqft/yearBuilt/ZIP
    // backfill for callers that only know the APN.
    const subjectParcel = q.apn
      ? await prisma.parcel.findUnique({
          where: { countyFips_apn: { countyFips, apn: q.apn } },
          select: { latitude: true, longitude: true, squareFeet: true, yearBuilt: true, situsZip: true },
        })
      : null;

    const sqft = q.sqft ?? subjectParcel?.squareFeet ?? null;
    const yearBuilt = q.yearBuilt ?? subjectParcel?.yearBuilt ?? null;
    const zip5 = (q.zip ?? subjectParcel?.situsZip ?? '').slice(0, 5) || null;
    const subjectLat = q.lat ?? subjectParcel?.latitude ?? null;
    const subjectLng = q.lng ?? subjectParcel?.longitude ?? null;
    const subjectCoords =
      subjectLat !== null && subjectLng !== null ? { lat: subjectLat, lng: subjectLng } : null;

    const sqftFilter =
      sqft !== null
        ? Prisma.sql`AND p."squareFeet" BETWEEN ${Math.round(sqft * 0.75)} AND ${Math.round(sqft * 1.25)}`
        : Prisma.empty;
    const yearFilter =
      yearBuilt !== null
        ? Prisma.sql`AND p."yearBuilt" BETWEEN ${yearBuilt - 15} AND ${yearBuilt + 15}`
        : Prisma.empty;
    const excludeSubject = q.apn ? Prisma.sql`AND ps."apn" <> ${q.apn}` : Prisma.empty;
    // Same-ZIP candidates first, then most recent. Within one APN the ZIP flag
    // is constant, so the first row per APN is always its most recent sale —
    // the per-parcel dedupe below relies on this.
    const zipPriority =
      zip5 !== null
        ? Prisma.sql`(LEFT(COALESCE(p."situsZip", ''), 5) = ${zip5}) DESC,`
        : Prisma.empty;

    // Indexed on ParcelSale(countyFips, saleDate) + Parcel unique(countyFips, apn);
    // measured ~180ms against the live 1.97M-row table for a Duval subject.
    const rows = await prisma.$queryRaw<RawCompRow[]>(Prisma.sql`
      SELECT
        ps."apn",
        ps."saleDate"     AS sale_date,
        ps."salePrice"    AS sale_price,
        ps."qualCode"     AS qual_code,
        p."situsAddress"  AS situs_address,
        p."situsCity"     AS situs_city,
        p."situsZip"      AS situs_zip,
        p."squareFeet"    AS square_feet,
        p."yearBuilt"     AS year_built,
        p."propertyType"  AS property_type,
        p."latitude",
        p."longitude"
      FROM flipops."ParcelSale" ps
      JOIN flipops."Parcel" p
        ON p."countyFips" = ps."countyFips" AND p."apn" = ps."apn"
      WHERE ps."countyFips" = ${countyFips}
        AND ps."qualCode" IN (${Prisma.join(ARMS_LENGTH_QUAL_CODES)})
        AND ps."salePrice" >= ${MIN_COMP_PRICE}
        AND ps."saleDate" >= NOW() - make_interval(months => ${SALE_WINDOW_MONTHS}::int)
        AND p."squareFeet" IS NOT NULL AND p."squareFeet" > 0
        ${excludeSubject}
        ${sqftFilter}
        ${yearFilter}
      ORDER BY ${zipPriority} ps."saleDate" DESC
      LIMIT ${CANDIDATE_POOL}
    `);

    // One comp per parcel: keep the most recent qualifying sale (rows arrive
    // saleDate DESC within each APN — see zipPriority comment above).
    const seenApns = new Set<string>();
    const candidates = rows.filter((r) => {
      if (seenApns.has(r.apn)) return false;
      seenApns.add(r.apn);
      return true;
    });

    const comps = candidates
      .map((r) => {
        const pricePerSqft = r.square_feet > 0 ? Math.round(r.sale_price / r.square_feet) : 0;

        // REAL distance or null — never fabricated. Comp coords come from the
        // FGIO geocode backfill (M1.3); until it runs this stays null and the
        // UI falls back to the zipMatch flag.
        const distance =
          subjectCoords && r.latitude !== null && r.longitude !== null
            ? Math.round(haversineMiles(subjectCoords.lat, subjectCoords.lng, r.latitude, r.longitude) * 100) / 100
            : null;
        const zipMatch = zip5 !== null && (r.situs_zip ?? '').slice(0, 5) === zip5;

        // Similarity score (0-100): sqft + yearBuilt proximity, sale recency,
        // and distance/ZIP proximity when known.
        let similarity = 100;
        if (sqft !== null && r.square_feet > 0) {
          similarity -= Math.round((Math.abs(sqft - r.square_feet) / sqft) * 30);
        }
        if (yearBuilt !== null && r.year_built !== null) {
          similarity -= Math.round(Math.abs(yearBuilt - r.year_built) * 0.5);
        }
        if (r.sale_date) {
          const monthsAgo = getMonthsAgo(r.sale_date);
          if (monthsAgo <= 3) similarity += 5;
          else if (monthsAgo <= 6) similarity += 2;
          else if (monthsAgo > 12) similarity -= 5;
        }
        if (distance !== null) {
          if (distance <= 0.5) similarity += 5;
          else if (distance <= 1) similarity += 3;
          else if (distance > 3) similarity -= 5;
        } else if (zipMatch) {
          similarity += 3;
        }
        similarity = Math.max(0, Math.min(100, similarity));

        const soldDate = r.sale_date ? r.sale_date.toISOString().slice(0, 10) : '';
        const zip = r.situs_zip ? r.situs_zip.slice(0, 5) : null;
        const address =
          [r.situs_address, r.situs_city].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '');

        return {
          id: `fl-sdf-${countyFips}-${r.apn}`,
          apn: r.apn,
          address: address || `APN ${r.apn}`,
          city: r.situs_city,
          state: 'FL',
          zip,
          propertyType: r.property_type, // FL DOR land-use code
          beds: null as number | null, // not in the DOR roll
          baths: null as number | null, // not in the DOR roll
          sqft: r.square_feet,
          yearBuilt: r.year_built,
          soldDate,
          soldPrice: r.sale_price,
          saleDate: soldDate,
          salePrice: r.sale_price,
          pricePerSqft,
          similarity,
          distance, // real haversine miles or null — see distance policy above
          distanceMiles: distance,
          zipMatch,
          qualCode: r.qual_code,
          provenance: 'FL-DOR-SDF' as const,
          selected: false,
          weight: 0,
        };
      })
      .filter((c) => c.soldPrice > 0 && c.pricePerSqft > 0 && c.soldDate !== '');

    // Rank: real distance when we have it, then same-ZIP, then similarity.
    comps.sort((a, b) => {
      if (a.distance !== null && b.distance !== null && a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      if ((a.distance === null) !== (b.distance === null)) {
        return a.distance === null ? 1 : -1;
      }
      if (a.zipMatch !== b.zipMatch) return a.zipMatch ? -1 : 1;
      return b.similarity - a.similarity;
    });

    const sortedComps = comps.slice(0, q.limit).map((comp, index) => ({
      ...comp,
      // Auto-select top 3
      selected: index < 3,
      // Assign weights based on similarity
      weight: index < 3 ? Math.round((comp.similarity / 100) * 35) / 100 : 0,
    }));

    // Calculate aggregate stats
    const selectedComps = sortedComps.filter((c) => c.selected);
    const avgPricePerSqft = selectedComps.length > 0
      ? Math.round(selectedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / selectedComps.length)
      : 0;

    return NextResponse.json({
      comps: sortedComps,
      stats: {
        totalFound: comps.length,
        returned: sortedComps.length,
        avgPricePerSqft,
        medianPricePerSqft: getMedian(sortedComps.map((c) => c.pricePerSqft)),
      },
      subject: {
        countyFips,
        county: flCountyByFips(countyFips)?.name ?? null,
        zip: zip5,
        sqft,
        yearBuilt,
        hasCoords: subjectCoords !== null,
        parcelMatched: subjectParcel !== null,
      },
      provenance: 'FL-DOR-SDF',
    });
  } catch (error) {
    console.error('Error fetching comps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Months elapsed since the recorded sale (SDF dates are month-precision).
function getMonthsAgo(date: Date): number {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

// Helper function to calculate median
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
