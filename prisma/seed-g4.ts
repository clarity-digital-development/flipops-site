import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding G4 test data...');

  // Find or create a test deal with ARV
  const dealId = 'cmfw2sw5r000dmfw4bcqpg3o8'; // Same ID used in G3

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

  // Update the deal to include ARV and proper guardrails
  const deal = await prisma.dealSpec.upsert({
    where: { id: dealId },
    create: {
      id: dealId,
      userId: seedUser.id,
      address: '456 Budget St, Miami, FL 33133',
      type: 'SFH',
      maxExposureUsd: 150000,  // Max P80 exposure
      targetRoiPct: 15,         // Minimum ROI target
      arv: 300000,              // After Repair Value
      constraints: '[]' // JSON-string column
    },
    update: {
      arv: 300000,              // Add ARV to existing deal
      maxExposureUsd: 150000,   // Update guardrails
      targetRoiPct: 15
    }
  });

  console.log('✅ Deal updated with ARV:', {
    id: deal.id,
    arv: deal.arv,
    maxExposureUsd: deal.maxExposureUsd,
    targetRoiPct: deal.targetRoiPct
  });

  // Ensure budget ledger exists with baseline data
  const ledger = await prisma.budgetLedger.upsert({
    where: { dealId },
    create: {
      dealId,
      // BudgetLedger stores trade maps as JSON strings
      baseline: JSON.stringify({
        total: 125000,
        HVAC: 19000,
        Roofing: 25000,
        Electrical: 15000,
        Plumbing: 12000,
        Flooring: 18000,
        Painting: 11000,
        Kitchen: 25000
      }),
      committed: JSON.stringify({
        total: 59000,  // Committed from G2 awards
        HVAC: 19000,
        Roofing: 25000,
        Electrical: 15000
      }),
      actuals: JSON.stringify({
        total: 0  // Reset for clean testing
      }),
      variance: '{}',
      contingencyRemaining: 10000
    },
    update: {
      // Keep existing data
    }
  });

  console.log('✅ Budget ledger verified');

  // Clean up old test change orders (optional)
  await prisma.changeOrder.deleteMany({
    where: {
      dealId,
      status: 'proposed'
    }
  });
  console.log('🧹 Cleaned up old proposed change orders');

  // Calculate expected metrics for reference
  const totalBudget = 125000;
  const arv = 300000;
  const currentROI = ((arv - totalBudget) / totalBudget) * 100;
  const currentP80 = Math.round(totalBudget * 1.10); // ~137,500

  console.log('\n📊 Current Deal Metrics:');
  console.log('  - Total Budget: $' + totalBudget.toLocaleString());
  console.log('  - ARV: $' + arv.toLocaleString());
  console.log('  - Current ROI: ' + currentROI.toFixed(1) + '%');
  console.log('  - Current P80: $' + currentP80.toLocaleString());
  console.log('  - Max Exposure: $' + deal.maxExposureUsd.toLocaleString());
  console.log('  - Target ROI: ' + deal.targetRoiPct + '%');

  console.log('\n📝 Test Scenarios:');
  console.log('\n1. APPROVED (Small safe change):');
  console.log('   Delta: +$2,000 → P80: ~$139,700 → ROI: ~38%');
  console.log('   curl -X POST http://localhost:3001/api/change-orders/submit \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"dealId":"${dealId}","trade":"Electrical","deltaUsd":2000,"impactDays":0,"reason":"Additional outlets needed"}'`);

  console.log('\n2. DENIED (Exceeds max exposure):');
  console.log('   Delta: +$30,000 → P80: ~$170,500 → Exceeds $150k limit');
  console.log('   curl -X POST http://localhost:3001/api/change-orders/submit \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"dealId":"${dealId}","trade":"Electrical","deltaUsd":30000,"impactDays":7,"reason":"Complete rewiring required","evidence":["https://s3.aws.com/inspection-report.pdf"]}'`);

  console.log('\n3. DENIED (ROI drops below target):');
  console.log('   Delta: +$100,000 → ROI: ~11% → Below 15% target');
  console.log('   curl -X POST http://localhost:3001/api/change-orders/submit \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"dealId":"${dealId}","trade":"Foundation","deltaUsd":100000,"impactDays":30,"reason":"Foundation issues discovered"}'`);

  console.log('\n4. APPROVED (Cost savings):');
  console.log('   Delta: -$5,000 → P80 decreases → ROI increases');
  console.log('   curl -X POST http://localhost:3001/api/change-orders/submit \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"dealId":"${dealId}","trade":"Flooring","deltaUsd":-5000,"impactDays":0,"reason":"Found cheaper materials"}'`);

  console.log('\n✅ G4 test data seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding G4 data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });