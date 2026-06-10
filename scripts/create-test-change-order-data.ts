import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestChangeOrderData() {
  console.log('📋 Creating test change order data...\n');

  try {
    // 1. Find existing deals to use for testing
    console.log('Finding existing deals...');
    const existingDeals = await prisma.dealSpec.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    if (existingDeals.length === 0) {
      console.log('❌ No deals found. Please create some deals first.');
      return;
    }

    const [deal1, deal2, deal3] = existingDeals;
    console.log(`✅ Found ${existingDeals.length} deals to use for testing\n`);

    // 2. Create test change orders
    console.log('Creating test change orders...');

    // Change Order 1: Approved - Small plumbing adjustment
    const co1 = await prisma.changeOrder.create({
      data: {
        dealId: deal1.id,
        trade: 'Plumbing',
        deltaUsd: 500,
        impactDays: 2,
        status: 'approved',
        rationale: 'Additional fixture required',
        simResults: {
          before: {
            totalCost: 50000,
            roiPct: 25.5,
            exposure: 57500
          },
          after: {
            totalCost: 50500,
            roiPct: 25.2,
            exposure: 58000
          },
          deltas: {
            costDelta: 500,
            roiDelta: -0.3,
            exposureDelta: 500
          }
        },
        decidedAt: new Date(),
        decidedBy: 'system:G4'
      }
    });

    // Change Order 2: Denied - Exceeds exposure limit
    const co2 = await prisma.changeOrder.create({
      data: {
        dealId: deal2.id,
        trade: 'HVAC',
        deltaUsd: 8000,
        impactDays: 5,
        status: 'denied',
        rationale: 'System upgrade needed due to code changes',
        simResults: {
          before: {
            totalCost: 75000,
            roiPct: 22.0,
            exposure: 86250
          },
          after: {
            totalCost: 83000,
            roiPct: 18.5,
            exposure: 95450
          },
          deltas: {
            costDelta: 8000,
            roiDelta: -3.5,
            exposureDelta: 9200
          },
          violations: {
            exposure: 'Exceeds maximum exposure limit',
            roi: 'ROI drops below target threshold'
          }
        },
        decidedAt: new Date(),
        decidedBy: 'system:G4'
      }
    });

    // Change Order 3: Approved - Electrical work
    const co3 = await prisma.changeOrder.create({
      data: {
        dealId: deal3.id,
        trade: 'Electrical',
        deltaUsd: 1200,
        impactDays: 1,
        status: 'approved',
        rationale: 'Add panel capacity for modern appliances',
        simResults: {
          before: {
            totalCost: 60000,
            roiPct: 24.0,
            exposure: 69000
          },
          after: {
            totalCost: 61200,
            roiPct: 23.5,
            exposure: 70380
          },
          deltas: {
            costDelta: 1200,
            roiDelta: -0.5,
            exposureDelta: 1380
          }
        },
        decidedAt: new Date(),
        decidedBy: 'system:G4'
      }
    });

    // Change Order 4: Denied - Timeline impact too high
    const co4 = await prisma.changeOrder.create({
      data: {
        dealId: deal1.id,
        trade: 'Foundation',
        deltaUsd: 5000,
        impactDays: 10,
        status: 'denied',
        rationale: 'Structural repair discovered during inspection',
        simResults: {
          before: {
            totalCost: 50000,
            roiPct: 25.5,
            exposure: 57500
          },
          after: {
            totalCost: 55000,
            roiPct: 20.8,
            exposure: 63250
          },
          deltas: {
            costDelta: 5000,
            roiDelta: -4.7,
            exposureDelta: 5750
          },
          violations: {
            roi: 'ROI drops significantly below target',
            timeline: '10-day delay unacceptable'
          }
        },
        decidedAt: new Date(),
        decidedBy: 'system:G4'
      }
    });

    // Change Order 5: Proposed - Pending review
    const co5 = await prisma.changeOrder.create({
      data: {
        dealId: deal2.id,
        trade: 'Landscaping',
        deltaUsd: 2000,
        impactDays: 3,
        status: 'proposed',
        rationale: 'Enhance curb appeal for faster sale'
        // simResults intentionally omitted (defaults to NULL)
      }
    });

    console.log('✅ Created 5 test change orders\n');

    // 3. Create test events for change orders
    console.log('Creating change order events...');

    await prisma.event.create({
      data: {
        dealId: deal1.id,
        actor: 'system:G4',
        artifact: 'ChangeOrder',
        action: 'APPROVE_CO',
        checksum: 'test-checksum-co1',
        diff: JSON.stringify({
          changeOrderId: co1.id,
          trade: 'Plumbing',
          deltaUsd: 500,
          decision: 'APPROVED'
        })
      }
    });

    await prisma.event.create({
      data: {
        dealId: deal2.id,
        actor: 'system:G4',
        artifact: 'ChangeOrder',
        action: 'DENY_CO',
        checksum: 'test-checksum-co2',
        diff: JSON.stringify({
          changeOrderId: co2.id,
          trade: 'HVAC',
          deltaUsd: 8000,
          decision: 'DENIED',
          violations: {
            exposure: true,
            roi: true
          }
        })
      }
    });

    await prisma.event.create({
      data: {
        dealId: deal3.id,
        actor: 'system:G4',
        artifact: 'ChangeOrder',
        action: 'APPROVE_CO',
        checksum: 'test-checksum-co3',
        diff: JSON.stringify({
          changeOrderId: co3.id,
          trade: 'Electrical',
          deltaUsd: 1200,
          decision: 'APPROVED'
        })
      }
    });

    await prisma.event.create({
      data: {
        dealId: deal1.id,
        actor: 'system:G4',
        artifact: 'ChangeOrder',
        action: 'DENY_CO',
        checksum: 'test-checksum-co4',
        diff: JSON.stringify({
          changeOrderId: co4.id,
          trade: 'Foundation',
          deltaUsd: 5000,
          decision: 'DENIED',
          violations: {
            roi: true,
            timeline: true
          }
        })
      }
    });

    console.log('✅ Created 4 change order events\n');

    // 4. Summary
    console.log('=' .repeat(70));
    console.log('✅ TEST DATA CREATED SUCCESSFULLY!\n');
    console.log('Summary:');
    console.log(`  • Change Orders: 5`);
    console.log(`    - Approved: 2`);
    console.log(`    - Denied: 2`);
    console.log(`    - Proposed (Pending): 1`);
    console.log(`  • Events: 4\n`);

    console.log('Test Scenarios Created:');
    console.log(`  1. ${deal1.address || 'Deal 1'}:`);
    console.log(`     - Plumbing CO: $500 (APPROVED)`);
    console.log(`     - Foundation CO: $5,000 (DENIED - ROI drop & timeline)\n`);

    console.log(`  2. ${deal2.address || 'Deal 2'}:`);
    console.log(`     - HVAC CO: $8,000 (DENIED - Exposure & ROI violations)`);
    console.log(`     - Landscaping CO: $2,000 (PROPOSED - Pending review)\n`);

    console.log(`  3. ${deal3.address || 'Deal 3'}:`);
    console.log(`     - Electrical CO: $1,200 (APPROVED)\n`);

    console.log('Next Steps:');
    console.log('  1. Run the Change Order Gatekeeper workflow');
    console.log('  2. Check Slack for denied change order alerts');
    console.log('  3. Review the detailed simulation results and violations\n');

    console.log('=' .repeat(70));

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestChangeOrderData();
