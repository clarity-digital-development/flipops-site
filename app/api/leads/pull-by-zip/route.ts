import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

// ---------------------------------------------------------------------------
// POST /api/leads/pull-by-zip
//
// The product loop: user types a ZIP on the Leads map and hits "Pull leads".
// We pull every parcel in the requested ZIP from the FL Parcel table (10.8M
// rows across all 67 counties — see FL Phase F1 ingest in project memory),
// LEFT JOIN our materialized TaxDelinquencySummary + AuctionSummary aggregates
// for scoring + distress flags, and return the matched rows in the same
// LeadRow shape /api/properties UNION emits. The leads UI drops them straight
// into state with no adapter code.
//
// Florida-only for now: ZIPs 32004–34997 inclusive (the entire FL allocation).
// Anything outside is denied with a humane "coming soon" message, per the
// product owner's direction during the n8n/ATTOM teardown.
//
// Body: { zip: string }   — 5-digit ZIP
// Response (success):
//   { properties: LeadRow[], count: number, zip: string }
// Response (out-of-FL):
//   400 { error: string }
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
});

const MAX_RESULTS = 500;

// FL ZIP allocation per USPS: 32004 through 34997 inclusive (covers all 67
// counties — 32xxx Panhandle/N FL, 33xxx central + Miami metro, 34xxx central
// + SW Gulf coast). Reject anything outside.
function isFloridaZip(zip: string): boolean {
  const n = parseInt(zip, 10);
  if (Number.isNaN(n)) return false;
  return n >= 32004 && n <= 34997;
}

interface SqlRow {
  id: string;
  county_fips: string | null;
  apn: string | null;
  partial: boolean;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  county: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  lot_size: number | null;
  year_built: number | null;
  assessed_value: number | null;
  estimated_value: number | null;
  last_sale_date: string | null;
  last_sale_price: number | null;
  score: number | null;
  grade: string | null;
  motivation: string | null;
  data_source: string;
  owner_name: string | null;
  foreclosure: boolean;
  pre_foreclosure: boolean;
  tax_delinquent: boolean;
  created_at: string | null;
  tax_delinquent_amount: number | null;
  tax_delinquent_years_count: number | null;
  tax_delinquent_earliest_year: number | null;
  tax_delinquent_latest_year: number | null;
  latitude: number | null;
  longitude: number | null;
  next_auction_date: string | Date | null;
  opening_bid: number | null;
  judgment_amount: number | null;
  last_case_number: string | null;
  scheduled_count: number | null;
  past_auction_count: number | null;
}

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  // -----------------------------------------------------------------------
  // Parse + validate body
  // -----------------------------------------------------------------------
  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { zip } = parsed;

  // -----------------------------------------------------------------------
  // FL gating — humane message for out-of-state ZIPs.
  // -----------------------------------------------------------------------
  if (!isFloridaZip(zip)) {
    return NextResponse.json(
      {
        error: `FL coverage only for now — ${zip} ZIP support coming soon.`,
      },
      { status: 400 },
    );
  }

  // -----------------------------------------------------------------------
  // Query parcels in this ZIP. LEFT JOIN the two materialized summaries so
  // scored/distressed rows surface flags + score in the same response.
  //
  // Exclude parcels the user already owns in Property — keeps ZIP pulls and
  // 'mine' leads disjoint, mirroring /api/properties UNION dedupe semantics.
  // -----------------------------------------------------------------------
  try {
    const rows = await prisma.$queryRaw<SqlRow[]>`
      SELECT
        ('virt-zip-' || par."countyFips" || '-' || par."apn")   AS id,
        par."countyFips"                                          AS county_fips,
        par."apn"                                                 AS apn,
        FALSE                                                     AS partial,
        COALESCE(par."situsAddress", '(address pending)')         AS address,
        COALESCE(par."situsCity", '')                             AS city,
        COALESCE(par."state", 'FL')                               AS state,
        par."situsZip"                                            AS zip,
        NULL::text                                                AS county,
        par."propertyType"                                        AS property_type,
        par."bedrooms"                                            AS bedrooms,
        par."bathrooms"                                           AS bathrooms,
        par."squareFeet"                                          AS square_feet,
        par."lotSize"                                             AS lot_size,
        par."yearBuilt"                                           AS year_built,
        par."assessedValue"::float                                AS assessed_value,
        par."marketValue"::float                                  AS estimated_value,
        par."lastSaleDate"::text                                  AS last_sale_date,
        par."lastSalePrice"::float                                AS last_sale_price,
        COALESCE(auc."score", tds."score", 20)                    AS score,
        COALESCE(auc."grade", tds."grade")                        AS grade,
        COALESCE(auc."motivation", tds."motivation")              AS motivation,
        CASE
          WHEN auc."countyFips" IS NOT NULL THEN 'parcel-auction-bridge'
          WHEN tds."countyFips" IS NOT NULL THEN 'parcel-lien-bridge'
          ELSE 'parcel-zip-pull'
        END                                                       AS data_source,
        COALESCE(par."ownerName", '(unknown owner)')              AS owner_name,
        (auc."nextAuctionDate" IS NOT NULL)                       AS foreclosure,
        (auc."countyFips" IS NOT NULL)                            AS pre_foreclosure,
        (tds."countyFips" IS NOT NULL)                            AS tax_delinquent,
        par."createdAt"::text                                     AS created_at,
        tds."totalAmount"::float                                  AS tax_delinquent_amount,
        tds."yearsCount"                                          AS tax_delinquent_years_count,
        tds."earliestYear"                                        AS tax_delinquent_earliest_year,
        tds."latestYear"                                          AS tax_delinquent_latest_year,
        par."latitude"::float                                     AS latitude,
        par."longitude"::float                                    AS longitude,
        auc."nextAuctionDate"                                     AS next_auction_date,
        auc."openingBidMin"::float                                AS opening_bid,
        auc."judgmentAmountMax"::float                            AS judgment_amount,
        auc."lastCaseNumber"                                      AS last_case_number,
        auc."scheduledCount"                                      AS scheduled_count,
        auc."pastAuctionCount"                                    AS past_auction_count
      FROM flipops."Parcel" par
      LEFT JOIN flipops."TaxDelinquencySummary" tds
        ON tds."countyFips" = par."countyFips" AND tds."apn" = par."apn"
      LEFT JOIN flipops."AuctionSummary" auc
        ON auc."countyFips" = par."countyFips" AND auc."apn" = par."apn"
      WHERE par."situsZip" = ${zip}
        AND par."state" = 'FL'
        AND NOT EXISTS (
          SELECT 1 FROM flipops."Property" pp
          WHERE pp."userId" = ${userId}
            AND pp."countyFips" = par."countyFips"
            AND pp."apn" = par."apn"
        )
      ORDER BY COALESCE(auc."score", tds."score", 0) DESC NULLS LAST,
               par."apn" ASC
      LIMIT ${MAX_RESULTS}
    `;

    // Reshape to the LeadRow camelCase contract the Leads UI expects.
    const properties = rows.map((r) => ({
      id: r.id,
      virtual: true,
      apn: r.apn,
      countyFips: r.county_fips,
      partial: r.partial,
      address: r.address,
      city: r.city,
      state: r.state,
      zip: r.zip,
      county: r.county,
      propertyType: r.property_type,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      squareFeet: r.square_feet,
      lotSize: r.lot_size,
      yearBuilt: r.year_built,
      assessedValue: r.assessed_value,
      estimatedValue: r.estimated_value,
      lastSaleDate: r.last_sale_date,
      lastSalePrice: r.last_sale_price,
      listingDate: null,
      daysOnMarket: null,
      score: r.score,
      grade: r.grade,
      motivation: r.motivation,
      scoreBreakdown: null,
      dataSource: r.data_source,
      ownerName: r.owner_name,
      enriched: false,
      phoneNumbers: null,
      emails: null,
      foreclosure: r.foreclosure,
      preForeclosure: r.pre_foreclosure,
      taxDelinquent: r.tax_delinquent,
      vacant: false,
      bankruptcy: false,
      absenteeOwner: false,
      metadata: null,
      createdAt: r.created_at,
      taxDelinquentAmount: r.tax_delinquent_amount,
      taxDelinquentYearsCount: r.tax_delinquent_years_count,
      taxDelinquentEarliestYear: r.tax_delinquent_earliest_year,
      taxDelinquentLatestYear: r.tax_delinquent_latest_year,
      latitude: r.latitude,
      longitude: r.longitude,
      nextAuctionDate:
        r.next_auction_date != null
          ? new Date(r.next_auction_date as string | Date).toISOString()
          : null,
      openingBid: r.opening_bid,
      judgmentAmount: r.judgment_amount,
      lastCaseNumber: r.last_case_number,
      scheduledCount: r.scheduled_count,
      pastAuctionCount: r.past_auction_count,
    }));

    return NextResponse.json({
      properties,
      count: properties.length,
      zip,
    });
  } catch (error) {
    console.error("[/api/leads/pull-by-zip] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
