const ATTOM_API_KEY = process.env.ATTOM_API_KEY;
if (!ATTOM_API_KEY) {
  throw new Error('ATTOM_API_KEY env var is required (set it in .env or pass inline)');
}

/**
 * Test ATTOM API to understand:
 * 1. Authentication method
 * 2. Available endpoints
 * 3. Response format
 * 4. Search capabilities
 */
async function testAttomAPI() {
  console.log('🔍 Testing ATTOM API...\n');

  // Test 1: Property Search by Address
  console.log('Test 1: Property Detail by Address');
  console.log('=' .repeat(60));

  try {
    // Using ATTOM's Property API - Basic endpoint
    const testAddress = '123 Main St, Miami, FL 33101';
    const response = await fetch(
      'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile',
      {
        method: 'GET',
        headers: {
          'apikey': ATTOM_API_KEY,
          'Accept': 'application/json'
        },
        // Query params for address search
        // Note: ATTOM uses specific param format
      }
    );

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Success! Response:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('\n❌ Error Response:');
      console.log(errorText);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }

  console.log('\n' + '='.repeat(60));

  // Test 2: Try to discover available endpoints
  console.log('\nTest 2: API Discovery');
  console.log('=' .repeat(60));

  try {
    // Try the expanded profile endpoint
    const response = await fetch(
      'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/expandedprofile',
      {
        method: 'GET',
        headers: {
          'apikey': ATTOM_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    console.log('Expanded Profile Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Response:', errorText);
    }
  } catch (error) {
    console.error('❌ Discovery failed:', error);
  }

  console.log('\n' + '='.repeat(60));

  // Test 3: Sales Search (for finding distressed properties)
  console.log('\nTest 3: Sales Search Endpoint');
  console.log('=' .repeat(60));

  try {
    const response = await fetch(
      'https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot',
      {
        method: 'GET',
        headers: {
          'apikey': ATTOM_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    console.log('Sales Search Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Response:', errorText);
    } else {
      const data = await response.json();
      console.log('Success:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Sales search failed:', error);
  }

  console.log('\n\n📚 ATTOM API Documentation');
  console.log('=' .repeat(60));
  console.log('Main docs: https://api.developer.attomdata.com/docs');
  console.log('Property API: https://api.developer.attomdata.com/propertyapi');
  console.log('Sales API: https://api.developer.attomdata.com/saleapi');
  console.log('\n💡 Next step: Review docs to find the right search endpoint');
  console.log('   We need an endpoint that can filter by:');
  console.log('   - Foreclosure status');
  console.log('   - Tax delinquent');
  console.log('   - County/region');
  console.log('   - Property type');
}

testAttomAPI();
