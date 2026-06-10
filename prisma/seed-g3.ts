import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedG3() {
  console.log('🌱 Seeding G3 test data...');

  // Get the existing safe deal (from previous seed)
  let safeDeal = await prisma.dealSpec.findFirst({
    where: { id: 'cmfw2sw5r000dmfw4bcqpg3o8' }  // Use the actual ID from our previous seed
  });

  // If not found by ID, try by address pattern
  if (!safeDeal) {
    safeDeal = await prisma.dealSpec.findFirst({
      where: { address: { contains: 'Main St' } }
    });
  }

  if (!safeDeal) {
    console.error('❌ Safe deal not found. Please run the main seed first.');
    return;
  }

  console.log(`Using deal: ${safeDeal.id}`);

  // Create/update budget ledger with realistic baselines.
  // BudgetLedger stores trade maps as JSON strings.
  const baselineMap = {
    Roofing: 30000,
    HVAC: 20000,
    Electrical: 15000,
    Plumbing: 10000,
    Flooring: 12000,
    Kitchen: 18000,
    Bathroom: 15000,
    Painting: 5000,
    total: 125000
  };
  const committedMap = {
    Roofing: 28500,    // Some bids awarded
    HVAC: 19000,
    Electrical: 0,      // Not awarded yet
    Plumbing: 0,
    Flooring: 11500,
    Kitchen: 0,
    Bathroom: 0,
    Painting: 0,
    total: 59000
  };
  const budgetLedger = await prisma.budgetLedger.upsert({
    where: { dealId: safeDeal.id },
    update: {
      baseline: JSON.stringify(baselineMap),
      committed: JSON.stringify(committedMap),
      actuals: '{}',  // Start fresh for testing
      variance: '{}',
      contingencyRemaining: 12500  // 10% of baseline
    },
    create: {
      dealId: safeDeal.id,
      baseline: JSON.stringify(baselineMap),
      committed: JSON.stringify(committedMap),
      actuals: '{}',
      variance: '{}',
      contingencyRemaining: 12500
    }
  });

  console.log('✅ Budget ledger created/updated with baselines');

  // Get vendors for creating test invoices
  let vendors = await prisma.vendor.findMany({ take: 3 });

  // If not enough vendors, create some
  if (vendors.length < 3) {
    console.log('Creating test vendors...');

    const vendor1 = await prisma.vendor.create({
      data: {
        name: 'Test HVAC Contractor',
        trade: JSON.stringify(['HVAC']),
        region: 'Miami'
      }
    });

    const vendor2 = await prisma.vendor.create({
      data: {
        name: 'Test Roofing Co',
        trade: JSON.stringify(['Roofing']),
        region: 'Miami'
      }
    });

    const vendor3 = await prisma.vendor.create({
      data: {
        name: 'Test General Contractor',
        trade: JSON.stringify(['General', 'Landscaping']),
        region: 'Miami'
      }
    });

    vendors = [vendor1, vendor2, vendor3];
  }

  console.log('\n📊 Budget Baselines:');
  console.log('====================');
  console.log('Roofing:     $30,000 (committed: $28,500)');
  console.log('HVAC:        $20,000 (committed: $19,000)');
  console.log('Electrical:  $15,000 (no commitment yet)');
  console.log('Plumbing:    $10,000 (no commitment yet)');
  console.log('Flooring:    $12,000 (committed: $11,500)');
  console.log('Kitchen:     $18,000 (no commitment yet)');
  console.log('Bathroom:    $15,000 (no commitment yet)');
  console.log('Painting:     $5,000 (no commitment yet)');
  console.log('-------------------');
  console.log('Total:      $125,000 (committed: $59,000)');
  console.log('Contingency: $12,500');

  console.log('\n🧪 Test Scenarios:');
  console.log('==================');

  console.log('\n1️⃣ GREEN Tier (< 3% variance):');
  console.log('--------------------------------');
  console.log('HVAC invoice for $500 = 2.6% of $19,000 committed');
  console.log(`curl -X POST http://localhost:3001/api/invoices/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"dealId":"${safeDeal.id}","trade":"HVAC","amount":500,"vendorId":"${vendors[0].id}"}'`);

  console.log('\n2️⃣ TIER 1 (3-7% variance):');
  console.log('---------------------------');
  console.log('HVAC invoice for $800 = 4.2% over $19,000 committed');
  console.log(`curl -X POST http://localhost:3001/api/invoices/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"dealId":"${safeDeal.id}","trade":"HVAC","amount":800,"vendorId":"${vendors[0].id}"}'`);

  console.log('\n3️⃣ TIER 2 (>7% variance):');
  console.log('--------------------------');
  console.log('HVAC invoice for $1,500 = 7.9% over $19,000 committed');
  console.log(`curl -X POST http://localhost:3001/api/invoices/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"dealId":"${safeDeal.id}","trade":"HVAC","amount":1500,"vendorId":"${vendors[0].id}"}'`);

  console.log('\n4️⃣ No Budget Scenario:');
  console.log('-----------------------');
  console.log('Landscaping invoice (not in budget) = automatic TIER 2');
  console.log(`curl -X POST http://localhost:3001/api/invoices/ingest \\
  -H "Content-Type: application/json" \\
  -d '{"dealId":"${safeDeal.id}","trade":"Landscaping","amount":2000,"vendorId":"${vendors[1].id}"}'`);

  console.log('\n5️⃣ Progressive Variance (accumulating):');
  console.log('---------------------------------------');
  console.log('Multiple Roofing invoices to show progression:');
  console.log('  - First $27,000 (within committed)');
  console.log('  - Then $1,000 more (3.5% over)');
  console.log('  - Then $1,500 more (8.8% over)');

  console.log('\n✅ G3 test data ready!');
}

seedG3()
  .catch((e) => {
    console.error('Error seeding G3:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });