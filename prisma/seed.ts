import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Policy is unique on (userId, region, grade) and the global default rows have
// userId = null, which Prisma cannot address via upsert/findUnique. Find-or-
// create instead (update branch was a no-op anyway).
async function ensureGlobalPolicy(data: {
  region: string;
  grade: string;
  maxExposureUsd: number;
  targetRoiPct: number;
  contingencyTargetPct: number;
  varianceTier1Pct: number;
  varianceTier2Pct: number;
  bidSpreadMaxPct: number;
  coSlaHours: number;
  updatedBy: string;
}) {
  const existing = await prisma.policy.findFirst({
    where: { userId: null, region: data.region, grade: data.grade },
  });
  if (existing) return existing;
  return prisma.policy.create({ data });
}

async function main() {
  console.log('Seeding database...');

  // Seed owner for multi-tenant rows (DealSpec.userId is required).
  const seedUser = await prisma.user.upsert({
    where: { email: 'seed@flipops.local' },
    update: {},
    create: {
      email: 'seed@flipops.local',
      name: 'Seed User',
      targetMarkets: '[]',
    },
  });

  // Create policies for Miami region (all grades)
  const policies = await Promise.all([
    ensureGlobalPolicy({
      region: 'Miami',
      grade: 'Standard',
      maxExposureUsd: 150000,
      targetRoiPct: 20,
      contingencyTargetPct: 10,
      varianceTier1Pct: 3,
      varianceTier2Pct: 7,
      bidSpreadMaxPct: 15,
      coSlaHours: 48,
      updatedBy: 'system:seed'
    }),
    ensureGlobalPolicy({
      region: 'Miami',
      grade: 'Premium',
      maxExposureUsd: 250000,
      targetRoiPct: 22,
      contingencyTargetPct: 12,
      varianceTier1Pct: 3,
      varianceTier2Pct: 7,
      bidSpreadMaxPct: 15,
      coSlaHours: 48,
      updatedBy: 'system:seed'
    }),
    ensureGlobalPolicy({
      region: 'Miami',
      grade: 'Luxury',
      maxExposureUsd: 500000,
      targetRoiPct: 25,
      contingencyTargetPct: 15,
      varianceTier1Pct: 3,
      varianceTier2Pct: 7,
      bidSpreadMaxPct: 15,
      coSlaHours: 48,
      updatedBy: 'system:seed'
    })
  ]);

  console.log(`Created ${policies.length} policies`);

  // Create cost models for Miami region
  const costModels = await prisma.costModel.createMany({
    data: [
      // Roofing
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Roofing',
        task: 'Shingle Replacement',
        unit: 'sqft',
        material: 3.5,
        labor: 2.5,
        contingencyPct: 10,
        riskPremiumPct: 5,
        source: 'RS Means 2024'
      },
      {
        region: 'Miami',
        grade: 'Premium',
        trade: 'Roofing',
        task: 'Tile Replacement',
        unit: 'sqft',
        material: 8.5,
        labor: 4.5,
        contingencyPct: 12,
        riskPremiumPct: 7,
        source: 'RS Means 2024'
      },
      // Kitchen
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Kitchen',
        task: 'Full Renovation',
        unit: 'job',
        material: 8000,
        labor: 7000,
        contingencyPct: 15,
        riskPremiumPct: 8,
        source: 'Historical Data'
      },
      {
        region: 'Miami',
        grade: 'Premium',
        trade: 'Kitchen',
        task: 'Full Renovation',
        unit: 'job',
        material: 20000,
        labor: 15000,
        contingencyPct: 15,
        riskPremiumPct: 10,
        source: 'Historical Data'
      },
      // Bathroom
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Bathroom',
        task: 'Full Remodel',
        unit: 'each',
        material: 3000,
        labor: 2500,
        contingencyPct: 12,
        riskPremiumPct: 6,
        source: 'Historical Data'
      },
      // Flooring
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Flooring',
        task: 'LVP Installation',
        unit: 'sqft',
        material: 2.5,
        labor: 2.0,
        contingencyPct: 8,
        riskPremiumPct: 4,
        source: 'Vendor Quotes'
      },
      // Painting
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Painting',
        task: 'Interior Paint',
        unit: 'sqft',
        material: 0.5,
        labor: 1.0,
        contingencyPct: 5,
        riskPremiumPct: 3,
        source: 'Vendor Quotes'
      },
      // HVAC
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'HVAC',
        task: 'System Replacement',
        unit: 'ton',
        material: 1800,
        labor: 1200,
        contingencyPct: 10,
        riskPremiumPct: 5,
        source: 'Vendor Quotes'
      },
      // Electrical
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Electrical',
        task: 'Panel Upgrade',
        unit: 'job',
        material: 1500,
        labor: 1500,
        contingencyPct: 10,
        riskPremiumPct: 5,
        source: 'RS Means 2024'
      },
      // Plumbing
      {
        region: 'Miami',
        grade: 'Standard',
        trade: 'Plumbing',
        task: 'Re-pipe',
        unit: 'fixture',
        material: 300,
        labor: 400,
        contingencyPct: 12,
        riskPremiumPct: 6,
        source: 'RS Means 2024'
      }
    ]
  });

  console.log(`Created ${costModels.count} cost models`);

  // Create a safe deal that passes G1
  const safeDeal = await prisma.dealSpec.create({
    data: {
      userId: seedUser.id,
      address: '123 Safe Street, Miami, FL 33130',
      type: 'SFH',
      maxExposureUsd: 250000,
      targetRoiPct: 20,
      constraints: JSON.stringify({
        maxDaysToClose: 30,
        cashOnly: true,
        noContingencies: true
      })
    }
  });

  console.log(`Created safe deal: ${safeDeal.id}`);

  // Create scope nodes for safe deal
  await prisma.scopeTreeNode.createMany({
    data: [
      {
        dealId: safeDeal.id,
        trade: 'Roofing',
        task: 'Shingle Replacement',
        quantity: { value: 1500, unit: 'sqft', method: 'measured' },
        finishLvl: 'Standard',
        assumptions: ['Existing decking in good condition', 'No structural repairs needed']
      },
      {
        dealId: safeDeal.id,
        trade: 'Kitchen',
        task: 'Full Renovation',
        quantity: { value: 1, unit: 'job', method: 'estimated' },
        finishLvl: 'Standard',
        assumptions: ['Keep existing layout', 'Mid-range appliances']
      },
      {
        dealId: safeDeal.id,
        trade: 'Bathroom',
        task: 'Full Remodel',
        quantity: { value: 2, unit: 'each', method: 'counted' },
        finishLvl: 'Standard',
        assumptions: ['Standard fixtures', 'Tile surround']
      },
      {
        dealId: safeDeal.id,
        trade: 'Flooring',
        task: 'LVP Installation',
        quantity: { value: 1200, unit: 'sqft', method: 'measured' },
        finishLvl: 'Standard',
        assumptions: ['Level subfloor', 'No moisture issues']
      },
      {
        dealId: safeDeal.id,
        trade: 'Painting',
        task: 'Interior Paint',
        quantity: { value: 1800, unit: 'sqft', method: 'calculated' },
        finishLvl: 'Standard',
        assumptions: ['2 coats', 'Neutral colors']
      }
    ]
  });

  // Create initial budget ledger for safe deal
  await prisma.budgetLedger.create({
    data: {
      dealId: safeDeal.id,
      baseline: JSON.stringify({
        Roofing: 9000,
        Kitchen: 15000,
        Bathroom: 11000,
        Flooring: 5400,
        Painting: 2700,
        total: 43100
      }),
      committed: '{}',
      actuals: '{}',
      variance: '{}',
      contingencyRemaining: 6465 // 15% of baseline
    }
  });

  // Create a risky deal that violates G1
  const riskyDeal = await prisma.dealSpec.create({
    data: {
      userId: seedUser.id,
      address: '456 Risky Avenue, Miami, FL 33131',
      type: 'SFH',
      maxExposureUsd: 150000,
      targetRoiPct: 30,
      constraints: JSON.stringify({
        maxDaysToClose: 45,
        cashOnly: false,
        noContingencies: false
      })
    }
  });

  console.log(`Created risky deal: ${riskyDeal.id}`);

  // Create scope nodes for risky deal (more expensive)
  await prisma.scopeTreeNode.createMany({
    data: [
      {
        dealId: riskyDeal.id,
        trade: 'Roofing',
        task: 'Tile Replacement',
        quantity: { value: 2000, unit: 'sqft', method: 'estimated' },
        finishLvl: 'Premium',
        assumptions: ['May need decking replacement', 'Potential structural issues']
      },
      {
        dealId: riskyDeal.id,
        trade: 'Kitchen',
        task: 'Full Renovation',
        quantity: { value: 1, unit: 'job', method: 'estimated' },
        finishLvl: 'Premium',
        assumptions: ['Layout changes needed', 'High-end appliances']
      },
      {
        dealId: riskyDeal.id,
        trade: 'Bathroom',
        task: 'Full Remodel',
        quantity: { value: 3, unit: 'each', method: 'counted' },
        finishLvl: 'Premium',
        assumptions: ['Premium fixtures', 'Custom tile work']
      },
      {
        dealId: riskyDeal.id,
        trade: 'HVAC',
        task: 'System Replacement',
        quantity: { value: 4, unit: 'ton', method: 'calculated' },
        finishLvl: 'Standard',
        assumptions: ['Ductwork replacement needed', 'Zoning system']
      },
      {
        dealId: riskyDeal.id,
        trade: 'Electrical',
        task: 'Panel Upgrade',
        quantity: { value: 1, unit: 'job', method: 'estimated' },
        finishLvl: 'Standard',
        assumptions: ['200 amp service', 'Some rewiring needed']
      }
    ]
  });

  // Create initial budget ledger for risky deal
  await prisma.budgetLedger.create({
    data: {
      dealId: riskyDeal.id,
      baseline: JSON.stringify({
        Roofing: 26000,
        Kitchen: 35000,
        Bathroom: 25000,
        HVAC: 12000,
        Electrical: 3000,
        total: 101000
      }),
      committed: '{}',
      actuals: '{}',
      variance: '{}',
      contingencyRemaining: 15150 // 15% of baseline
    }
  });

  // Create sample vendors
  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'Miami Roofing Pros',
      email: 'contact@miamiroofing.com',
      phone: '(305) 555-0100',
      trade: JSON.stringify(['Roofing']),
      region: 'Miami',
      onTimePct: 95,
      onBudgetPct: 92,
      reliability: 93.5
    }
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'Complete Home Renovations',
      email: 'info@completereno.com',
      phone: '(305) 555-0200',
      trade: JSON.stringify(['Kitchen', 'Bathroom', 'Flooring']),
      region: 'Miami',
      onTimePct: 88,
      onBudgetPct: 85,
      reliability: 86.5
    }
  });

  console.log(`Created vendors: ${vendor1.id}, ${vendor2.id}`);

  // Create bids for safe deal with >15% spread (will trigger G2)
  await prisma.bid.createMany({
    data: [
      {
        dealId: safeDeal.id,
        vendorId: vendor1.id,
        items: JSON.stringify([
          { trade: 'Roofing', task: 'Shingle Replacement', quantity: { value: 1500, unit: 'sqft' }, unitPrice: 6, totalPrice: 9000 }
        ]),
        subtotal: 9000,
        includes: ['Materials', 'Labor', 'Permits'],
        excludes: ['Structural repairs'],
        status: 'pending'
      },
      {
        dealId: safeDeal.id,
        vendorId: vendor2.id,
        items: JSON.stringify([
          { trade: 'Roofing', task: 'Shingle Replacement', quantity: { value: 1500, unit: 'sqft' }, unitPrice: 7.8, totalPrice: 11700 }
        ]),
        subtotal: 11700,
        includes: ['Materials', 'Labor', 'Permits', 'Warranty'],
        excludes: ['Structural repairs'],
        status: 'pending'
      }
    ]
  });

  console.log('Created sample bids with >15% spread');

  // Create additional bids for G2 testing
  // SAFE bids - low spread (<15%)
  const safeBids = await Promise.all([
    prisma.bid.create({
      data: {
        dealId: safeDeal.id,
        vendorId: vendor1.id,
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Shingle Replacement',
            quantity: { value: 15, unit: 'square' }, // 15 squares = 1500 sqft
            unitPrice: 600,
            totalPrice: 9000,
            includes: ['Materials', 'Labor', 'Permits'],
            excludes: ['Structural repairs']
          }
        ]),
        subtotal: 9000,
        includes: ['Materials', 'Labor', 'Permits', '2-year warranty'],
        excludes: ['Structural repairs', 'Decking replacement'],
        status: 'pending'
      }
    }),
    prisma.bid.create({
      data: {
        dealId: safeDeal.id,
        vendorId: vendor2.id,
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Shingle Replacement',
            quantity: { value: 1500, unit: 'sqft' }, // Same scope, different unit
            unitPrice: 6.3,
            totalPrice: 9450,
            includes: ['Materials', 'Labor'],
            excludes: ['Permits', 'Structural repairs']
          }
        ]),
        subtotal: 9450,
        includes: ['Materials', 'Labor', '1-year warranty'],
        excludes: ['Permits', 'Structural repairs'],
        status: 'pending'
      }
    }),
    prisma.bid.create({
      data: {
        dealId: safeDeal.id,
        vendorId: 'vendor-3',
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Shingle Replacement',
            quantity: { value: 1500, unit: 'sf' }, // Another unit variation
            unitPrice: 6.6,
            totalPrice: 9900,
            includes: ['Materials', 'Labor', 'Permits'],
            excludes: ['Structural repairs']
          }
        ]),
        subtotal: 9900,
        includes: ['Materials', 'Labor', 'Permits', '3-year warranty'],
        excludes: ['Structural repairs'],
        status: 'pending'
      }
    })
  ]);

  console.log(`Created ${safeBids.length} safe bids with <15% spread`);
  console.log('Safe bid IDs:', safeBids.map(b => b.id));

  // RISKY bids - high spread (>15%)
  const riskyBids = await Promise.all([
    prisma.bid.create({
      data: {
        dealId: riskyDeal.id,
        vendorId: vendor1.id,
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Tile Replacement',
            quantity: { value: 20, unit: 'squares' }, // 20 squares = 2000 sqft
            unitPrice: 1200,
            totalPrice: 24000,
            includes: ['Basic materials', 'Labor'],
            excludes: ['Premium tiles', 'Permits', 'Warranty']
          }
        ]),
        subtotal: 24000,
        includes: ['Basic materials', 'Labor'],
        excludes: ['Premium tiles', 'Permits', 'Extended warranty'],
        status: 'pending'
      }
    }),
    prisma.bid.create({
      data: {
        dealId: riskyDeal.id,
        vendorId: vendor2.id,
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Tile Replacement',
            quantity: { value: 2000, unit: 'sqft' },
            unitPrice: 14,
            totalPrice: 28000,
            includes: ['Materials', 'Labor', 'Permits'],
            excludes: ['Structural work']
          }
        ]),
        subtotal: 28000,
        includes: ['Standard materials', 'Labor', 'Permits'],
        excludes: ['Structural reinforcement'],
        status: 'pending'
      }
    }),
    prisma.bid.create({
      data: {
        dealId: riskyDeal.id,
        vendorId: 'vendor-premium',
        items: JSON.stringify([
          {
            trade: 'Roofing',
            task: 'Tile Replacement',
            quantity: { value: 2000, unit: 'square feet' },
            unitPrice: 17,
            totalPrice: 34000,
            includes: ['Premium materials', 'Expert labor', 'All permits', '10-year warranty'],
            excludes: []
          }
        ]),
        subtotal: 34000,
        includes: ['Premium materials', 'Expert installation', 'All permits', '10-year warranty'],
        excludes: [],
        status: 'pending'
      }
    })
  ]);

  console.log(`Created ${riskyBids.length} risky bids with >15% spread`);
  console.log('Risky bid IDs:', riskyBids.map(b => b.id));

  // Calculate and display spreads for verification
  const safeSubtotals = safeBids.map(b => b.subtotal).sort((a, b) => a - b);
  const safeMedian = safeSubtotals[Math.floor(safeSubtotals.length / 2)];
  const safeSpread = ((Math.max(...safeSubtotals) - Math.min(...safeSubtotals)) / safeMedian) * 100;
  console.log(`Safe bids spread: ${safeSpread.toFixed(1)}% (should be <15%)`);

  const riskySubtotals = riskyBids.map(b => b.subtotal).sort((a, b) => a - b);
  const riskyMedian = riskySubtotals[Math.floor(riskySubtotals.length / 2)];
  const riskySpread = ((Math.max(...riskySubtotals) - Math.min(...riskySubtotals)) / riskyMedian) * 100;
  console.log(`Risky bids spread: ${riskySpread.toFixed(1)}% (should be >15%)`);

  // Create initial events
  await prisma.event.createMany({
    data: [
      {
        dealId: safeDeal.id,
        actor: 'system',
        artifact: 'DealSpec',
        action: 'CREATE',
        checksum: 'abc123' + Date.now(),
        diff: JSON.stringify({ op: 'add', path: '/', value: { id: safeDeal.id } })
      },
      {
        dealId: riskyDeal.id,
        actor: 'system',
        artifact: 'DealSpec',
        action: 'CREATE',
        checksum: 'def456' + Date.now(),
        diff: JSON.stringify({ op: 'add', path: '/', value: { id: riskyDeal.id } })
      }
    ]
  });

  // Create a panel test deal with all required fields
  const panelTestDeal = await prisma.dealSpec.upsert({
    where: { id: "PANEL_TEST_DEAL_001" },
    update: {
      region: "Miami",
      grade: "Standard",
      startAt: new Date(Date.now() - 14 * 86400000), // 14 days ago
      dailyBurnUsd: 120,
      arv: 300000
    },
    create: {
      id: "PANEL_TEST_DEAL_001",
      userId: seedUser.id,
      address: '456 Panel Test Ave, Miami, FL 33140',
      type: 'SFH',
      maxExposureUsd: 150000,
      targetRoiPct: 20,
      region: "Miami",
      grade: "Standard",
      startAt: new Date(Date.now() - 14 * 86400000), // 14 days ago
      dailyBurnUsd: 120,
      arv: 300000,
      constraints: JSON.stringify({
        maxDaysToClose: 45,
        cashOnly: true
      })
    }
  });

  // Create scope nodes for panel test deal
  await prisma.scopeTreeNode.createMany({
    data: [
      {
        dealId: "PANEL_TEST_DEAL_001",
        trade: 'HVAC',
        task: 'System Replacement',
        quantity: { value: 1, unit: 'system', method: 'estimated' },
        finishLvl: 'Standard',
        assumptions: ['3-ton system', 'Existing ductwork usable']
      },
      {
        dealId: "PANEL_TEST_DEAL_001",
        trade: 'Plumbing',
        task: 'Full Repipe',
        quantity: { value: 2000, unit: 'lf', method: 'measured' },
        finishLvl: 'Standard',
        assumptions: ['PEX piping', 'No slab penetration']
      }
    ],
    skipDuplicates: true
  });

  // Create budget ledger for panel test deal
  await prisma.budgetLedger.upsert({
    where: { dealId: "PANEL_TEST_DEAL_001" },
    update: {},
    create: {
      dealId: "PANEL_TEST_DEAL_001",
      baseline: JSON.stringify({
        total: 100000,
        byTrade: {
          HVAC: 15000,
          Plumbing: 12000,
          Electrical: 10000,
          Kitchen: 25000,
          Bathroom: 15000,
          Flooring: 8000,
          Painting: 5000,
          Roofing: 10000
        }
      }),
      committed: JSON.stringify({
        total: 32000,
        byTrade: {
          HVAC: 15000,
          Plumbing: 12000,
          Electrical: 5000
        }
      }),
      actuals: JSON.stringify({
        total: 28000,
        byTrade: {
          HVAC: 14500,
          Plumbing: 11000,
          Electrical: 2500
        }
      }),
      variance: JSON.stringify({
        frozenTrades: []
      }),
      contingencyRemaining: 8000
    }
  });

  console.log(`Created panel test deal: ${panelTestDeal.id}`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });