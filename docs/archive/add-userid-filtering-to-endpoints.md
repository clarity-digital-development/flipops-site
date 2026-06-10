# API Endpoints - userId Filtering Update Plan

## Endpoints to Update

### G1 - Deal Approval Alert
**File:** `app/api/deals/approve/status/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `dealSpec.findMany` by `userId`
- Filter events by deals owned by userId

### G2 - Bid Spread Alert
**File:** `app/api/deals/bid-spread/status/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `dealSpec.findMany` by `userId`

### G3 - Invoice & Budget Guardian
**File:** `app/api/deals/budget-variance/status/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `dealSpec.findMany` by `userId`

### G4 - Change Order Gatekeeper
**File:** `app/api/deals/change-orders/status/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `changeOrder.findMany` by `deal.userId`

### Pipeline Monitoring
**File:** `app/api/deals/stalled/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter all queries (`dealSpec`, `bid`, `invoice`, `changeOrder`) by `userId` or `deal.userId`

### Data Refresh & Sync
**File:** `app/api/deals/active/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `dealSpec.findMany` by `userId`

### Contractor Performance Tracking
**File:** `app/api/contractors/performance/route.ts`
**Changes:**
- Add `userId` query param extraction
- Filter `vendor.findMany` by `userId` (if vendor has userId field)
- Otherwise filter bids/invoices by `deal.userId`

## Standard Pattern

```typescript
// Extract userId from query params
const { searchParams } = new URL(req.url);
const userId = searchParams.get('userId');

// Require userId for multi-tenant queries
if (!userId) {
  return NextResponse.json(
    { error: 'userId parameter is required' },
    { status: 400 }
  );
}

// Add to where clause
const deals = await prisma.dealSpec.findMany({
  where: {
    userId,  // ADD THIS
    // ... existing filters
  }
});
```
