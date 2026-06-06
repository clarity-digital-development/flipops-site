# FlipOps TypeScript Cron Jobs

This directory contains all TypeScript-based cron jobs.

## Directory Structure

```
lib/cron/
├── shared/               # Shared utilities used by all workflows
│   ├── notifications.ts  # Slack notification helpers
│   ├── user-queries.ts   # Common Prisma queries
│   ├── scoring.ts        # Property & contractor scoring logic
│   ├── logger.ts         # Logging utility
│   ├── utils.ts          # Retry, rate limiting, error handling
│   └── index.ts          # Re-exports all shared utilities
│
├── guardrails/           # Real-time guardrail checks (scheduled)
│   ├── g1-deal-approval.ts
│   ├── g2-bid-spread.ts
│   ├── g3-invoice-budget.ts
│   └── g4-change-order.ts
│
├── monitoring/           # Monitoring & tracking workflows
│   ├── data-refresh-sync.ts
│   ├── pipeline-monitoring.ts
│   └── contractor-performance.ts
│
└── discovery/            # Property discovery & enrichment
    └── skip-tracing-enrichment.ts
```

## Running Cron Jobs

### Local Development

```bash
# Run individual workflows
npm run cron:data-refresh
npm run cron:g1
npm run cron:g2
npm run cron:skip-trace

# Run all workflows (for testing)
npm run cron:all
```

### Production (Railway)

Configure cron jobs in `railway.toml`:

```toml
[[jobs]]
  name = "data-refresh-sync"
  schedule = "0 8 * * *"  # Daily at 8 AM
  command = "npm run cron:data-refresh"

[[jobs]]
  name = "g1-guardrail"
  schedule = "*/15 * * * *"  # Every 15 minutes
  command = "npm run cron:g1"
```

## Shared Utilities

### Notifications

```typescript
import { sendSlackNotification } from '@/lib/cron/shared';

await sendSlackNotification({
  webhook: user.slackWebhook,
  title: 'G1 - Deal Approval Alert',
  message: 'Deal exceeds max exposure',
  color: 'danger',
  fields: [
    { title: 'Deal ID', value: deal.id },
    { title: 'P80', value: formatCurrency(p80) },
  ],
});
```

### User Queries

```typescript
import { getActiveUsers, parseInvestorProfile } from '@/lib/cron/shared';

const users = await getActiveUsers();

for (const user of users) {
  const profile = parseInvestorProfile(user);
  // ... process user
}
```

### Logging

```typescript
import { createLogger } from '@/lib/cron/shared';

const logger = createLogger('G1 Guardrail');

logger.info('Starting G1 checks');
logger.warn('High P80 detected', { dealId: deal.id });
logger.error('Failed to send notification', error);
logger.success('Processed 15 users');
```

### Utilities

```typescript
import { retry, rateLimit, sleep } from '@/lib/cron/shared';

// Retry with exponential backoff
await retry(() => fetch(url), {
  maxAttempts: 3,
  delayMs: 1000,
});

// Rate limit API calls
await rateLimit(properties, async (property) => {
  return await enrichProperty(property);
}, {
  delayMs: 1000,  // 1 second between calls
  batchSize: 5,   // 5 concurrent requests
});

// Simple delay
await sleep(2000);  // Wait 2 seconds
```

## Workflow Schedules

| Workflow | Schedule | Description |
|----------|----------|-------------|
| Data Refresh & Sync | Daily at 8 AM | Refresh deal and property data |
| G1 - Deal Approval | Every 15 min | Check P80 vs maxExposureUsd |
| G2 - Bid Spread | Every 15 min | Check bid spread > 15% |
| G3 - Invoice Budget | Every 15 min | Check budget variance |
| G4 - Change Order | Every 15 min | Check change order impact |
| Pipeline Monitoring | Daily at 8 AM | Track stalled deals |
| Contractor Performance | Daily at 8 AM | Calculate reliability scores |
| Skip Tracing | Every 6 hours | Enrich high-score properties |

## Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL=postgresql://...

# BatchData API
BATCHDATA_API_KEY=your_batchdata_key

# Optional: Debug logging
DEBUG=true
```

## Migration Status

- [x] Infrastructure setup
- [x] Shared utilities
- [ ] Data Refresh & Sync (in progress)
- [ ] G1 - Deal Approval
- [ ] G2 - Bid Spread
- [ ] G3 - Invoice Budget
- [ ] G4 - Change Order
- [ ] Pipeline Monitoring
- [ ] Contractor Performance
- [ ] Skip Tracing & Enrichment

## Testing Workflows

Create test data:

```bash
tsx scripts/create-test-deal.ts
tsx scripts/create-test-invoice-data.ts
tsx scripts/create-test-contractor-data.ts
```

Run workflow:

```bash
npm run cron:g1
```

Check Slack for notification.

## Troubleshooting

**Issue: "Prisma client not found"**
```bash
npm run prisma:generate
```

**Issue: "Cannot find module '@/lib/cron/shared'"**
```bash
# Check tsconfig.json has correct path mapping
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Issue: "Too many database connections"**
- Ensure Prisma client is reused (imported from `lib/cron/shared/user-queries.ts`)
- Consider deploying PgBouncer on Railway

## Next Steps

1. ✅ Complete Data Refresh & Sync migration
2. Test in production for 2-3 days
3. Migrate remaining workflows
4. Configure Railway cron jobs
5. Monitor for 1 week
