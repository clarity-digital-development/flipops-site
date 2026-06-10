/**
 * Verify PostgreSQL data is correct
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  console.log('🔍 Verifying PostgreSQL data...\n');

  try {
    // Get Jacksonville investor
    const jacksonville = await prisma.user.findUnique({
      where: { id: 'test-investor-jacksonville' }
    });

    if (!jacksonville) {
      console.error('❌ Jacksonville investor not found!');
      return;
    }

    console.log('✅ Jacksonville investor found in PostgreSQL:\n');
    console.log(`   Name: ${jacksonville.name}`);
    console.log(`   Email: ${jacksonville.email}`);
    console.log(`   Min Score: ${jacksonville.minScore}`);

    const profile = JSON.parse(jacksonville.investorProfile as string);
    console.log(`   Price Range: $${profile.priceRanges[0].min.toLocaleString()}-$${profile.priceRanges[profile.priceRanges.length - 1].max.toLocaleString()}`);
    console.log(`   Year Built: ${profile.preferredCharacteristics.preferredYearBuilt.min}-${profile.preferredCharacteristics.preferredYearBuilt.max}`);
    console.log(`   Min Sqft: ${profile.preferredCharacteristics.minSquareFeet}`);
    console.log(`   Min Bedrooms: ${profile.preferredCharacteristics.minBedrooms}\n`);

    // Count all records
    const userCount = await prisma.user.count();
    const propertyCount = await prisma.property.count();
    const dealCount = await prisma.dealSpec.count();

    console.log('📊 Total Records in PostgreSQL:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Properties: ${propertyCount}`);
    console.log(`   Deals: ${dealCount}\n`);

    console.log('✅ PostgreSQL data verified successfully!');
    console.log('   Database connection string: ' + process.env.DATABASE_URL?.substring(0, 50) + '...\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyData().catch(console.error);
