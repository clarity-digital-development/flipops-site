import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createTestBudgetData() {
  console.log('🏗️  Creating test budget data...\n');

  try {
    // DealSpec.userId is required — own test rows via the local seed user.
    const owner = await prisma.user.upsert({
      where: { email: 'seed@flipops.local' },
      update: {},
      create: { email: 'seed@flipops.local', name: 'Seed User', targetMarkets: '[]' },
    });
    // Get all existing deals
    const deals = await prisma.dealSpec.findMany({
      include: {
        budgetLedger: true,
      },
    });

    console.log(`Found ${deals.length} deals\n`);

    if (deals.length === 0) {
      console.log('⚠️  No deals found. Creating sample deals first...\n');

      // Create sample deals
      const sampleDeals = [
        {
          address: '123 Main St, Miami, FL',
          type: 'SFH',
          maxExposureUsd: 150000,
          targetRoiPct: 25,
          arv: 250000,
          region: 'Miami',
          grade: 'Standard',
          dailyBurnUsd: 500,
          constraints: JSON.stringify([]),
        },
        {
          address: '456 Oak Ave, Miami, FL',
          type: 'Multi-family',
          maxExposureUsd: 300000,
          targetRoiPct: 30,
          arv: 500000,
          region: 'Miami',
          grade: 'Premium',
          dailyBurnUsd: 1000,
          constraints: JSON.stringify([]),
        },
        {
          address: '789 Pine Rd, Miami, FL',
          type: 'SFH',
          maxExposureUsd: 200000,
          targetRoiPct: 28,
          arv: 350000,
          region: 'Miami',
          grade: 'Standard',
          dailyBurnUsd: 600,
          constraints: JSON.stringify([]),
        },
        {
          address: '321 Elm St, Miami, FL',
          type: 'Commercial',
          maxExposureUsd: 500000,
          targetRoiPct: 35,
          arv: 800000,
          region: 'Miami',
          grade: 'Luxury',
          dailyBurnUsd: 2000,
          constraints: JSON.stringify([]),
        },
      ];

      for (const dealData of sampleDeals) {
        await prisma.dealSpec.create({ data: { ...dealData, userId: owner.id } });
      }

      console.log('✅ Created 4 sample deals\n');

      // Refetch deals
      const newDeals = await prisma.dealSpec.findMany({
        include: { budgetLedger: true },
      });

      deals.push(...newDeals);
    }

    // Create budget ledgers with different scenarios
    const scenarios = [
      {
        name: 'Healthy - Under Budget',
        actualsMultiplier: 0.6, // 60% spent
        description: 'Project is healthy, well under budget',
      },
      {
        name: 'Warning - Approaching Budget',
        actualsMultiplier: 0.85, // 85% spent
        description: 'Project approaching budget threshold',
      },
      {
        name: 'Critical - Over Budget',
        actualsMultiplier: 1.15, // 115% spent
        description: 'Project has exceeded budget',
      },
      {
        name: 'Critical - Way Over Budget',
        actualsMultiplier: 1.4, // 140% spent
        description: 'Project significantly over budget',
      },
    ];

    for (let i = 0; i < Math.min(deals.length, scenarios.length); i++) {
      const deal = deals[i];
      const scenario = scenarios[i];

      const baseline = deal.maxExposureUsd;
      const actuals = Math.round(baseline * scenario.actualsMultiplier);
      const committed = Math.round(baseline * 0.9); // Assume 90% committed

      // Create budget breakdown by trade
      const baselineTrades = {
        HVAC: Math.round(baseline * 0.15),
        Plumbing: Math.round(baseline * 0.12),
        Electrical: Math.round(baseline * 0.13),
        Framing: Math.round(baseline * 0.20),
        Roofing: Math.round(baseline * 0.10),
        Other: Math.round(baseline * 0.30),
      };

      const actualsTrades = Object.fromEntries(
        Object.entries(baselineTrades).map(([trade, value]) => [
          trade,
          Math.round(value * scenario.actualsMultiplier),
        ])
      );

      const committedTrades = Object.fromEntries(
        Object.entries(baselineTrades).map(([trade, value]) => [
          trade,
          Math.round(value * 0.9),
        ])
      );

      const varianceTrades = Object.fromEntries(
        Object.entries(baselineTrades).map(([trade, value]) => [
          trade,
          actualsTrades[trade] - value,
        ])
      );

      // Create or update budget ledger
      if (deal.budgetLedger) {
        await prisma.budgetLedger.update({
          where: { dealId: deal.id },
          data: {
            baseline: JSON.stringify(baselineTrades),
            committed: JSON.stringify(committedTrades),
            actuals: JSON.stringify(actualsTrades),
            variance: JSON.stringify(varianceTrades),
            contingencyRemaining: Math.max(0, baseline - actuals),
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.budgetLedger.create({
          data: {
            dealId: deal.id,
            baseline: JSON.stringify(baselineTrades),
            committed: JSON.stringify(committedTrades),
            actuals: JSON.stringify(actualsTrades),
            variance: JSON.stringify(varianceTrades),
            contingencyRemaining: Math.max(0, baseline - actuals),
          },
        });
      }

      const utilization = ((actuals / baseline) * 100).toFixed(1);
      console.log(`✅ ${scenario.name}`);
      console.log(`   Deal: ${deal.address}`);
      console.log(`   Budget: $${baseline.toLocaleString()}`);
      console.log(`   Actuals: $${actuals.toLocaleString()}`);
      console.log(`   Utilization: ${utilization}%`);
      console.log(`   ${scenario.description}\n`);
    }

    console.log('✅ Test budget data created successfully!\n');
    console.log('📊 Budget Status Summary:');
    console.log('   • 1 Healthy project (< 80%)');
    console.log('   • 1 Warning project (80-100%)');
    console.log('   • 2 Critical projects (> 100%)\n');
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestBudgetData();
