/**
 * audit-field-coverage.ts — LANE A1 data coverage audit (temp script)
 *
 * Measures live field completeness of the scraped-data layer against the
 * Cotality 981-field coverage plan (docs/development/FL-COVERAGE-PLAN.md).
 *
 * Run:
 *   DATABASE_URL=... npx tsx scripts/audit-field-coverage.ts
 */
import { prisma } from '../lib/prisma';

const n = (v: unknown): number => Number(v); // BigInt -> number

function pct(part: number, whole: number): string {
  if (!whole) return 'n/a';
  return ((part / whole) * 100).toFixed(1) + '%';
}

async function main() {
  // ---------------------------------------------------------------- Parcel
  const parcelRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)                                          AS total,
      COUNT(DISTINCT "countyFips")                      AS counties,
      COUNT("ownerName")                                AS owner_name,
      COUNT("ownerMailingAddress")                      AS mailing_address,
      COUNT("situsAddress")                             AS situs_address,
      COUNT("situsCity")                                AS situs_city,
      COUNT("situsZip")                                 AS situs_zip,
      COUNT("marketValue")                              AS market_value,
      COUNT("assessedValue")                            AS assessed_value,
      COUNT("landValue")                                AS land_value,
      COUNT("yearBuilt")                                AS year_built,
      COUNT("squareFeet")                               AS square_feet,
      COUNT("lotSize")                                  AS lot_size,
      COUNT("lastSalePrice")                            AS last_sale_price,
      COUNT("lastSaleYear")                             AS last_sale_year,
      COUNT("propertyType")                             AS property_type,
      COUNT("latitude")                                 AS latitude,
      COUNT("longitude")                                AS longitude
    FROM flipops."Parcel"
  `);
  const p = parcelRows[0];
  const pTotal = n(p.total);

  console.log('=== Parcel ===');
  console.log(`total rows:        ${pTotal.toLocaleString()}`);
  console.log(`distinct counties: ${n(p.counties)}`);
  const parcelFields: Array<[string, number]> = [
    ['ownerName', n(p.owner_name)],
    ['ownerMailingAddress', n(p.mailing_address)],
    ['situsAddress', n(p.situs_address)],
    ['situsCity', n(p.situs_city)],
    ['situsZip', n(p.situs_zip)],
    ['marketValue', n(p.market_value)],
    ['assessedValue', n(p.assessed_value)],
    ['landValue', n(p.land_value)],
    ['yearBuilt', n(p.year_built)],
    ['squareFeet', n(p.square_feet)],
    ['lotSize', n(p.lot_size)],
    ['lastSalePrice', n(p.last_sale_price)],
    ['lastSaleYear', n(p.last_sale_year)],
    ['propertyType (DOR_UC)', n(p.property_type)],
    ['latitude', n(p.latitude)],
    ['longitude', n(p.longitude)],
  ];
  for (const [name, count] of parcelFields) {
    console.log(`  ${name.padEnd(24)} ${count.toLocaleString().padStart(12)}  ${pct(count, pTotal)}`);
  }
  console.log('  bedrooms                 -- NOT IN SCHEMA --');
  console.log('  bathrooms                -- NOT IN SCHEMA --');
  console.log('  lastSaleDate             -- NOT IN SCHEMA (lastSaleYear only; full dates in ParcelSale) --');
  console.log('  landUseCode/-Description -- NOT IN SCHEMA (propertyType carries raw DOR_UC) --');

  // ------------------------------------------------------------ ParcelSale
  const psRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)                     AS total,
      COUNT(DISTINCT "countyFips") AS counties,
      MIN("saleDate")              AS min_date,
      MAX("saleDate")              AS max_date,
      COUNT("salePrice")           AS with_price
    FROM flipops."ParcelSale"
  `);
  const ps = psRows[0];
  console.log('\n=== ParcelSale ===');
  console.log(`total rows:        ${n(ps.total).toLocaleString()}`);
  console.log(`distinct counties: ${n(ps.counties)}`);
  console.log(`date range:        ${ps.min_date?.toISOString?.()?.slice(0, 10) ?? ps.min_date} -> ${ps.max_date?.toISOString?.()?.slice(0, 10) ?? ps.max_date}`);
  console.log(`rows with price:   ${n(ps.with_price).toLocaleString()}  ${pct(n(ps.with_price), n(ps.total))}`);

  // ----------------------------------------------------------- Foreclosure
  const fcRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)                     AS total,
      COUNT("auctionDate")         AS with_auction_date,
      COUNT(DISTINCT "countyFips") AS counties,
      COUNT("judgmentAmount")      AS with_judgment,
      COUNT("openingBid")          AS with_opening_bid,
      COUNT("apn")                 AS with_apn
    FROM flipops."Foreclosure"
  `);
  const fc = fcRows[0];
  console.log('\n=== Foreclosure ===');
  console.log(`total rows:          ${n(fc.total).toLocaleString()}`);
  console.log(`with auctionDate:    ${n(fc.with_auction_date).toLocaleString()}  ${pct(n(fc.with_auction_date), n(fc.total))}`);
  console.log(`with judgmentAmount: ${n(fc.with_judgment).toLocaleString()}  ${pct(n(fc.with_judgment), n(fc.total))}`);
  console.log(`with openingBid:     ${n(fc.with_opening_bid).toLocaleString()}  ${pct(n(fc.with_opening_bid), n(fc.total))}`);
  console.log(`with apn:            ${n(fc.with_apn).toLocaleString()}  ${pct(n(fc.with_apn), n(fc.total))}`);
  console.log(`distinct counties:   ${n(fc.counties)}`);

  const fcStages = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "stageCode", COUNT(*) AS cnt FROM flipops."Foreclosure" GROUP BY 1 ORDER BY 2 DESC
  `);
  for (const r of fcStages) console.log(`  stage ${String(r.stageCode).padEnd(10)} ${n(r.cnt).toLocaleString()}`);

  // ----------------------------------------------- TaxDelinquencySummary
  const tdRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)                     AS total,
      SUM("totalAmount")           AS sum_owed,
      COUNT(DISTINCT "countyFips") AS counties
    FROM flipops."TaxDelinquencySummary"
  `);
  const td = tdRows[0];
  console.log('\n=== TaxDelinquencySummary ===');
  console.log(`total rows:        ${n(td.total).toLocaleString()}`);
  console.log(`sum tax owed:      $${Math.round(Number(td.sum_owed ?? 0)).toLocaleString()}`);
  console.log(`distinct counties: ${n(td.counties)}`);

  // ---------------------------------------------------------- AuctionSummary
  const asRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*)                     AS total,
      COUNT("nextAuctionDate")     AS with_next_auction,
      COUNT(DISTINCT "countyFips") AS counties
    FROM flipops."AuctionSummary"
  `);
  const a = asRows[0];
  console.log('\n=== AuctionSummary ===');
  console.log(`total rows:          ${n(a.total).toLocaleString()}`);
  console.log(`with nextAuctionDate ${n(a.with_next_auction).toLocaleString()}`);
  console.log(`distinct counties:   ${n(a.counties)}`);

  // -------------------------------------------- Mortgage / Lien (gap check)
  const mtgRows = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS total FROM flipops."Mortgage"`);
  console.log('\n=== Mortgage (F2.1 Civitek bucket — 296 Cotality fields) ===');
  console.log(`total rows: ${n(mtgRows[0].total).toLocaleString()}`);

  const lienRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "lienCategory", COUNT(*) AS cnt, COUNT(DISTINCT "countyFips") AS counties
    FROM flipops."Lien" GROUP BY 1 ORDER BY 2 DESC
  `);
  console.log('\n=== Lien (by category) ===');
  if (lienRows.length === 0) console.log('  (empty)');
  for (const r of lienRows) {
    console.log(`  ${String(r.lienCategory).padEnd(14)} ${n(r.cnt).toLocaleString().padStart(10)}  (${n(r.counties)} counties)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
