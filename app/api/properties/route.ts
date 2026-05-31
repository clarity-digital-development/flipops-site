import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// GET /api/properties — Option A Phase A4
//
// UNION of two lead sources, in a single paginated response:
//
//   A. "mine"    — Property rows owned by the authenticated user
//                  (current behavior — investor-curated leads)
//   B. "virtual" — Parcel + Lien + TaxDelinquencySummary join, surfacing
//                  the freshness-layer's tax-delinquent universe (~105k rows
//                  across 6 FL metros). NOT materialized as Property rows
//                  per the design — they're tenant-owned only after the
//                  user takes a real action (Skip Trace, Add Note, etc.)
//                  via the promote-on-engagement endpoint.
//
// Query params:
//   ?source=all (default) | mine | virtual
//   ?zip=33125
//   ?scoreMin=70
//   ?distress=taxDelinquent,vacant   (comma-separated)
//   ?taxOwedMin=50000
//   ?limit=200   (max 500, default 200)
//   ?cursor=<opaque base64(JSON)>
//
// Response shape (Lead = strict superset of seed-data.Property interface):
//   { properties: Lead[], cursor: string | null, counts: {total, mine, virtual} }
//
// Critical design notes:
// 1. Virtual leads use TaxDelinquencySummary.score (materialized by Phase A2's
//    SQL aggregate). This lets SQL-side ORDER BY work cleanly across UNION.
// 2. LEFT JOIN on Parcel so orphan-Lien rows (~3% with no Parcel match) still
//    surface — with `partial: true` flag so the UI shows a degraded card.
// 3. Cursor pagination uses (score DESC, id ASC) tuple from the LAST row of
//    each page. Composite ordering survives the UNION boundary.
// 4. Filter pushdown: zip / scoreMin / taxOwedMin / distress chips are all
//    applied at SQL layer — no Node-side re-filtering after fetch.
// ---------------------------------------------------------------------------

interface CursorPayload {
  score: number;     // last row's score
  id: string;        // last row's id (tiebreaker)
}

interface LeadRow {
  id: string;
  virtual: boolean;
  apn: string | null;
  countyFips: string | null;
  partial: boolean;        // true for orphan-Lien (no Parcel match)
  address: string;
  city: string;
  state: string;
  zip: string | null;
  county: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  assessedValue: number | null;
  estimatedValue: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  listingDate: string | null;
  daysOnMarket: number | null;
  score: number | null;
  grade: string | null;
  motivation: string | null;
  scoreBreakdown: string | null;
  dataSource: string;
  ownerName: string | null;
  enriched: boolean;
  phoneNumbers: string | null;
  emails: string | null;
  foreclosure: boolean;
  preForeclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  bankruptcy: boolean;
  absenteeOwner: boolean;
  metadata: string | null;
  createdAt: string;
  // Tax-delinquent specific
  taxDelinquentAmount: number | null;
  taxDelinquentYearsCount: number | null;
  taxDelinquentEarliestYear: number | null;
  taxDelinquentLatestYear: number | null;
  latitude: number | null;
  longitude: number | null;
}

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 200;

function decodeCursor(raw: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (typeof payload.score !== 'number' || typeof payload.id !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

function encodeCursor(c: CursorPayload): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64');
}

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = dbUser.id;

    // -----------------------------------------------------------------------
    // Parse query params
    // -----------------------------------------------------------------------
    const sp = request.nextUrl.searchParams;
    const source = (sp.get('source') ?? 'all') as 'all' | 'mine' | 'virtual';
    const zipFilter = sp.get('zip');
    const scoreMin = sp.get('scoreMin') ? Math.max(0, parseInt(sp.get('scoreMin')!, 10)) : 0;
    const taxOwedMin = sp.get('taxOwedMin') ? Math.max(0, parseInt(sp.get('taxOwedMin')!, 10)) : 0;
    const distress = (sp.get('distress') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, sp.get('limit') ? parseInt(sp.get('limit')!, 10) : DEFAULT_LIMIT),
    );
    const cursor = decodeCursor(sp.get('cursor'));

    // -----------------------------------------------------------------------
    // Build the UNION SQL.
    //
    // We over-fetch by 1 row to compute the next cursor; trim to `limit`
    // before responding. Each branch projects to the same column set so the
    // UNION ALL is type-compatible.
    // -----------------------------------------------------------------------

    const wantMine = source === 'all' || source === 'mine';
    const wantVirtual = source === 'all' || source === 'virtual';

    // Distress filter — applied per-branch since Property has the flags
    // inline whereas virtual rows derive them from joins.
    const distressMineSql =
      distress.length === 0
        ? Prisma.sql`TRUE`
        : Prisma.sql`(${Prisma.join(
            distress.map((d) => {
              switch (d) {
                case 'foreclosure':    return Prisma.sql`p."foreclosure" = true`;
                case 'preForeclosure': return Prisma.sql`p."preForeclosure" = true`;
                case 'taxDelinquent':  return Prisma.sql`p."taxDelinquent" = true`;
                case 'vacant':         return Prisma.sql`p."vacant" = true`;
                default:                return Prisma.sql`FALSE`;
              }
            }),
            ' OR ',
          )})`;

    // For virtual rows, only taxDelinquent applies (the others are REAPI
    // signals that don't exist in our scraper world). If the user selected
    // ANY chip other than taxDelinquent, virtual rows are excluded entirely.
    const virtualPassesDistress =
      distress.length === 0 || distress.includes('taxDelinquent');

    const cursorMineSql = cursor
      ? Prisma.sql`AND (COALESCE(p."score", 0), p."id") < (${cursor.score}, ${cursor.id})`
      : Prisma.empty;
    const cursorVirtualSql = cursor
      ? Prisma.sql`AND (COALESCE(s."score", 0), ('virt-' || s."countyFips" || '-' || s."apn")) < (${cursor.score}, ${cursor.id})`
      : Prisma.empty;

    const zipMineSql = zipFilter
      ? Prisma.sql`AND p."zip" = ${zipFilter}`
      : Prisma.empty;
    const zipVirtualSql = zipFilter
      ? Prisma.sql`AND COALESCE(par."situsZip", '') = ${zipFilter}`
      : Prisma.empty;

    const scoreMinMineSql =
      scoreMin > 0 ? Prisma.sql`AND COALESCE(p."score", 0) >= ${scoreMin}` : Prisma.empty;
    const scoreMinVirtualSql =
      scoreMin > 0 ? Prisma.sql`AND COALESCE(s."score", 0) >= ${scoreMin}` : Prisma.empty;

    const taxOwedMineSql =
      taxOwedMin > 0
        ? Prisma.sql`AND COALESCE(p."taxDelinquentAmount", 0) >= ${taxOwedMin}`
        : Prisma.empty;
    const taxOwedVirtualSql =
      taxOwedMin > 0
        ? Prisma.sql`AND COALESCE(s."totalAmount", 0) >= ${taxOwedMin}`
        : Prisma.empty;

    // -------------------- Mine branch --------------------
    const mineQuery = Prisma.sql`
      SELECT
        p."id"                            AS id,
        FALSE                             AS virtual,
        p."apn"                           AS apn,
        p."countyFips"                    AS county_fips,
        FALSE                             AS partial,
        p."address"                       AS address,
        p."city"                          AS city,
        p."state"                         AS state,
        p."zip"                           AS zip,
        p."county"                        AS county,
        p."propertyType"                  AS property_type,
        p."bedrooms"                      AS bedrooms,
        p."bathrooms"                     AS bathrooms,
        p."squareFeet"                    AS square_feet,
        p."lotSize"                       AS lot_size,
        p."yearBuilt"                     AS year_built,
        p."assessedValue"::float          AS assessed_value,
        p."estimatedValue"::float         AS estimated_value,
        p."lastSaleDate"                  AS last_sale_date,
        p."lastSalePrice"::float          AS last_sale_price,
        p."listingDate"::text             AS listing_date,
        p."daysOnMarket"                  AS days_on_market,
        p."score"                         AS score,
        NULL::text                        AS grade,
        NULL::text                        AS motivation,
        p."scoreBreakdown"                AS score_breakdown,
        p."dataSource"                    AS data_source,
        p."ownerName"                     AS owner_name,
        p."enriched"                      AS enriched,
        p."phoneNumbers"                  AS phone_numbers,
        p."emails"                        AS emails,
        p."foreclosure"                   AS foreclosure,
        p."preForeclosure"                AS pre_foreclosure,
        p."taxDelinquent"                 AS tax_delinquent,
        p."vacant"                        AS vacant,
        p."bankruptcy"                    AS bankruptcy,
        p."absenteeOwner"                 AS absentee_owner,
        p."metadata"                      AS metadata,
        p."createdAt"::text               AS created_at,
        p."taxDelinquentAmount"::float    AS tax_delinquent_amount,
        p."taxDelinquentYearsCount"       AS tax_delinquent_years_count,
        p."taxDelinquentEarliestYear"     AS tax_delinquent_earliest_year,
        p."taxDelinquentLatestYear"       AS tax_delinquent_latest_year,
        p."latitude"::float               AS latitude,
        p."longitude"::float              AS longitude
      FROM flipops."Property" p
      WHERE p."userId" = ${userId}
        AND ${distressMineSql}
        ${cursorMineSql}
        ${zipMineSql}
        ${scoreMinMineSql}
        ${taxOwedMineSql}
    `;

    // -------------------- Virtual branch --------------------
    // LEFT JOIN Parcel so orphan-Lien rows (no Parcel match — ~3%) still
    // appear with `partial=true`. The score comes from TaxDelinquencySummary's
    // materialized column (set by scripts/rescore-tax-delinquent.ts).
    //
    // We also exclude virtual rows whose APN already has a tenant-owned
    // Property for this user — avoids duplicating a lead the user has already
    // promoted.
    const virtualQuery = Prisma.sql`
      SELECT
        ('virt-' || s."countyFips" || '-' || s."apn")  AS id,
        TRUE                                             AS virtual,
        s."apn"                                          AS apn,
        s."countyFips"                                   AS county_fips,
        (par."id" IS NULL)                               AS partial,
        COALESCE(par."situsAddress", '(address pending)') AS address,
        COALESCE(par."situsCity", '')                    AS city,
        COALESCE(par."state", 'FL')                      AS state,
        par."situsZip"                                   AS zip,
        NULL                                             AS county,
        par."propertyType"                               AS property_type,
        par."bedrooms"                                   AS bedrooms,
        par."bathrooms"                                  AS bathrooms,
        par."squareFeet"                                 AS square_feet,
        par."lotSize"                                    AS lot_size,
        par."yearBuilt"                                  AS year_built,
        par."assessedValue"::float                       AS assessed_value,
        par."marketValue"::float                         AS estimated_value,
        par."lastSaleDate"::text                         AS last_sale_date,
        par."lastSalePrice"::float                       AS last_sale_price,
        NULL                                             AS listing_date,
        NULL::int                                        AS days_on_market,
        COALESCE(s."score", 20)                          AS score,
        s."grade"                                        AS grade,
        s."motivation"                                   AS motivation,
        NULL::text                                       AS score_breakdown,
        'parcel-lien-bridge'                             AS data_source,
        COALESCE(par."ownerName", '(unknown owner)')     AS owner_name,
        FALSE                                            AS enriched,
        NULL::text                                       AS phone_numbers,
        NULL::text                                       AS emails,
        FALSE                                            AS foreclosure,
        FALSE                                            AS pre_foreclosure,
        TRUE                                             AS tax_delinquent,
        FALSE                                            AS vacant,
        FALSE                                            AS bankruptcy,
        FALSE                                            AS absentee_owner,
        NULL::text                                       AS metadata,
        s."computedAt"::text                             AS created_at,
        s."totalAmount"::float                           AS tax_delinquent_amount,
        s."yearsCount"                                   AS tax_delinquent_years_count,
        s."earliestYear"                                 AS tax_delinquent_earliest_year,
        s."latestYear"                                   AS tax_delinquent_latest_year,
        par."latitude"::float                            AS latitude,
        par."longitude"::float                           AS longitude
      FROM flipops."TaxDelinquencySummary" s
      LEFT JOIN flipops."Parcel" par
        ON par."countyFips" = s."countyFips" AND par."apn" = s."apn"
      WHERE NOT EXISTS (
        SELECT 1 FROM flipops."Property" pp
        WHERE pp."userId" = ${userId}
          AND pp."countyFips" = s."countyFips"
          AND pp."apn" = s."apn"
      )
        ${cursorVirtualSql}
        ${zipVirtualSql}
        ${scoreMinVirtualSql}
        ${taxOwedVirtualSql}
    `;

    let unionSql: Prisma.Sql;
    if (wantMine && wantVirtual && virtualPassesDistress) {
      unionSql = Prisma.sql`(${mineQuery}) UNION ALL (${virtualQuery})`;
    } else if (wantMine && (!wantVirtual || !virtualPassesDistress)) {
      unionSql = mineQuery;
    } else if (wantVirtual && virtualPassesDistress) {
      unionSql = virtualQuery;
    } else {
      // user requested virtual-only but distress filter excludes virtual rows
      unionSql = Prisma.sql`SELECT * FROM (${mineQuery}) sub WHERE FALSE`;
    }

    const finalSql = Prisma.sql`
      ${unionSql}
      ORDER BY score DESC NULLS LAST, id ASC
      LIMIT ${limit + 1}
    `;

    // -----------------------------------------------------------------------
    // Execute + reshape
    // -----------------------------------------------------------------------
    type SqlRow = Record<string, unknown>;
    const rawRows = (await prisma.$queryRaw(finalSql)) as SqlRow[];

    // Did we get an extra row? If so, build the next cursor from row[limit-1].
    let nextCursor: string | null = null;
    if (rawRows.length > limit) {
      const last = rawRows[limit - 1];
      nextCursor = encodeCursor({
        score: (last.score as number) ?? 0,
        id: last.id as string,
      });
      rawRows.length = limit;
    }

    // Map snake_case → camelCase to match the existing API response shape.
    const properties: LeadRow[] = rawRows.map((r) => ({
      id: r.id as string,
      virtual: r.virtual as boolean,
      apn: (r.apn as string | null) ?? null,
      countyFips: (r.county_fips as string | null) ?? null,
      partial: r.partial as boolean,
      address: r.address as string,
      city: r.city as string,
      state: r.state as string,
      zip: (r.zip as string | null) ?? null,
      county: (r.county as string | null) ?? null,
      propertyType: (r.property_type as string | null) ?? null,
      bedrooms: (r.bedrooms as number | null) ?? null,
      bathrooms: (r.bathrooms as number | null) ?? null,
      squareFeet: (r.square_feet as number | null) ?? null,
      lotSize: (r.lot_size as number | null) ?? null,
      yearBuilt: (r.year_built as number | null) ?? null,
      assessedValue: (r.assessed_value as number | null) ?? null,
      estimatedValue: (r.estimated_value as number | null) ?? null,
      lastSaleDate: (r.last_sale_date as string | null) ?? null,
      lastSalePrice: (r.last_sale_price as number | null) ?? null,
      listingDate: (r.listing_date as string | null) ?? null,
      daysOnMarket: (r.days_on_market as number | null) ?? null,
      score: (r.score as number | null) ?? null,
      grade: (r.grade as string | null) ?? null,
      motivation: (r.motivation as string | null) ?? null,
      scoreBreakdown: (r.score_breakdown as string | null) ?? null,
      dataSource: r.data_source as string,
      ownerName: (r.owner_name as string | null) ?? null,
      enriched: r.enriched as boolean,
      phoneNumbers: (r.phone_numbers as string | null) ?? null,
      emails: (r.emails as string | null) ?? null,
      foreclosure: r.foreclosure as boolean,
      preForeclosure: r.pre_foreclosure as boolean,
      taxDelinquent: r.tax_delinquent as boolean,
      vacant: r.vacant as boolean,
      bankruptcy: r.bankruptcy as boolean,
      absenteeOwner: r.absentee_owner as boolean,
      metadata: (r.metadata as string | null) ?? null,
      createdAt: r.created_at as string,
      taxDelinquentAmount: (r.tax_delinquent_amount as number | null) ?? null,
      taxDelinquentYearsCount: (r.tax_delinquent_years_count as number | null) ?? null,
      taxDelinquentEarliestYear: (r.tax_delinquent_earliest_year as number | null) ?? null,
      taxDelinquentLatestYear: (r.tax_delinquent_latest_year as number | null) ?? null,
      latitude: (r.latitude as number | null) ?? null,
      longitude: (r.longitude as number | null) ?? null,
    }));

    // Counts — for the demo stats bar. Cheap single-row queries.
    const counts = await getCounts(userId, source, virtualPassesDistress, {
      zipFilter,
      scoreMin,
      taxOwedMin,
      distress,
    });

    return NextResponse.json({ properties, cursor: nextCursor, counts });
  } catch (error) {
    console.error('[/api/properties] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCounts(
  userId: string,
  source: 'all' | 'mine' | 'virtual',
  virtualPassesDistress: boolean,
  filters: { zipFilter: string | null; scoreMin: number; taxOwedMin: number; distress: string[] },
): Promise<{ total: number; mine: number; virtual: number }> {
  const wantMine = source === 'all' || source === 'mine';
  const wantVirtual = (source === 'all' || source === 'virtual') && virtualPassesDistress;

  const [mineCount, virtualCount] = await Promise.all([
    wantMine
      ? prisma.$queryRaw<[{ n: bigint }]>`
          SELECT COUNT(*)::bigint AS n FROM flipops."Property" p
          WHERE p."userId" = ${userId}
            ${filters.zipFilter ? Prisma.sql`AND p."zip" = ${filters.zipFilter}` : Prisma.empty}
            ${filters.scoreMin > 0 ? Prisma.sql`AND COALESCE(p."score", 0) >= ${filters.scoreMin}` : Prisma.empty}
            ${filters.taxOwedMin > 0 ? Prisma.sql`AND COALESCE(p."taxDelinquentAmount", 0) >= ${filters.taxOwedMin}` : Prisma.empty}
        `
      : Promise.resolve([{ n: BigInt(0) }] as [{ n: bigint }]),
    wantVirtual
      ? prisma.$queryRaw<[{ n: bigint }]>`
          SELECT COUNT(*)::bigint AS n FROM flipops."TaxDelinquencySummary" s
          LEFT JOIN flipops."Parcel" par
            ON par."countyFips" = s."countyFips" AND par."apn" = s."apn"
          WHERE NOT EXISTS (
            SELECT 1 FROM flipops."Property" pp
            WHERE pp."userId" = ${userId}
              AND pp."countyFips" = s."countyFips"
              AND pp."apn" = s."apn"
          )
            ${filters.zipFilter ? Prisma.sql`AND COALESCE(par."situsZip", '') = ${filters.zipFilter}` : Prisma.empty}
            ${filters.scoreMin > 0 ? Prisma.sql`AND COALESCE(s."score", 0) >= ${filters.scoreMin}` : Prisma.empty}
            ${filters.taxOwedMin > 0 ? Prisma.sql`AND COALESCE(s."totalAmount", 0) >= ${filters.taxOwedMin}` : Prisma.empty}
        `
      : Promise.resolve([{ n: BigInt(0) }] as [{ n: bigint }]),
  ]);

  const mine = Number(mineCount[0].n);
  const virtual = Number(virtualCount[0].n);
  return { total: mine + virtual, mine, virtual };
}
