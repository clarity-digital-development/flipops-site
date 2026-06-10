# Admin Features Archive

This document preserves context for features that were built but moved out of the main client-facing UI. These features belong in a separate admin dashboard.

---

## Data Sources Page

**Location:** `app/app/data-sources/page.tsx`
**Status:** Preview/mockup - no backend integration
**Original Purpose:** Future connector management for data pipelines

### What It Was

A preview page (wrapped in `PreviewModeWrapper`, expectedRelease="Q1 2025") showing aspirational UI for managing data connectors:

- **County Records** - Public records scraping
- **MLS Feed** - Listing data integration
- **Skip Trace Pro** - Contact enrichment
- **Twilio SMS** - Messaging campaigns
- **DocuSign** - Document management

### Features Mocked

- Connector cards with status indicators (connected/disconnected)
- Field mapping configuration UI
- Sync scheduling interface
- Run history with success/failure metrics
- Add new connector workflow

### Why It Was Removed

The UI doesn't reflect the actual architecture:
- Properties are sourced from **REAPI** (with ATTOM as backup)
- Skip tracing uses **BatchData** via cron jobs
- Campaign backend (Twilio SMS/email) hasn't been built yet
- The connector abstraction doesn't match how integrations actually work

### Current Reality

| Integration | Actual Implementation |
|-------------|----------------------|
| Properties | REAPI API calls, not a "connector" |
| Skip Trace | BatchData cron jobs |
| Messaging | Not implemented yet |
| Documents | Not implemented yet |

### Future Consideration

If this feature returns, it should reflect actual integrations:
- REAPI connection status and API key health
- BatchData credit balance and usage
- API rate limit monitoring
- Actual sync logs from real operations

---

## Panel APIs / Data Source Panels Page

**Location:** `app/app/data-sources/panels/page.tsx`
**Status:** Functional admin debug tool
**Gated By:** `NEXT_PUBLIC_ENABLE_DATASOURCE_PANELS=1`

### What It Is

A legitimate admin debugging interface for the G1-G4 Guardrails system. Uses functional hooks:

```typescript
const { data: truth } = useTruthPanel(dealId);   // @/hooks/usePanels
const { data: money } = useMoneyPanel(dealId);   // @/hooks/usePanels
const { data: motion } = useMotionPanel(dealId); // @/hooks/usePanels
```

### Panel Types

**Truth Panel (G1 - Deal Approval)**
- Deal policy compliance
- Risk exposure metrics
- Approval status

**Money Panel (G2/G3 - Budget Controls)**
- Budget vs actual spending
- Variance tracking
- Invoice/change order monitoring

**Motion Panel (G4 - Progress)**
- Workflow progress tracking
- Bottleneck identification
- Timeline metrics

### Why It Was Moved

This is a developer/admin tool, not a client-facing feature. It provides raw debugging access to guardrail data and belongs in a dedicated admin dashboard with proper access controls.

### Guardrails System Reference

| Guardrail | Purpose |
|-----------|---------|
| G1 | Deal approval policy enforcement |
| G2 | Bid spread monitoring |
| G3 | Invoice/budget controls |
| G4 | Change order monitoring |

---

## Relocation Plan

Both features should eventually live in an **Admin Dashboard** that includes:

1. **System Health** - API connection status, rate limits, error rates
2. **Integration Status** - REAPI, BatchData, future integrations
3. **Guardrail Debug** - Panel APIs for deal inspection
4. **Data Pipeline Monitoring** - When real connectors are built

---

*Archived: January 2026*
