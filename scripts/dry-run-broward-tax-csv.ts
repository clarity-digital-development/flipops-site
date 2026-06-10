/* eslint-disable no-console */
import { scrapeBrowardTaxDelinquentCsv } from "@/lib/scrapers/vendors/broward-tax-delinquent-csv";

// One-off local verification for the M1.4 Broward fix: downloads + parses the
// govhub "PUBLIC_BROWARD UNPAID REAL ESTATE" CSV but persists NOTHING
// (no Lien rows, no bronze capture). Production runs go through the
// broward-tax-delinquent dispatch adapter post-deploy.
//
// Usage: npx tsx scripts/dry-run-broward-tax-csv.ts

async function main() {
  const result = await scrapeBrowardTaxDelinquentCsv({ dryRun: true });
  console.log("\n[dry-run-broward-tax-csv] result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
