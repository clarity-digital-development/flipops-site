/**
 * Check what the API is returning for Jacksonville investor
 */

const FO_API_BASE_URL = 'http://localhost:3007';

async function checkAPIProfile() {
  console.log('🔍 Checking API response for Jacksonville investor...\n');

  try {
    const response = await fetch(`${FO_API_BASE_URL}/api/users/test-investor-jacksonville`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.user) {
      console.error('❌ No user found in response');
      return;
    }

    const user = data.user;
    console.log('📊 API Response Data:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Min Score: ${user.minScore}`);

    // Parse the investorProfile
    const profile = typeof user.investorProfile === 'string'
      ? JSON.parse(user.investorProfile)
      : user.investorProfile;

    if (!profile) {
      console.error('❌ No investorProfile found');
      return;
    }

    console.log('\n📋 Investor Profile Details:');
    console.log(`   Min Bedrooms: ${profile.preferredCharacteristics?.minBedrooms || 'NOT SET'}`);
    console.log(`   Min Square Feet: ${profile.preferredCharacteristics?.minSquareFeet || 'NOT SET'}`);
    console.log(`   Year Built Range: ${profile.preferredCharacteristics?.preferredYearBuilt?.min || 'NOT SET'}-${profile.preferredCharacteristics?.preferredYearBuilt?.max || 'NOT SET'}`);
    console.log(`   Price Ranges: ${profile.priceRanges?.length || 0} tiers`);

    if (profile.priceRanges && profile.priceRanges.length > 0) {
      console.log('\n💰 Price Ranges:');
      profile.priceRanges.forEach((range: any) => {
        console.log(`   - $${range.min.toLocaleString()}-$${range.max.toLocaleString()} (${range.label}, weight: ${range.weight})`);
      });
    }

    console.log('\n⚠️  PROBLEM CHECK:');
    if (user.minScore === 65) {
      console.log('   ❌ API is returning OLD minScore (65) - PostgreSQL not being used!');
    } else if (user.minScore === 50) {
      console.log('   ✅ API is returning NEW minScore (50) - PostgreSQL is being used');
    }

    if (profile.preferredCharacteristics?.minSquareFeet === 800) {
      console.log('   ❌ API is returning OLD minSquareFeet (800) - PostgreSQL not being used!');
    } else if (profile.preferredCharacteristics?.minSquareFeet === 500) {
      console.log('   ✅ API is returning NEW minSquareFeet (500) - PostgreSQL is being used');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

checkAPIProfile().catch(console.error);

// Treat this script as a module to avoid global-scope const collisions.
export {};
