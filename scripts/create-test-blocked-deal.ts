import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestBlockedDeal() {
  console.log('🧪 Creating test blocked deal event...\n');

  try {
    // 1. Find an existing deal to use
    const existingDeal = await prisma.dealSpec.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!existingDeal) {
      console.log('❌ No deals found. Creating a test deal first...');

      // DealSpec.userId is required — own test rows via the local seed user.
      const owner = await prisma.user.upsert({
        where: { email: 'seed@flipops.local' },
        update: {},
        create: { email: 'seed@flipops.local', name: 'Seed User', targetMarkets: '[]' },
      });

      // Create a test deal (DealSpec has no `mao` column — dropped)
      const testDeal = await prisma.dealSpec.create({
        data: {
          userId: owner.id,
          address: '5678 Desert View Dr, Phoenix, AZ',
          type: 'SFH',
          maxExposureUsd: 300000,
          targetRoiPct: 20,
          constraints: '[]'
        }
      });

      console.log('✅ Created test deal:', testDeal.address);

      // Use this deal
      const dealId = testDeal.id;
      await createBlockEvent(dealId, testDeal.address);

    } else {
      console.log('✅ Using existing deal:', existingDeal.address);
      await createBlockEvent(existingDeal.id, existingDeal.address);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createBlockEvent(dealId: string, address: string | null) {
  // Create a realistic BLOCK event
  const blockEvent = await prisma.event.create({
    data: {
      dealId: dealId,
      actor: 'system:G1',
      artifact: 'DealSpec',
      action: 'BLOCK',
      checksum: `test-block-${Date.now()}`,
      diff: JSON.stringify({
        reason: 'P80 exceeds max exposure',
        p80: 385000,           // Estimated cost
        maxExposureUsd: 300000, // Limit
        overBy: 85000,          // $85k over
        overByPct: 28.33,       // 28.33% over limit
        drivers: [
          {
            trade: 'HVAC',
            contribution: 42.5,
            reason: 'High uncertainty due to ductwork unknowns'
          },
          {
            trade: 'Foundation',
            contribution: 28.8,
            reason: 'Possible structural issues detected'
          },
          {
            trade: 'Plumbing',
            contribution: 18.2,
            reason: 'Full re-pipe required'
          },
          {
            trade: 'Electrical',
            contribution: 10.5,
            reason: 'Panel upgrade needed'
          }
        ]
      })
    }
  });

  console.log('\n✅ Created BLOCK event:');
  console.log(`   Deal: ${address || 'Unknown'}`);
  console.log(`   P80: $385,000`);
  console.log(`   Max Exposure: $300,000`);
  console.log(`   Over By: $85,000 (28.33%)`);
  console.log(`   Event ID: ${blockEvent.id}`);
  console.log('\n📊 Cost Drivers:');
  console.log('   1. HVAC: 42.5% (ductwork uncertainty)');
  console.log('   2. Foundation: 28.8% (structural issues)');
  console.log('   3. Plumbing: 18.2% (full re-pipe)');
  console.log('   4. Electrical: 10.5% (panel upgrade)');
  console.log('\n✅ Test data created successfully!');
  console.log('\n🔄 Now run the G1 workflow in n8n to see the Slack alert.');
  console.log('   Or wait for it to run automatically on its 12-hour schedule.\n');
}

createTestBlockedDeal();
