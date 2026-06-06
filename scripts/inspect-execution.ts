/**
 * Inspect Workflow Execution
 * Fetch the latest execution and examine actual data
 */

const N8N_API_URL = process.env.N8N_API_URL ?? 'https://primary-production-8b46.up.railway.app/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
if (!N8N_API_KEY) {
  throw new Error('N8N_API_KEY env var is required (set it in .env or pass inline)');
}
const WORKFLOW_ID = 'EkhrKhMhfRyu00go';

async function getLatestExecution() {
  const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  if (!response.ok) throw new Error(`Failed to fetch executions: ${response.status}`);

  const data = await response.json();
  return data.data?.[0];
}

async function main() {
  console.log('🔍 Fetching latest workflow execution...\n');

  try {
    const execution = await getLatestExecution();

    if (!execution) {
      console.log('❌ No executions found. Run the workflow first.');
      return;
    }

    console.log(`✅ Found execution: ${execution.id}`);
    console.log(`   Status: ${execution.status}`);
    console.log(`   Started: ${execution.startedAt}`);
    console.log(`   Finished: ${execution.stoppedAt}\n`);

    // Check if execution data is available
    if (!execution.data) {
      console.log('⚠️  Execution data not included in API response');
      console.log('Try fetching with full data...\n');

      const fullResponse = await fetch(`${N8N_API_URL}/executions/${execution.id}`, {
        headers: { 'X-N8N-API-KEY': N8N_API_KEY }
      });

      const fullExecution = await fullResponse.json();

      console.log('\n=== EXECUTION NODES ===');
      const resultData = fullExecution.data?.resultData;

      if (resultData?.runData) {
        const nodes = Object.keys(resultData.runData);
        console.log(`Found ${nodes.length} executed nodes:\n`);

        nodes.forEach(nodeName => {
          const nodeData = resultData.runData[nodeName];
          const lastRun = nodeData[nodeData.length - 1];

          console.log(`📦 ${nodeName}`);
          console.log(`   Runs: ${nodeData.length}`);

          if (lastRun?.data?.main?.[0]) {
            const items = lastRun.data.main[0];
            console.log(`   Items: ${items.length}`);

            // Special handling for key nodes
            if (nodeName === 'Batch Enrich & Score' && items[0]?.json) {
              const output = items[0].json;
              console.log(`   Stats: ${JSON.stringify(output.stats || 'no stats')}`);

              // Check if we have the debug logs
              if (lastRun.error) {
                console.log(`   ERROR: ${lastRun.error}`);
              }
            }

            if (nodeName === 'Fetch from ATTOM API' && items[0]?.json) {
              const salesData = items[0].json;
              console.log(`   Properties fetched: ${salesData.property?.length || 0}`);

              if (salesData.property?.[0]) {
                const firstProp = salesData.property[0];
                console.log(`   First property: ${firstProp.address?.line1}`);
                console.log(`   ATTOM ID: ${firstProp.identifier?.attomId}`);
                console.log(`   Sale price: $${firstProp.sale?.amount?.saleamt?.toLocaleString()}`);
                console.log(`   Has owner data: ${!!firstProp.owner}`);
              }
            }
          }
          console.log('');
        });
      }

      // Try to get console logs if available
      console.log('\n=== LOOKING FOR LOGS ===');
      if (fullExecution.data?.executionData) {
        console.log('Execution data structure:', Object.keys(fullExecution.data.executionData));
      }

    } else {
      console.log('Execution data:', JSON.stringify(execution.data, null, 2).substring(0, 2000));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
