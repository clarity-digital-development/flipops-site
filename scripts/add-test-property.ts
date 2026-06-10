import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestProperty() {
  try {
    // Property.userId is required — own test rows via the local seed user.
    const owner = await prisma.user.upsert({
      where: { email: 'seed@flipops.local' },
      update: {},
      create: { email: 'seed@flipops.local', name: 'Seed User', targetMarkets: '[]' },
    });
    const property = await prisma.property.create({
      data: {
        userId: owner.id,
        address: '123 Main St',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
        county: 'Miami-Dade',
        apn: '12-3456-789-0001',
        ownerName: 'John Doe',
        propertyType: 'single_family',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1500,
        lotSize: 5000,
        yearBuilt: 1985,
        assessedValue: 250000,
        taxAmount: 5000,
        estimatedValue: 275000,
        foreclosure: true,
        preForeclosure: false,
        taxDelinquent: true,
        vacant: false,
        bankruptcy: false,
        absenteeOwner: false,
        dataSource: 'test',
        sourceId: 'test-001',
        // No score set - this will be calculated by the scoring workflow
      },
    });

    console.log('✅ Test property created:');
    console.log(`   ID: ${property.id}`);
    console.log(`   Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}`);
    console.log(`   Flags: Foreclosure=${property.foreclosure}, TaxDelinquent=${property.taxDelinquent}`);
    console.log(`   Score: ${property.score || 'Not scored yet'}`);
    console.log(`\nThis property should be picked up by the scoring workflow!`);

  } catch (error) {
    console.error('❌ Failed to create test property:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addTestProperty();
