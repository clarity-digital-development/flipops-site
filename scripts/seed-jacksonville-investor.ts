import { prisma } from '@/lib/prisma';

/**
 * Create Jacksonville Test Investor
 *
 * Profile based on real investor needs:
 * - Does heavy rehab (distressed properties)
 * - Recently doing quick flips (already renovated)
 * - Works with realtor partner
 * - Markets: Jacksonville, Orlando, Tampa
 */

async function seedJacksonvilleInvestor() {
  console.log('🏗️  Creating Jacksonville Test Investor...\n');

  // Define comprehensive investor profile
  const investorProfile = {
    // Investment strategies
    strategies: ['heavy_rehab', 'quick_flip'],

    // Property condition preferences
    preferredCondition: {
      distressed: true,      // YES - likes distressed properties
      turnkey: true,          // YES - also likes move-in ready for quick flips
      minRepairNeeds: 15000,  // Sweet spot: at least $15k in repairs
      maxRepairNeeds: 80000   // Max $80k in repairs (manageable scope)
    },

    // Price ranges (weighted by preference)
    priceRanges: [
      {
        min: 75000,
        max: 250000,
        weight: 1.0,  // Primary range - most deals here
        label: 'primary'
      },
      {
        min: 50000,
        max: 75000,
        weight: 0.7,  // Lower tier - higher risk/reward
        label: 'value'
      },
      {
        min: 250000,
        max: 400000,
        weight: 0.5,  // Higher tier - less common but lucrative
        label: 'premium'
      }
    ],

    // Equity requirements
    equityRequirements: {
      minEquityPercent: 25,       // At least 25% equity to make deal work
      preferredEquityPercent: 35  // Prefers 35%+ for safety margin
    },

    // Distress indicator weights (0-1 scale, 1 = highest priority)
    distressIndicators: {
      foreclosure: 1.0,       // TOP PRIORITY - motivated seller
      preForeclosure: 0.95,   // Very high - catching before auction
      taxDelinquent: 0.85,    // High - financial distress
      vacant: 0.90,           // Very high - likely distressed
      absenteeOwner: 0.75,    // Good - often easier to negotiate
      bankruptcy: 0.65        // Moderate - can be complicated
    },

    // Property characteristics
    preferredCharacteristics: {
      minBedrooms: 2,
      maxBedrooms: 5,
      minBathrooms: 1,
      minSquareFeet: 800,
      maxSquareFeet: 3500,
      preferredYearBuilt: {
        min: 1950,
        max: 1990,  // Older homes = more opportunity for value-add
        sweetSpot: { min: 1960, max: 1980 }
      }
    },

    // Partner ecosystem
    partnerPreferences: {
      hasRealtorPartner: true,       // Works with realtor for quick flips
      hasContractorNetwork: true,    // Has contractors for rehab
      prefersMLS: false,             // Prefers off-market deals
      canCloseQuickly: true          // Can close in 7-14 days (cash buyer)
    },

    // Deal breakers (automatic exclusions)
    dealBreakers: {
      noCondos: false,           // Will do condos
      noMobileHomes: true,       // NO mobile homes
      noCommercial: true,        // NO commercial (residential only)
      noCoops: true,             // NO co-ops
      maxHOAFees: 200            // Max $200/month HOA fees
    },

    // Time horizon
    timeHorizon: 'mixed',  // Both quick_flip (30-90 days) and medium_hold (6-12 months)

    // Risk tolerance
    riskTolerance: 'moderate_to_high',  // Willing to take on distressed but not massive projects

    // Lead volume preferences
    leadPreferences: {
      dailyMaxLeads: 20,       // Max 20 new leads per day
      minMatchScore: 65,       // Only send leads scoring 65+
      topLeadsPerDay: 5        // Highlight top 5 daily
    }
  };

  // Check if investor already exists
  const existing = await prisma.user.findUnique({
    where: { id: 'test-investor-jacksonville' }
  });

  if (existing) {
    console.log('⚠️  Jacksonville investor already exists. Updating profile...\n');

    await prisma.user.update({
      where: { id: 'test-investor-jacksonville' },
      data: {
        investorProfile: JSON.stringify(investorProfile),
        updatedAt: new Date()
      }
    });

    console.log('✅ Updated existing investor profile\n');
  } else {
    console.log('Creating new Jacksonville investor...\n');

    const investor = await prisma.user.create({
      data: {
        id: 'test-investor-jacksonville',
        email: 'investor-jacksonville@test.flipops.com',
        name: 'Jacksonville Test Investor',
        companyName: 'Florida Flip Co',

        // Target markets (3 major FL cities)
        targetMarkets: JSON.stringify([
          'Duval County, FL',       // Jacksonville
          'Orange County, FL',      // Orlando
          'Hillsborough County, FL' // Tampa
        ]),

        // Property types
        propertyTypes: JSON.stringify([
          'SFR',        // Single Family Residence
          'TOWNHOUSE',  // Townhouses
          'CONDO'       // Condos (if no HOA issues)
        ]),

        // Scoring preferences
        minScore: 65,      // Only alert on 65+ score
        maxBudget: 400000, // Max $400k all-in (purchase + rehab)

        // Detailed profile
        investorProfile: JSON.stringify(investorProfile),

        // Notifications
        slackWebhook: 'https://hooks.slack.com/services/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',
        emailAlerts: true,
        dailyDigest: true,
        digestTime: '08:00',  // 8am EST
        timezone: 'America/New_York',

        // Subscription
        tier: 'pro',
        subscriptionStatus: 'active',
        onboarded: true,
        onboardedAt: new Date()
      }
    });

    console.log('✅ Created Jacksonville Investor:');
    console.log(`   ID: ${investor.id}`);
    console.log(`   Email: ${investor.email}`);
    console.log(`   Markets: Jacksonville, Orlando, Tampa`);
    console.log(`   Strategies: Heavy Rehab + Quick Flip`);
    console.log(`   Price Range: $75k-$250k (primary)`);
    console.log(`   Min Match Score: 65`);
    console.log('');
  }

  // Create user-specific policy
  const existingPolicy = await prisma.policy.findFirst({
    where: {
      userId: 'test-investor-jacksonville',
      region: 'Florida'
    }
  });

  if (!existingPolicy) {
    const policy = await prisma.policy.create({
      data: {
        userId: 'test-investor-jacksonville',
        region: 'Florida',
        grade: 'Standard',             // Standard risk grade
        maxExposureUsd: 400000,        // Max $400k all-in
        targetRoiPct: 0.30,            // 30% ROI target
        contingencyTargetPct: 0.20,    // 20% contingency target
        varianceTier1Pct: 0.03,        // 3% variance tier 1
        varianceTier2Pct: 0.07,        // 7% variance tier 2
        bidSpreadMaxPct: 0.15,         // 15% max bid spread
        coSlaHours: 48                 // 48 hour change order SLA
      }
    });

    console.log('✅ Created Florida investment policy:');
    console.log(`   Max Exposure: $${policy.maxExposureUsd.toLocaleString()}`);
    console.log(`   Target ROI: ${(policy.targetRoiPct * 100)}%`);
    console.log(`   CO SLA: ${policy.coSlaHours} hours`);
    console.log('');
  }

  await prisma.$disconnect();

  console.log('🎉 Jacksonville investor setup complete!\n');
  console.log('📊 Profile Summary:');
  console.log('   - Heavy rehab investor (distressed properties)');
  console.log('   - Recently pivoted to quick flips (turnkey properties)');
  console.log('   - Works with realtor partner for listings');
  console.log('   - Has contractor network for rehabs');
  console.log('   - Cash buyer (can close quickly)');
  console.log('   - Looking for 25-35% equity opportunities');
  console.log('   - Prefers foreclosures, vacant, and tax delinquent properties');
  console.log('');
  console.log('🎯 This profile will generate PERSONALIZED leads matching:');
  console.log('   ✅ Distressed properties ($75k-$250k with $15k-$80k repair needs)');
  console.log('   ✅ Quick flip opportunities (already renovated, good equity)');
  console.log('   ✅ Foreclosure/pre-foreclosure listings');
  console.log('   ✅ Vacant and tax delinquent properties');
  console.log('   ✅ Absentee owner properties (easier negotiations)');
  console.log('');
}

seedJacksonvilleInvestor().catch(console.error);
