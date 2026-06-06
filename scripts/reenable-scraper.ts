/**
 * Re-enable an auto-paused ScrapeRegistry entry.
 *
 * Usage:
 *   npx tsx scripts/reenable-scraper.ts <sourceKey>            # dry-run
 *   npx tsx scripts/reenable-scraper.ts <sourceKey> --confirm  # apply
 *
 * With --confirm:
 *   - enabled = true
 *   - pausedReason = null
 *   - consecutiveP1Alerts = 0
 *   - consecutiveFails = 0
 */

import { prisma } from '../lib/prisma';

async function main() {
  const args = process.argv.slice(2);
  const sourceKey = args.find((a) => !a.startsWith('--'));
  const confirm = args.includes('--confirm');

  if (!sourceKey) {
    console.error('ERROR: sourceKey argument is required');
    console.error('Usage: npx tsx scripts/reenable-scraper.ts <sourceKey> [--confirm]');
    process.exit(1);
  }

  const row = await prisma.scrapeRegistry.findUnique({
    where: { sourceKey },
    select: {
      sourceKey: true,
      enabled: true,
      pausedReason: true,
      consecutiveP1Alerts: true,
      consecutiveFails: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureReason: true,
    },
  });

  if (!row) {
    console.error(`ERROR: no ScrapeRegistry row found for sourceKey="${sourceKey}"`);
    process.exit(2);
  }

  console.log('=== Current state ===');
  console.log(JSON.stringify(row, null, 2));

  const changes = {
    enabled: { from: row.enabled, to: true },
    pausedReason: { from: row.pausedReason, to: null },
    consecutiveP1Alerts: { from: row.consecutiveP1Alerts, to: 0 },
    consecutiveFails: { from: row.consecutiveFails, to: 0 },
  };

  console.log('\n=== Proposed changes ===');
  console.log(JSON.stringify(changes, null, 2));

  if (!confirm) {
    console.log('\nDRY RUN — no changes applied. Re-run with --confirm to apply.');
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.scrapeRegistry.update({
    where: { sourceKey },
    data: {
      enabled: true,
      pausedReason: null,
      consecutiveP1Alerts: 0,
      consecutiveFails: 0,
    },
    select: {
      sourceKey: true,
      enabled: true,
      pausedReason: true,
      consecutiveP1Alerts: true,
      consecutiveFails: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureReason: true,
      updatedAt: true,
    },
  });

  console.log('\n=== Updated row ===');
  console.log(JSON.stringify(updated, null, 2));
  console.log('\nOK — scraper re-enabled.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  await prisma.$disconnect();
  process.exit(1);
});
