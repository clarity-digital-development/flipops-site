import { test as base } from '@playwright/test';
import { randomUUID } from 'node:crypto';
// Relative import — Playwright's runtime does not honor Next's tsconfig @/* path
// alias by default, and adding tsconfig-paths to the runner is more brittle than
// a four-level relative import that always resolves.
import { prisma } from '../../../lib/prisma';

// ---------------------------------------------------------------------------
// Auction parcel fixture for T6 (Leads UI auction-promote e2e).
//
// Seeds a deterministic Parcel + Foreclosure + AuctionSummary triple so the
// /api/properties auction-virtual branch ALWAYS surfaces at least one row
// when the test filters by "Auction Scheduled". This replaces the v0.1 soft-
// skip-on-0-rows path so we get a real promote-flow signal on every run.
//
// Collision safety:
//   - countyFips = '99001' (Autauga County, AL FIPS — outside FlipOps FL
//     coverage, not present in NAL ingests, top-5 metro tax-delinquent
//     scrapes, or RealAuction sweeps). Cannot collide with real production
//     data even if FlipOps later expands to AL (Autauga is rural and not in
//     the documented expansion order FL -> TX -> GA -> AZ -> NC).
//   - apn / caseNumber carry an 'E2E-TEST-' prefix and a per-run randomUUID()
//     suffix so parallel Playwright workers / overlapping runs never clash on
//     the Parcel / AuctionSummary @@unique([countyFips, apn]) or Foreclosure
//     @@unique([countyFips, caseNumber, stageCode, source]) constraints.
//
// Idempotency / crash recovery:
//   - On setup, a deleteMany sweep removes ANY existing rows with countyFips
//     '99001' AND the E2E-TEST- prefix. This self-heals against orphans left
//     by prior runs that crashed before teardown (CI SIGKILL, dev Ctrl-C,
//     process timeout). Without this, the unique-key constraint would block
//     every subsequent run with P2002 until manual cleanup.
//   - All three writes use upsert keyed on the natural unique key, so a
//     transient retry between sweep and create cannot fail.
//
// Teardown:
//   Playwright fixtures run cleanup after `await use()` in a try/finally,
//   which executes even when the test throws. Deletes are scoped by the
//   per-run prefix so no other rows are touched.
//
// Surfacing path (matches app/api/properties/route.ts auction-virtual branch):
//   1. AuctionSummary row with score != NULL, nextAuctionDate in future.
//   2. INNER JOIN to Parcel on (countyFips, apn) — Parcel row MUST exist or
//      the lead is filtered out of the response.
//   3. Foreclosure row keeps the data model consistent with how the row would
//      have been produced by rescore-auction.ts.
//
// Production-DB guard:
//   The fixture refuses to run if DATABASE_URL looks like a prod connection
//   AND E2E_ALLOW_DB_SEED is not set. Without this guard, a misconfigured
//   `npx playwright test` against prod would briefly inject an 'E2E Test
//   Owner LLC' row into every signed-in user's leads list (the auction-
//   virtual branch is NOT user-scoped).
// ---------------------------------------------------------------------------

export interface SeededAuctionParcel {
  countyFips: string;
  apn: string;
  caseNumber: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  nextAuctionDate: Date;
  openingBid: number;
  judgmentAmount: number;
  score: number;
  grade: string;
  motivation: string;
  /** id the auction-virtual branch produces: virt-fc-{countyFips}-{apn} */
  virtualId: string;
}

interface AuctionParcelFixtures {
  seededAuctionParcel: SeededAuctionParcel;
}

const TEST_COUNTY_FIPS = '99001';
const TEST_PREFIX = 'E2E-TEST-';

function assertSafeDatabaseUrl(): void {
  const url = process.env.DATABASE_URL ?? '';
  const allowOverride = process.env.E2E_ALLOW_DB_SEED === '1';
  if (allowOverride) return;
  if (/prod|production|flipops\.io/i.test(url)) {
    throw new Error(
      '[e2e-fixture] Refusing to seed against a prod-shaped DATABASE_URL. ' +
        'Set E2E_ALLOW_DB_SEED=1 if you are sure this is a non-prod database.',
    );
  }
  if (!url) {
    throw new Error(
      '[e2e-fixture] DATABASE_URL is not set. Point at a non-prod database ' +
        'and set E2E_ALLOW_DB_SEED=1 to enable e2e seeding.',
    );
  }
}

export const test = base.extend<AuctionParcelFixtures>({
  // eslint-disable-next-line no-empty-pattern
  seededAuctionParcel: async ({}, use) => {
    assertSafeDatabaseUrl();

    const runSuffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const apn = `${TEST_PREFIX}APN-${runSuffix}`;
    const caseNumber = `${TEST_PREFIX}CASE-${runSuffix}`;
    const virtualId = `virt-fc-${TEST_COUNTY_FIPS}-${apn}`;

    const nextAuctionDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const openingBid = 125_000;
    const judgmentAmount = 248_500;
    const score = 95;
    const grade = 'A';
    const motivation = `Auction scheduled ${nextAuctionDate.toISOString().slice(0, 10)}`;

    const seeded: SeededAuctionParcel = {
      countyFips: TEST_COUNTY_FIPS,
      apn,
      caseNumber,
      address: '1 E2E Test Lane',
      city: 'Testville',
      state: 'AL',
      zip: '36003',
      nextAuctionDate,
      openingBid,
      judgmentAmount,
      score,
      grade,
      motivation,
      virtualId,
    };

    // SETUP 1: Startup sweep. Clean ANY orphaned rows with the test prefix
    // in our synthetic county. Self-heals against crashed prior runs.
    await prisma.auctionSummary.deleteMany({
      where: { countyFips: TEST_COUNTY_FIPS, apn: { startsWith: TEST_PREFIX } },
    });
    await prisma.foreclosure.deleteMany({
      where: {
        countyFips: TEST_COUNTY_FIPS,
        caseNumber: { startsWith: TEST_PREFIX },
      },
    });
    await prisma.parcel.deleteMany({
      where: { countyFips: TEST_COUNTY_FIPS, apn: { startsWith: TEST_PREFIX } },
    });

    // SETUP 2: Upsert Parcel. INNER JOIN target for /api/properties
    // auction-virtual branch — without this row the AuctionSummary is
    // filtered out of the response.
    await prisma.parcel.upsert({
      where: { countyFips_apn: { countyFips: TEST_COUNTY_FIPS, apn } },
      update: {},
      create: {
        countyFips: TEST_COUNTY_FIPS,
        apn,
        state: seeded.state,
        ownerName: 'E2E Test Owner LLC',
        situsAddress: seeded.address,
        situsCity: seeded.city,
        situsState: seeded.state,
        situsZip: seeded.zip,
        marketValue: 350_000,
        assessedValue: 280_000,
        propertyType: 'SFR',
        yearBuilt: 1998,
        squareFeet: 1850,
        source: 'e2e-test-fixture',
      },
    });

    // SETUP 3: Upsert Foreclosure. Keeps the data model truthful.
    await prisma.foreclosure.upsert({
      where: {
        countyFips_caseNumber_stageCode_source: {
          countyFips: TEST_COUNTY_FIPS,
          caseNumber,
          stageCode: 'SCHEDULED',
          source: 'e2e-test-fixture',
        },
      },
      update: {},
      create: {
        countyFips: TEST_COUNTY_FIPS,
        apn,
        stageCode: 'SCHEDULED',
        auctionDate: nextAuctionDate,
        judgmentAmount,
        openingBid,
        plaintiffName: 'E2E TEST BANK NA',
        caseNumber,
        source: 'e2e-test-fixture',
      },
    });

    // SETUP 4: Upsert AuctionSummary directly. We do NOT call
    // rescore-auction.ts here; we write the materialized fields ourselves.
    const now = new Date();
    await prisma.auctionSummary.upsert({
      where: { countyFips_apn: { countyFips: TEST_COUNTY_FIPS, apn } },
      update: {
        nextAuctionDate,
        pastAuctionCount: 0,
        scheduledCount: 1,
        judgmentAmountMax: judgmentAmount,
        openingBidMin: openingBid,
        lastCaseNumber: caseNumber,
        lastCapturedAt: now,
        score,
        grade,
        motivation,
      },
      create: {
        countyFips: TEST_COUNTY_FIPS,
        apn,
        nextAuctionDate,
        pastAuctionCount: 0,
        scheduledCount: 1,
        judgmentAmountMax: judgmentAmount,
        openingBidMin: openingBid,
        lastCaseNumber: caseNumber,
        firstCapturedAt: now,
        lastCapturedAt: now,
        score,
        grade,
        motivation,
      },
    });

    try {
      await use(seeded);
    } finally {
      // TEARDOWN — reverse-order delete, scoped to our synthetic county +
      // per-run prefix. .catch() so a failed cleanup of one row doesn't
      // prevent cleanup of the others.
      await prisma.auctionSummary
        .deleteMany({ where: { countyFips: TEST_COUNTY_FIPS, apn } })
        .catch((e: unknown) =>
          console.error('[e2e-fixture] auctionSummary cleanup failed:', e),
        );
      await prisma.foreclosure
        .deleteMany({
          where: {
            countyFips: TEST_COUNTY_FIPS,
            caseNumber,
            source: 'e2e-test-fixture',
          },
        })
        .catch((e: unknown) =>
          console.error('[e2e-fixture] foreclosure cleanup failed:', e),
        );
      await prisma.parcel
        .deleteMany({ where: { countyFips: TEST_COUNTY_FIPS, apn } })
        .catch((e: unknown) =>
          console.error('[e2e-fixture] parcel cleanup failed:', e),
        );
    }
  },
});

export { expect } from '@playwright/test';
