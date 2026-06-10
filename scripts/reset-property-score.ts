import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetScore() {
  // Property unique key is (userId, address, city, state, zip) — this dev
  // script has no user context, so locate the row by address fields instead.
  const target = await prisma.property.findFirst({
    where: {
      address: '123 Main St',
      city: 'Miami',
      state: 'FL',
      zip: '33101'
    },
    select: { id: true }
  });
  if (!target) {
    console.log('❌ Property not found: 123 Main St, Miami, FL 33101');
    return;
  }
  const property = await prisma.property.update({
    where: { id: target.id },
    data: {
      score: null,
      scoredAt: null,
      scoreBreakdown: null
    }
  });

  console.log(`✅ Reset score for property: ${property.address}, ${property.city}, ${property.state}`);
  console.log(`   Foreclosure: ${property.foreclosure}, Tax Delinquent: ${property.taxDelinquent}`);
  console.log(`   Property is now unscored and ready for the scoring workflow!`);

  await prisma.$disconnect();
}

resetScore();
