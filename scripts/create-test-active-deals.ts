import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function createTestActiveDeals() {
  try {
    console.log('🏠 Creating test active deals for Property Data Refresh...\n');

    // DealSpec.userId is required — own test rows via the local seed user.
    const owner = await prisma.user.upsert({
      where: { email: 'seed@flipops.local' },
      update: {},
      create: { email: 'seed@flipops.local', name: 'Seed User', targetMarkets: '[]' },
    });

    // Create 5 active deals with varying ARV values
    const deals = [
      {
        address: '1234 Market Street, Miami, FL',
        type: 'SFH',
        maxExposureUsd: 280000,
        targetRoiPct: 22.5,
        arv: 400000,
        region: 'Miami',
        grade: 'Standard',
        constraints: JSON.stringify([]),
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
      },
      {
        address: '5678 Ocean Drive, Miami Beach, FL',
        type: 'SFH',
        maxExposureUsd: 420000,
        targetRoiPct: 28.0,
        arv: 600000,
        region: 'Miami',
        grade: 'Premium',
        constraints: JSON.stringify([]),
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      },
      {
        address: '9012 Coral Way, Coral Gables, FL',
        type: 'SFH',
        maxExposureUsd: 350000,
        targetRoiPct: 25.0,
        arv: 500000,
        region: 'Miami',
        grade: 'Standard',
        constraints: JSON.stringify([]),
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
      },
      {
        address: '3456 Brickell Avenue, Miami, FL',
        type: 'Multi-family',
        maxExposureUsd: 560000,
        targetRoiPct: 30.0,
        arv: 800000,
        region: 'Miami',
        grade: 'Premium',
        constraints: JSON.stringify([]),
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      },
      {
        address: '7890 Sunset Drive, South Miami, FL',
        type: 'SFH',
        maxExposureUsd: 210000,
        targetRoiPct: 20.0,
        arv: 300000,
        region: 'Miami',
        grade: 'Standard',
        constraints: JSON.stringify([]),
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 days ago
      }
    ];

    // Create the deals
    for (const dealData of deals) {
      const deal = await prisma.dealSpec.create({
        data: { ...dealData, userId: owner.id }
      });
      console.log(`✅ Created deal: ${deal.address}`);
      console.log(`   ARV: $${deal.arv?.toLocaleString()}, Max Exposure: $${deal.maxExposureUsd.toLocaleString()}, Target ROI: ${deal.targetRoiPct}%`);

      // Create G1 APPROVE event for some deals to mark them as "active"
      if (Math.random() > 0.3) { // 70% chance of being approved
        const eventData = {
          artifact: 'DealSpec',
          dealId: deal.id,
          action: 'APPROVE',
          actor: 'system:G1'
        };
        const checksum = crypto
          .createHash('sha256')
          .update(JSON.stringify(eventData) + Date.now())
          .digest('hex');

        await prisma.event.create({
          data: {
            ...eventData,
            checksum
          }
        });
        console.log(`   ✅ Approved (active deal)`);
      } else {
        console.log(`   ⏳ Pending approval`);
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('✅ TEST ACTIVE DEALS CREATED!');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');

    const totalDeals = await prisma.dealSpec.count();
    const approvedEvents = await prisma.event.count({
      where: {
        artifact: 'DealSpec',
        action: 'APPROVE',
        actor: 'system:G1'
      }
    });

    console.log(`   • Total Deals: ${totalDeals}`);
    console.log(`   • Approved Deals: ${approvedEvents}`);
    console.log(`   • Pending Approval: ${deals.length - approvedEvents}`);

    console.log('\n🔧 Next Steps:');
    console.log('   1. Test the /api/deals/active endpoint:');
    console.log('      curl https://primary-production-8b46.up.railway.app/api/deals/active');
    console.log('   2. Open the Property Data Refresh workflow in n8n');
    console.log('   3. Update Slack webhook URLs');
    console.log('   4. Run Manual Trigger to test');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('   Details:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestActiveDeals();
