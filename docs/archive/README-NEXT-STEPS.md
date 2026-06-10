# FlipOps - Next Steps Runbook

## Quick Start (15 Minutes)

### 1. Install Railway CLI and Seed Environment Variables
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Seed all environment variables
npm run seed:railway

# Verify environment
railway variables
```

### 2. Set Up Database
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npm run migrate

# Seed demo data (optional)
tsx db/seed-notifications.ts
```

### 3. Deploy Workflows to n8n
```bash
# Deploy all workflows
npm run deploy:workflows

# Expected output:
# ✓ FlipOps Google Sheets Sync (ID: xxx)
# ✓ Miami-Dade Foreclosure Parser (ID: yyy)
# ✓ FO_Guardrails__Alerts (ID: CXW7dsaUwOESiMR1)
```

### 4. Verify All Connections
```bash
# Check n8n connection
npm run check:n8n
# ✓ Authenticated as: your-email@domain.com
# ✓ Found 3 workflow(s)

# Check Slack connection
npm run check:slack
# ✓ Authenticated as: FlipOps Bot
# ✓ Channel found: #guardrail-alerts

# Check SMTP connection
npm run check:smtp
# ✓ SMTP connection verified
# ✓ Email sent successfully

# Check API health
npm run health:local
# ✓ API: ok
# ✓ Database: ok
# ✓ n8n: healthy
```

## Google Sheets Setup

### 1. Create Your Properties Sheet

Create a new Google Sheet with these exact column headers:

| address | city | state | zip | owner_name | foreclosure | pre_foreclosure | tax_delinquent | vacant | bankruptcy | absentee_owner |
|---------|------|-------|-----|------------|-------------|-----------------|----------------|--------|------------|----------------|
| 123 Main St | Miami | FL | 33139 | John Doe | yes | no | yes | no | no | yes |
| 456 Oak Ave | Miami | FL | 33140 | Jane Smith | no | yes | no | yes | no | no |

### 2. Share Your Sheet

1. Click "Share" button
2. Change to "Anyone with link can view"
3. Copy the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### 3. Configure n8n Workflow

1. Open n8n: https://primary-production-8b46.up.railway.app
2. Find "FlipOps Google Sheets Sync" workflow
3. Edit workflow
4. Double-click "Get Properties from Sheet" node
5. Connect your Google account (OAuth)
6. Enter your Sheet ID
7. Save and activate workflow

### 4. Test the Integration

Add a test property to your sheet:
```
999 Test Drive, Miami, FL, 33139, Test Owner, yes, no, yes, yes, no, no
```

This should score 80+ and trigger alerts within 5 minutes.

## Miami-Dade County Parser Setup

### 1. Configure County URL

The workflow is pre-configured for Miami-Dade. To modify:

1. Open n8n
2. Edit "Miami-Dade Foreclosure Parser"
3. Update "Fetch County Page" node with correct URL
4. Test manually first

### 2. Manual Test Run

```bash
# Get workflow ID
WORKFLOW_ID=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows" \
  | jq -r '.data[] | select(.name == "Miami-Dade Foreclosure Parser") | .id')

# Execute manually
curl -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows/$WORKFLOW_ID/execute"
```

### 3. Schedule Activation

The workflow runs daily at 2:00 AM ET automatically once activated.

## Adding New Counties

### Quick County Template

1. Copy this template to `workflows/[county]-foreclosure-parser.json`
2. Update:
   - Name: `"name": "Broward Foreclosure Parser"`
   - URL: Update in "Fetch County Page" node
   - Selectors: Update in "Extract Table Rows" node

3. Deploy:
```bash
npm run deploy:workflows
```

### County URLs Reference

- **Broward County:** https://www.broward.org/RecordsTaxesTreasury/Records/Pages/Foreclosures.aspx
- **Palm Beach County:** https://www.pbcgov.org/papa/Foreclosure.htm
- **Orange County:** https://www.occompt.com/foreclosures/
- **Hillsborough County:** https://www.hillsclerk.com/Records-Search/Foreclosure-Sales

## Production Deployment

### 1. Deploy to Railway

```bash
# Deploy application
railway up

# Run migrations in production
railway run npm run migrate

# Verify deployment
railway logs
```

### 2. Deploy to Vercel (Alternative)

```bash
# Build for production
npm run build:prod

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

### 3. Update Webhook URLs

After deployment, update n8n workflows with production URLs:

1. Get your production URL
2. Update environment variable:
```bash
railway variables set FO_API_BASE_URL=https://your-app.up.railway.app/api
```
3. Re-deploy workflows:
```bash
npm run deploy:workflows
```

## Monitoring Setup

### 1. UptimeRobot (Free)

1. Sign up at https://uptimerobot.com
2. Add monitor:
   - URL: `https://your-app.up.railway.app/api/health`
   - Check interval: 5 minutes
3. Add alert contact (Slack webhook)

### 2. Railway Metrics

Railway provides built-in monitoring:
- CPU and Memory usage
- Request logs
- Error tracking
- Auto-restart on crash

### 3. n8n Monitoring

Set up error workflow:
1. Create new workflow "Error Handler"
2. Add Error Trigger node
3. Add Slack notification
4. Set as error workflow in Settings

## Testing Checklist

### API Endpoints
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test event seen check
curl http://localhost:3000/api/events/seen/test_event

# Test deal enrichment
curl http://localhost:3000/api/deals/test_deal_001

# Test notifications GET
curl http://localhost:3000/api/notifications?limit=5

# Test notifications POST
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test_001","type":"test","message":"Test notification"}'

# Test mark seen
curl -X POST http://localhost:3000/api/events/mark-seen \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test_001"}'
```

### Webhook Testing
```bash
# Fire test event
npm run test:guardrails:fire

# Expected: Score calculation and response
```

### Workflow Testing
```bash
# Test Google Sheets sync
# Add row to sheet, wait 5 minutes

# Test county parser
# Manually execute in n8n

# Test error handling
# Intentionally break a node, verify Slack alert
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Reset database
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### n8n Workflow Not Running
```bash
# Check if active
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows" \
  | jq '.data[] | {name: .name, active: .active}'

# Activate workflow
curl -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_BASE_URL/api/v1/workflows/[ID]" \
  -d '{"active": true}'
```

### Slack Not Receiving Messages
```bash
# Test bot token
curl -X POST https://slack.com/api/auth.test \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN"

# Check bot is in channel
curl -X POST https://slack.com/api/conversations.members \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -d "channel=$SLACK_ALERTS_CHANNEL_ID"
```

## Daily Operations

### Morning Checklist (9 AM ET)
1. Check overnight county parsing results
2. Review high-score properties from last 24h
3. Verify all workflows ran successfully
4. Check error channel for issues

### Weekly Maintenance
1. Review and clean old notifications
2. Check database size and performance
3. Update county parser selectors if needed
4. Review alert effectiveness metrics

## Support Contacts

- **n8n Issues:** Check execution logs at n8n dashboard
- **Database Issues:** Railway dashboard → Logs
- **Slack Integration:** #automation-errors channel
- **Email:** tannercarlson@vvsvault.com

## Performance Benchmarks

- Property Scoring: < 1 second per property
- Batch Processing: 100 properties in < 30 seconds
- Alert Delivery: < 5 seconds from score to Slack
- Database Queries: < 100ms for indexes queries
- Workflow Execution: < 60 seconds for county parsing

## Next Features to Add

1. **MLS Integration**
   - Add MLS API credentials
   - Create new ingestion workflow
   - Map MLS fields to schema

2. **Skip Tracing**
   - Integrate TLOxp or similar
   - Auto-enrich 85+ scores
   - Add owner contact info

3. **Automated Comps**
   - Integrate Zillow/Redfin API
   - Calculate ARV automatically
   - Improve profit estimates

4. **Investor Portal**
   - Build Next.js frontend
   - Property detail pages
   - Saved searches and alerts

---

**Remember:** Start with Google Sheets for immediate value, then add data sources incrementally. The system is designed to scale - begin simple and expand based on what generates the most deals.