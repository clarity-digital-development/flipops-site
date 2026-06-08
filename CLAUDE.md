# CLAUDE.md - Project Guidelines for Claude

## Project Overview

FlipOps is a real estate investment automation platform built with Next.js 16, React 19, and Tailwind CSS v4. It helps investors manage property discovery, deal analysis, and project management.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **React**: v19
- **Styling**: Tailwind CSS v4 (not v3 - syntax differs)
- **UI Components**: Radix UI primitives + shadcn/ui patterns
- **Database**: Prisma ORM with PostgreSQL (Railway)
- **Auth**: Clerk
- **Automation**: TypeScript cron jobs (lib/cron/)

## Project Structure

```
app/                    # Next.js App Router
  app/                  # Authenticated app pages (/app/*)
    dialer/             # Dialer page (Telnyx + Oppenheimer inbound AI — replaced Campaigns)
    offers/             # Offers page and seed data
    vendors/            # Vendors page with network system
      page.tsx          # Main vendors UI (API-driven, /api/vendors/my)
      seed-data.ts      # Demo vendor data (12 vendors)
    components/         # Shared app components
  api/                  # API routes
    offers/             # Offer CRUD endpoints
    vendors/            # Vendor network API
      my/               # User's vendor network
        route.ts        # GET user vendors
        add/route.ts    # POST link platform vendor
        private/route.ts # POST create private vendor
      platform/route.ts # GET browse platform vendors
    markets/route.ts    # GET available markets
  (marketing)/          # Public marketing pages
components/             # React components
  ui/                   # Base UI components (shadcn/ui style)
lib/                    # Core business logic
  prisma.ts             # Prisma client singleton (IMPORTANT: use this, don't create new instances)
  reapi/                # RealEstateAPI integration
  vendors/              # Vendor network integrations
    google-places.ts    # Google Places API (New) integration
  cron/                 # TypeScript cron automation
    guardrails/         # G1-G4 guardrail jobs
    monitoring/         # Data refresh, pipeline monitoring
    discovery/          # Property discovery jobs
    worker.ts           # Main cron worker entry point
prisma/                 # Database schema
scripts/                # Utility scripts
  list-users.ts         # List database users
  seed-platform-vendors.ts    # Seed vendors from Google Places
  refresh-platform-vendors.ts # Refresh stale vendor data
  setup-user-vendor-network.ts # Link vendors to user accounts
docs/                   # Documentation
  OFFERS_CONTRACTS.md   # Offers & contracts documentation
  development/          # Dev guides (DECISIONS.md, UI-DECISIONS.md, TESTS.md, etc.)
  guardrails/           # G1-G4 implementation docs
  deployment/           # Deployment & credentials guides
```

## Critical Patterns

### Database Access

**ALWAYS** use the shared Prisma singleton:
```typescript
import { prisma } from '@/lib/prisma';
```

**NEVER** do this in API routes:
```typescript
// BAD - creates connection leak
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// BAD - disconnects shared client, breaks concurrent requests
finally {
  await prisma.$disconnect();
}
```

### Authentication

Routes are protected via Clerk middleware. Check `middleware.ts` for the public route list.

For API routes requiring auth:
```typescript
import { auth } from '@clerk/nextjs/server';

const { userId: clerkId } = await auth();
if (!clerkId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

For API routes using service keys (webhooks, cron):
```typescript
const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
const expectedKey = process.env.FO_API_KEY || process.env.FLIPOPS_API_KEY;

// IMPORTANT: Check BOTH that expectedKey exists AND matches
if (!expectedKey || apiKey !== expectedKey) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### API Route Structure

Standard pattern for API routes:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const Schema = z.object({ /* ... */ });

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    // 2. Parse & validate body with Zod
    // 3. Business logic
    // 4. Return JSON response
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  // NO finally { prisma.$disconnect() }
}
```

### Component Patterns

UI components use shadcn/ui conventions:
- Located in `components/ui/`
- Use `class-variance-authority` for variants
- Use `cn()` helper from `lib/utils` for class merging

```typescript
import { cn } from '@/lib/utils';

<div className={cn('base-classes', conditional && 'conditional-classes', className)} />
```

### Toast Notifications

**IMPORTANT**: This project uses shadcn/ui toast system, NOT sonner.

```typescript
// CORRECT - use this pattern
import { useToast } from "@/components/ui/use-toast";

function MyComponent() {
  const { toast } = useToast();

  const handleAction = () => {
    toast({
      title: "Success",
      description: "Action completed.",
      variant: "default", // or "destructive"
    });
  };
}

// WRONG - do NOT use sonner
import { toast } from "sonner"; // ❌ Not used in this project
```

The Toaster component is rendered in `app/layout.tsx` at the root level.

### Accessibility Patterns

For Sheet/Dialog components that need accessible titles but have custom headers:

```typescript
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

<Sheet>
  <SheetContent>
    <VisuallyHidden>
      <SheetTitle>Accessible Title for Screen Readers</SheetTitle>
    </VisuallyHidden>
    {/* Your custom visible header here */}
  </SheetContent>
</Sheet>
```

### Tailwind CSS v4

This project uses Tailwind v4, which has different syntax from v3:
- Config is in `app/globals.css` using `@theme` directive, not `tailwind.config.js`
- Some class names differ from v3

## Environment Variables

Required variables (see `env.sample`):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - Clerk auth
- `FO_API_KEY` or `FLIPOPS_API_KEY` - Internal API authentication
- `REAPI_API_KEY` - RealEstateAPI for property data (currently expired, plan to reactivate)
- `BATCHDATA_API_KEY` - BatchData API for skip tracing ($0.20/record)
- `GOOGLE_PLACES_API_KEY` - Google Places API (New) for vendor network sourcing

## Guardrails System (G1-G4)

The app implements 4 automated guardrails:
- **G1**: Deal approval (maximum exposure protection)
- **G2**: Bid spread control
- **G3**: Invoice/budget guardian
- **G4**: Change order gatekeeper

See `docs/guardrails/` for implementation details.

## Feature Status (Last Reviewed: 2026-01-30, Updated: 2026-01-30)

> **Note**: Vendor Network System added 2026-01-30. Production-default — vendors UI fetches from `/api/vendors/my` and `/api/vendors/platform` (no demo fallback). Google Places integration, tiered access, and admin scripts wired.

### ✅ FULLY IMPLEMENTED & WORKING

#### Cron/Automation System (lib/cron/)
All 9 scheduled workflows are implemented and production-ready:

| Workflow | Schedule | Status |
|----------|----------|--------|
| G1 - Deal Approval Alert | Every 15 min | ✅ Full |
| G2 - Bid Spread Alert | Every 15 min | ✅ Full |
| G3 - Invoice Budget Alert | Every 15 min | ✅ Full |
| G4 - Change Order Alert | Every 15 min | ✅ Full |
| Pipeline Monitoring | Daily 9:00 AM | ✅ Full |
| Contractor Performance | Daily 10:00 AM | ✅ Full |
| Skip Tracing (BatchData) | Weekly Sunday 7:00 AM | ✅ Full |
| Data Refresh Sync | Daily 8:00 AM | ✅ Full |

Run with: `npm run worker` or individual: `npm run cron:g1`

#### Guardrails API (G1-G4)
All guardrail endpoints have full implementation with auth:
- **G1** `/api/deals/approve` - Monte Carlo estimation, P80 exposure checks
- **G2** `/api/bids/award` - Bid spread analysis, vendor comparison
- **G3** `/api/invoices/ingest` - Budget variance tiers (GREEN/TIER1/TIER2)
- **G4** `/api/change-orders/submit` - CO evaluation with simulation

#### Distress Scoring Algorithm
Location: `lib/reapi/utils/distress-scorer.ts` (v2.0)
- 0-100 scale with weighted signals
- HIGH signals: Pre-foreclosure (25), Auction (25), Liens (20)
- MEDIUM signals: Vacant (15), Out-of-state owner (15), Inherited (15)
- LOW signals: High equity (10), Long-term owner (15), Portfolio owner (10)
- Integrated with REAPI search (scoring on-the-fly)
- Grade thresholds: A (65+), B (50-64), C (35-49), D (20-34), F (0-19)

#### Skip Trace Integration (BatchData)
- Auto-enrichment for properties scoring 70+
- $0.20/property cost tracking
- Auto-creates "Make first contact" task after enrichment
- Slack notifications with results

#### Notifications System (`/api/notifications`)
- POST: Create notification (from cron jobs, webhooks)
- GET: Retrieve with filters (type, dealId, processed, limit)
- PATCH: Mark notifications as processed
- Stored in Prisma `Notification` model (persists across restarts)
- Dashboard widget displays recent notifications

#### Database Schema
Complete schema covering:
- Properties, Deals, Vendors, Bids, Invoices, ChangeOrders
- Buyers, ContractAssignments, BuyerOffers, Campaigns (wholesale)
- Rentals, Tenants, RentalIncome, RentalExpense (buy-and-hold)
- Events (audit trail), Tasks, Policies, CostModels
- **Vendor Network System** (new 2026-01-30):
  - `PlatformVendor` - Vendors sourced from Google Places API (shared across all users)
  - `UserVendor` - Private vendors created by individual users
  - `UserVendorRelationship` - Junction table linking users to platform vendors (favorites, preferred, notes)
  - `Market` - Geographic markets for vendor organization (e.g., "Jacksonville, FL")
  - `VendorCategory` enum - 28 trade types (GENERAL_CONTRACTOR, ROOFER, PLUMBER, etc.)

#### UI Pages (app/app/)
17 authenticated pages: Dashboard, Leads, Tasks, Contracts, Renovations, Rentals, Offers, Underwriting, Dialer, Inbox, Documents (with folder navigation, 3 view modes, template library), Analytics, Settings, Vendors (with network system), Buyers, Onboarding

#### Demo Data System
For pre-beta preview, non-admin users see demo data:
- Admin account (`tannercarlson@vvsvault.com`) sees only their own data
- Demo user account (`tanner@claritydigital.dev`) sees their own data (the demo data)
- All other users see demo data merged with their own data
- Demo contracts marked with `isDemo: true` flag
- Seed demo data: `npx tsx scripts/seed-contracts.ts`

### ⚠️ NOTES / CONSIDERATIONS

1. **Properties Ingest Scoring**
   - `/api/properties/ingest` is generic endpoint (manual imports)
   - REAPI path scores correctly with full distress algorithm
   - BatchData is skip-trace only (not property import)

### 🔴 NOT WORKING / BLOCKED

1. **REAPI Key Expired**
   - Property search on leads page fails
   - Plan: Reactivate when going live ($599/mo for 30K credits)

### 📋 NOT STARTED (From Roadmap)

- Outreach: Built-in dialer, SMS/text campaigns, email campaigns (Twilio)
- Direct mail integration (Lob/PostGrid)
- ARV calculator, repair cost estimator, 70% rule calculator
- Role-based permissions
- Zapier/Make integration
- Native mobile app

## Frontend Redesign Status (2026-01-28, Updated: 2026-02-03, Overview/Settings: 2026-02-03)

Goal: Apple-like quality - seamless, intuitive for older users, impressive for younger users.

### ✅ COMPLETED

#### Overview/Dashboard (`app/app/page.tsx`)
Completely redesigned with:
- **No dynamic import flicker** - Direct render, proper skeleton loading
- **KPI Cards** - Clickable with hover effects, sparklines, trend badges, semantic colors
- **Pipeline Funnel** - Visual bar chart (Leads → Contacted → Qualified → Offers → Closed)
- **Notifications Widget** - Pulls from `/api/notifications`, shows recent activity
- **Refresh Button** - Manual data refresh with loading state
- **Dynamic Greeting** - "Good morning/afternoon/evening" based on time
- **Investor Stats** - Wholesaler/Flipper/Buy-and-Hold specific sections
- **Responsive Grid** - 2→3→6 columns based on screen size
- **Fixed Height Bottom Cards** - Hot Leads and Today's Actions use `h-[510px]` to align with third column (Deal Pipeline + Recent Activity)
- **Internal Scrolling** - Cards use flex layout with `overflow-y-auto` for content overflow

**Bottom Grid Layout Pattern:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
  {/* Hot Leads - fixed 510px height */}
  <Card className="lg:col-span-1 flex flex-col h-[510px]">
    <CardHeader className="pb-2 flex-shrink-0">...</CardHeader>
    <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
        {/* Scrollable content */}
      </div>
      <Link className="flex-shrink-0 mt-auto pt-2">
        {/* Button pinned to bottom */}
      </Link>
    </CardContent>
  </Card>

  {/* Today's Actions - same pattern */}
  <Card className="flex flex-col h-[510px]">...</Card>

  {/* Pipeline + Notifications - natural height, sets alignment target */}
  <div className="flex flex-col gap-6">
    <PipelineFunnel stages={pipelineStages} />
    <NotificationsPreview notifications={notifications} />
  </div>
</div>
```

New component: `components/ui/skeleton.tsx` for loading states.

#### Settings (`app/app/settings/page.tsx`)
Completely redesigned with:
- **Two-Tab Interface** - Preferences (active) and Integrations (coming soon)
- **Consolidated Preferences** - All settings on one scrollable tab, two-column grid on desktop
- **Notifications Section** - Email alerts toggle, daily digest toggle with time selector
- **Regional Settings** - Timezone selector (7 US timezones), currency selector (USD/CAD)
- **Email Signature** - Enable/disable toggle, sender name, company name, custom signature with preview
- **Account & Security** - Link to Clerk security management, delete account (disabled during beta)
- **Viewport-Fitting Layout** - Uses `h-full flex flex-col overflow-hidden` pattern
- **Server Persistence** - Settings saved via `/api/user` PUT endpoint
- **Integrations Tab** - Coming Q2 2025 placeholder with planned integrations grid

Settings Form Data:
```typescript
interface SettingsFormData {
  emailAlerts: boolean;
  dailyDigest: boolean;
  digestTime: string;         // "06:00" - "18:00"
  timezone: string;           // "America/New_York", etc.
  currency: string;           // "USD" | "CAD"
  emailSignatureEnabled: boolean;
  emailSenderName: string;
  emailCompanyName: string;
  emailSignature: string;
}
```

#### Leads (`app/app/leads/page.tsx`)
Completely redesigned with:
- **No dynamic import flicker** - Merged page.tsx and page-content.tsx
- **Stats Cards** - Total Leads, Not Contacted, Hot Leads (70+), Follow-ups Due
- **Bulk Selection** - Checkbox selection with select all, bulk actions toolbar
- **Bulk Actions** - Update status, export selected, delete selected
- **Score Visualization** - Visual gauge bars with color coding (emerald 70+, amber 50+, orange 30+)
- **StatusBadge Component** - Semantic colors for each status
- **Table Skeleton** - Proper loading state with skeleton rows
- **Polished Property Drawer** - Cleaner layout, better score badge, contact info cards
- **Row Actions Dropdown** - View Details, Mark Contacted, Delete
- **Score Breakdown Tooltip** (2026-02-06) - Hover tooltip showing distress signal breakdown:
  - Parses `scoreBreakdown` JSON field when available
  - Fallback logic: Generates breakdown from distress flags (isForeclosure, isPreForeclosure, isVacant, etc.)
  - Shows each contributing signal with point value (e.g., "Pre-Foreclosure: +25", "Vacant: +15")
  - Monospace font for aligned point values
  - `cursor-help` indicates tooltip availability on hover
  - Provides transparency into scoring algorithm, helping users understand why properties received specific scores

#### Inbox (`app/app/inbox/page.tsx`)
Completely redesigned with "Editorial Precision" aesthetic:
- **No Stats Cards** - Clean viewport-fitting layout without top cards
- **Gmail-like Sorting** - Unread messages sorted to top, then by date
- **Read/Unread Styling** - Read messages grayed out (opacity-60), unread bold with blue dot
- **Avatar Initials** - Circle avatars with lead initials, blue when selected
- **Rounded Cards** - All panels use `rounded-2xl` with subtle shadows
- **Score Ring** - SVG circular progress indicator for lead score
- **Sentiment Pills** - Colored background pills for sentiment indicators
- **Message Bubbles** - Gradient backgrounds, date dividers, delivery status icons
- **Contact Info Cards** - Color-coded icon containers (blue/purple/emerald)
- **Quick Actions** - Semantic hover colors per action type
- **Skeleton Loading** - ThreadListSkeleton with staggered animation
- **Auto-scroll** - Messages scroll to bottom on new message

#### Layout Changes (`app/app/layout.tsx`)
- **Footer Removed** - No footer in app layout (info available on homepage/onboarding)
- **Viewport Fitting** - Main content uses `h-[calc(100dvh-4rem)] overflow-hidden`
- **Internal Scrolling** - Pages use ScrollArea with `min-h-0` flex children

#### Underwriting (`app/app/underwriting/page-content.tsx`)
Completely redesigned with "Command Center Precision" aesthetic:
- **DealGauge Component** - SVG half-circle gauge showing deal viability score (0-100%), color-coded (green=75%+, amber=50%+, orange=25%+, red=<25%), no drop-shadow to avoid box artifacts
- **PropertyHeroCard** - Premium card with property photo placeholder, address, bed/bath/sqft/year stats grid, distress signal badges (Pre-FC, Vacant, Tax Delinquent, etc.)
- **PropertyCard** - Left panel property selector with score badges, quick stats, gradient score indicators
- **CompCard** - Clickable comp cards with SimilarityRing (circular progress), outlier warnings, selection checkmarks
- **SimilarityRing** - SVG circular indicator showing comp similarity percentage
- **RepairCategoryIcon** - Color-coded icons for repair categories (roof, kitchen, hvac, etc.)
- **NetSheetSummary** - Sticky footer with animated numbers showing ARV → Repairs → MAO → Offer, circular badge icons (Minus, Equal, ChevronRight) with `mt-5` for number alignment
- **ScenarioCard** - Exit strategy comparison cards (Wholesale, Flip, Rental) with profit/ROI calculations
- **AnimatedNumber** - Smooth number transitions when values change
- **Collapsible Left Panel** - Property selector with search, expandable/collapsible, `py-0 gap-0` Card override
- **Color-Coded Tabs** - Background colors instead of borders to avoid rounded corner clipping (blue=Comps, amber=Repairs, emerald=Scenarios)
- **ARV Adjustment Slider** - -20% to +20% manual ARV adjustment
- **Contingency Buffer Slider** - 0-30% repairs buffer
- **Add Repair Dialog** - Category dropdown, description, cost input
- **Create Offer Dialog** - Full offer form with terms, contingencies, dates
- **Skeleton Loading** - Proper loading states throughout
- **Empty State** - Helpful CTA when no properties available
- **Seed Comps** - "1234 Oak Street" (prop-001) has 6 hardcoded Jacksonville-area comps for demo
- **Deal Profit Summary Card** (2026-02-06) - Screenshot-worthy profit visualization component (`deal-profit-summary.tsx`):
  - ROI Gauge: SVG semi-circular gauge with color-coded thresholds (emerald 20%+, amber 10-20%, rose <10%)
  - Timeline stats row: Purchase Price, Total Investment, Projected Profit with gradient icon containers
  - Waterfall breakdown: Line-by-line calculation showing ARV → Repairs → Commissions → Closing → Holding → Net Profit
  - Deal type support: Adapts for wholesale/flip/rental with appropriate cost calculations
  - Demo page: `/app/demo/profit-summary`
- **MAO Waterfall Component** (2026-02-06) - Transparent maximum allowable offer calculator (`mao-waterfall.tsx`):
  - Top-down calculation: ARV → Repairs → Realtor Commission → Buy/Sell Closing → Holding Costs → Profit Target → MAO
  - Adjustable assumptions panel: Sliders for all cost percentages and holding costs
  - Percentage display: Shows both dollar amounts and % of ARV for each line item
  - Icons for context: Each cost category has contextual Lucide icon
  - Integrated into main Underwriting page for transparent offer calculations

New components: `DealGauge`, `SimilarityRing`, `AnimatedNumber`, `PropertyCard`, `CompCard`, `RepairCategoryIcon`, `NetSheetSummary`, `ScenarioCard`, `DealProfitSummary`, `MAOWaterfall`

**Remaining**: Update page.tsx to direct import (remove dynamic import wrapper)

#### Offers (`app/app/offers/page.tsx`)
Completely redesigned with "Command Center Elegance" aesthetic:
- **No dynamic import flicker** - Merged page.tsx and page-content.tsx into single file
- **Premium Stat Chips** - Horizontal scrolling stats bar (Total, Pending, Countered, Won, Needs Contract, Conversion Rate)
- **OfferCard Component** - Visual cards with status-colored gradient top bar, property info, owner avatar
- **StatusTimeline Component** - 4-step visual timeline (Draft → Sent → Response → Outcome) with state indicators
- **StatusIndicator Component** - Pill badges with icons and pulse animation for active states
- **ExpirationBadge Component** - Color-coded urgency indicators (red=expires soon, amber=days left)
- **Grid/List Toggle** - Switch between card grid and compact list views
- **Offer Amount Display** - Side-by-side boxes showing offer vs ARV or counter offer (for countered status)
- **Counter Offer Highlighting** - Amber-themed display when seller counters
- **Contract Integration** - Shows contract status badge, "Needs Contract" warning for accepted offers without contracts
- **Terms & Closing Info** - Cash/financing badge, closing date display in footer
- **Details Dialog** - Clean modal showing all offer details with proper formatting
- **Update Status Dialog** - Change status with response notes
- **Create Contract Dialog** - Convert accepted offers to contracts with closing date picker
- **Skeleton Loading** - Proper loading state with card skeletons
- **Empty State** - Sparkles icon with CTA to Underwriting page
- **Seed Data** - 12 sample offers covering all statuses for demo/development (`seed-data.ts`)

New components: `StatChip`, `StatusTimeline`, `StatusIndicator`, `ExpirationBadge`, `OfferCard`, `OfferCardSkeleton`

Offer Data Structure:
```typescript
interface Offer {
  id: string;
  amount: number;
  terms: string | null; // "cash", "financing", etc.
  contingencies: string[] | null; // ["inspection", "title", "financing"]
  closingDate: string | null;
  expiresAt: string | null;
  earnestMoney: number | null;
  status: "draft" | "sent" | "countered" | "accepted" | "rejected" | "expired";
  sentAt: string | null;
  responseAt: string | null;
  responseNotes: string | null;
  counterAmount: number | null;
  notes: string | null;
  createdAt: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string | null;
    ownerName: string | null;
    beds?: number;
    baths?: number;
    sqft?: number;
    arv?: number;
  };
  contract?: { id: string; status: string };
}
```

#### Contracts (`app/app/contracts/page-content.tsx`)
Completely redesigned with "Command Center Elegance" aesthetic:
- **Compact Metrics Bar** - 8 stat chips (Total, Pending, Signed, Escrow, Closed, Total Value, Avg Days, This Month)
- **Status Pipeline** - Horizontal pipeline visualization (Pending → Signed → Escrow → Closed) with counts, clickable to filter
- **Dual View Modes**:
  - **List View** - Enhanced table with property info, status badges, timeline indicators, assignment badges
  - **Board View (Kanban)** - Pipeline columns with draggable cards showing address, price, days in stage
- **Slide-Out Detail Panel (Sheet)** - Replaces modal, 540px right-side panel with tabbed interface:
  - **Overview Tab** - Property info, key dates, notes
  - **Timeline Tab** - Visual status change history
  - **Documents Tab** - Placeholder for file uploads
  - **Actions Tab** - Update status, assign buyer, start renovation/rental
- **ContractCard Component** - Status-colored border, property address, price, days in stage, buyer assignment
- **StatusBadge Component** - Color-coded pills (amber=pending, blue=signed, purple=escrow, emerald=closed)
- **Workflow Indicators** - Icons showing linked renovation or rental
- **Demo Data System** - Non-admin users see demo data from `tanner@claritydigital.dev` account
- **Seed Script** - `npx tsx scripts/seed-contracts.ts` creates 12 sample contracts
- **Milestone Urgency Badges** (2026-02-06) - Color-coded closing date urgency indicators:
  - Overdue (negative days): Red destructive badge with AlertCircle icon
  - URGENT (≤3 days): Red destructive badge with Clock icon, "URGENT" prefix
  - Soon (≤7 days): Amber badge with AlertTriangle icon, "Soon" prefix
  - Normal (>7 days): Gray outline badge with Calendar icon
  - Displayed in both Table view (Closing Date column) and Kanban board view (card footer)
  - Helps teams prioritize time-sensitive contracts and avoid missed deadlines

New components: `StatChip`, `StatusPipeline`, `ContractCard`, embedded in page-content.tsx

Contract Data Structure:
```typescript
interface Contract {
  id: string;
  purchasePrice: number;
  status: "pending" | "signed" | "escrow" | "closed" | "cancelled";
  closingDate: string | null;
  signedAt: string | null;
  escrowOpenedAt: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  property: { id: string; address: string; city: string; state: string; zip: string };
  offer: { id: string; amount: number; status: string };
  assignment?: { id: string; buyerId: string; assignmentFee: number; status: string; buyer: { name: string } };
  renovation?: { id: string; status: string };
  rental?: { id: string; status: string };
  isDemo: boolean; // True for demo data shown to non-admin users
}
```

#### Renovations (`app/app/renovations/page.tsx`)
Completely redesigned with "Construction Command Center" aesthetic:
- **No dynamic import flicker** - Merged page.tsx and page-content.tsx
- **Horizontal Stat Chips** - Total, Active, Planning, On Hold, Budget, Spent, Avg ROI, Pending COs
- **Status Pipeline** - Visual pipeline (Planning → Active → On Hold → Completed) with clickable filters
- **BudgetGauge Component** - Visual progress bar showing spent vs committed vs baseline, color-coded (green=healthy, amber=near budget, red=over)
- **TradeChips Component** - Color-coded trade badges (Kitchen, Bath, HVAC, Electrical, etc.)
- **RenovationCard Component** - Full card with:
  - Status gradient bar at top
  - Property info (beds/baths/sqft)
  - Budget section with gauge
  - Metrics grid (ARV, Target ROI, Duration)
  - Trade scope chips
  - Pending bids/change orders warnings
- **KanbanCard Component** - Compact card for board view
- **Grid/List/Kanban Views** - Three view modes with toggle
- **Detail Sheet Panel** - Right-side slide-out with 5 tabs:
  - Overview (property, budget gauge, timeline)
  - Scope (trade-grouped line items)
  - Bids (vendor comparison with status, "Request Bid" button)
  - Changes (change orders with cost/schedule impact)
  - Actions (status updates, quick actions)
- **Vendor-Bid Integration** - Full workflow for requesting bids from vendors:
  - Request Bid dialog with trade selector (14 TRADE_CONFIG options)
  - Vendor picker filtered by selected trade via `/api/vendors?trade=X`
  - Bid amount and notes input
  - Creates bid via `/api/bids` POST endpoint
  - New bid appears in renovation's bid list with "pending" status
- **Dark Mode Support** - Explicit `bg-white dark:bg-gray-900` on Sheet/Dialog content
- **Skeleton Loading** - Proper loading states for all view modes
- **Seed Data Fallback** - 9 demo renovation projects covering all statuses (planning, active, on_hold, completed, cancelled)
- **API Routes Fixed** - Now use Prisma singleton + Clerk auth

New components: `BudgetGauge`, `TradeChips`, `StatusBadge`, `StatusPipeline`, `RenovationCard`, `KanbanCard`

New API endpoints:
- `POST /api/bids` - Create bid (requires dealId, vendorId, subtotal)
- `GET /api/bids?dealId=X` - List bids for a renovation (optional status, vendorId filters)

Data structure follows Prisma schema: DealSpec, ScopeTreeNode, Bid, ChangeOrder, BudgetLedger

#### Tasks (`app/app/tasks/page-content.tsx`)
Completely redesigned with modern task management interface:
- **Viewport-Fitting Layout** - Uses `h-full` with flex column pattern (see "Viewport-Fitting Layout Pattern" section)
- **Single Bordered Container** - Header, toolbar, and table all inside one rounded bordered container
- **SLA Compliance Gauge** - SVG circular gauge showing team SLA compliance percentage
- **Stat Chips** - Overdue, Urgent, Due Today, Completed quick stats with color coding
- **Status Pipeline** - Clickable filter bar (All, Open, In Progress, Blocked, Overdue, Done) with counts
- **Table View** - Sortable table with checkbox selection, task type icons, assignee avatars, priority badges, SLA indicators
- **Grid View** - Card-based alternative view with same data
- **Task Detail Sheet** - Right-side slide-out panel (540px) with tabs: Overview, Subtasks, Activity, Comments
- **ScrollArea Integration** - Proper scrolling within bordered container with sticky table headers
- **Skeleton Loading** - Table and grid skeleton states during load
- **Seed Data** - 27 sample tasks covering all types and statuses

Key layout pattern established:
```tsx
<div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
  <div className="shrink-0 border-b px-6 py-4">Header</div>
  <div className="shrink-0 border-b px-6 py-3">Toolbar</div>
  <div className="flex-1 min-h-0 overflow-hidden">
    <ScrollArea className="h-full">Content</ScrollArea>
  </div>
</div>
```

#### Vendors (`app/app/vendors/page.tsx`)
Completely redesigned with "Vendor Command Center" aesthetic:
- **No dynamic import flicker** - Merged page.tsx and page-content.tsx
- **Horizontal Stat Chips** - Total, Verified, Favorites, Avg Rating, Trade Types
- **TRADE_CONFIG Color System** - 28 trade types with color-coded badges/gradients matching VendorCategory enum (GENERAL_CONTRACTOR, ROOFER, PLUMBER, ELECTRICIAN, HVAC, FLOORING, PAINTER, LANDSCAPER, DEMOLITION, FRAMING, DUMPSTER_RENTAL, LOCKSMITH, CLEANING_SERVICE, HOME_INSPECTOR, APPRAISER, SIDING, WINDOWS, INSULATION, DRYWALL, KITCHEN, BATHROOM, FENCING, CONCRETE, POOL, PEST_CONTROL, GARAGE_DOOR, APPLIANCE_REPAIR, OTHER)
- **ReliabilityGauge Component** - SVG circular gauge showing reliability percentage with color thresholds (emerald 90%+, amber 75%+, orange 50%+, rose <50%)
- **VendorCard Component** - Trade-colored gradient stripe, trade icon badge, star rating, location, quick stats (reviews, rate, reliability gauge), availability badge
- **Grid/List View Toggle** - Full cards vs compact horizontal rows
- **VendorDetailSheet** - 540px right panel with 4 tabs:
  - Overview (contact info, services/trades, rates)
  - Reviews (placeholder for vendor reviews)
  - Projects (placeholder for completed projects)
  - Documents (placeholder for uploads)
- **Clean Header Design** - Removed heavy gradient, uses subtle `bg-muted/30` with `border-b`
- **Add Vendor Modal** - Full form for adding private vendors (name, categories, contact info, address, notes)
- **Message/Contract/Invoice Modals** - Quick actions from vendor detail sheet
- **Toast Notifications** - Uses shadcn/ui `useToast` hook (NOT sonner)
- **Accessibility** - SheetTitle wrapped in `VisuallyHidden` for screen reader compliance

**Data Source**: Vendors page is API-driven only. Fetches from `/api/vendors/my` (user network) and `/api/vendors/platform` (browse — premium tiers). The historical `USE_DEMO_DATA` toggle and demo seed-data fallback were removed (2026-06-08) — the seed fallback was hard-locking every user to 12 AZ contractors regardless of their actual network.

**Seed Data** (`app/app/vendors/seed-data.ts`):
- 12 demo vendors across 8 trade categories
- Sample reviews, documents, projects, availability
- Arizona-based (Phoenix, Scottsdale, Mesa, etc.)
- Mix of ratings (0-4.9), verification statuses, availability states

New components: `StatChip`, `ReliabilityGauge`, `VendorCard`, `VendorCardSkeleton`, `VendorDetailSheet`

#### Vendor Network System (Production Architecture)

**Two-Tier Vendor Model**:
1. **PlatformVendor** - Shared vendors sourced from Google Places API
   - Seeded per market by admins
   - Contains Google Place ID, source rating/reviews, categories
   - Available to premium-tier users (Scale, Accelerator, Partner)

2. **UserVendor** - Private vendors created by individual users
   - Personal contractor contacts
   - Full control over data (rating, notes, contact info)

3. **UserVendorRelationship** - Links users to platform vendors
   - Enables favorites, preferred status, personal notes
   - Tracks last used date for sorting

**API Endpoints**:
- `GET /api/vendors/my` - User's vendor network (both UserVendor + linked PlatformVendor)
- `GET /api/vendors/platform` - Browse platform vendors by market (premium feature)
- `POST /api/vendors/my/add` - Link a platform vendor to user's network
- `POST /api/vendors/my/private` - Create a private UserVendor
- `GET /api/markets` - List available markets

**Admin Scripts** (in `scripts/`):
```bash
# List users in database
npx tsx scripts/list-users.ts

# Seed platform vendors from Google Places (requires GOOGLE_PLACES_API_KEY)
npx tsx scripts/seed-platform-vendors.ts

# Refresh stale vendor data from Google Places
npx tsx scripts/refresh-platform-vendors.ts

# Set up vendor network for a user (links top-rated vendors)
npx tsx scripts/setup-user-vendor-network.ts \
  --user-email="user@example.com" \
  --market="Jacksonville, FL" \
  --per-category=3  # Max vendors per trade category
```

**Google Places Integration** (`lib/vendors/google-places.ts`):
- Uses Places API (New) - Text Search and Place Details endpoints
- Searches for contractors by trade + location
- Extracts: name, address, phone, website, rating, review count, price level
- Lazy-loaded API key: `const getApiKey = () => process.env.GOOGLE_PLACES_API_KEY`
- Radius capped at 50km (Google maximum)

**Tiered Access**:
- Free/Launch tiers: Can only add private vendors
- Scale/Accelerator/Partner tiers: Can browse and add platform vendors
- Check: `const hasPremiumAccess = (tier) => ['SCALE', 'ACCELERATOR', 'PARTNER'].includes(tier)`

#### Rentals (`app/app/rentals/page.tsx`)
Completely redesigned with "Wealth Command Center" aesthetic:
- **No dynamic import flicker** - Merged page.tsx and page-content.tsx
- **Light/Dark Theme Support** - Uses theme variables (`bg-card`, `text-foreground`, `bg-muted`) for proper theming
- **Gold Accent for Financial Data** - Rent amounts use `text-amber-600 dark:text-amber-400` for visual hierarchy
- **Horizontal Stat Chips** - Properties, Leased/Vacant, Monthly Rent (gold highlight), Cash Flow, Cap Rate, Portfolio Value, Expiring Leases, Open Tickets
- **OccupancyGauge Component** - SVG circular progress with color-coded thresholds (emerald 90%+, amber 70%+, rose <70%), available in sm/md/lg sizes
- **LeaseCountdown Component** - Color-coded urgency badges for lease expiration (rose ≤30d, amber ≤60d, yellow ≤90d, emerald >90d)
- **CashFlowIndicator Component** - Centered inline +/- display with trend icons (TrendingUp/TrendingDown), uses `justify-center` for alignment with other metrics
- **RentalCard Component** - Status gradient bar, property stats (beds/baths/sqft), metrics grid (Rent/Cash Flow/Cap Rate), tenant/maintenance counts
- **Grid/List View Toggle** - Full cards vs compact horizontal rows
- **RentalDetailSheet** - 540px right panel with 4 tabs:
  - Overview (metrics, lease info, recent payments)
  - Tenants (TenantCard with contact info, payment status)
  - Financials (FinancialSummary with income/expense breakdown, property value/equity)
  - Maintenance (MaintenanceCard with priority/status badges)
- **Accessibility** - SheetTitle wrapped in `VisuallyHidden` from `@radix-ui/react-visually-hidden` for screen reader compliance
- **Toast Notifications** - Uses shadcn/ui `useToast` hook (NOT sonner) for action feedback
- **Action Buttons**:
  - Edit button - Shows toast with "Edit Property" message
  - Record Payment button - Shows toast with payment dialog placeholder
  - Send Renewal Contract button - Conditionally shown when lease expires within 60 days, amber gradient styling
- **Lease Renewal Feature** - Properties with `status === "leased"` and lease expiring within 60 days show a prominent "Send Renewal Contract" button with days remaining badge
- **Financial Calculations** - Monthly cash flow, cap rate, cash-on-cash return, equity
- **Seed Data** - 10 Florida rental properties covering all statuses with tenants and maintenance requests

New components: `StatChip`, `OccupancyGauge`, `LeaseCountdown`, `CashFlowIndicator`, `RentalCard`, `TenantCard`, `MaintenanceCard`, `FinancialSummary`, `RentalDetailSheet`

#### Documents (`app/app/documents/page.tsx`)
Cleaned up and made fully functional with:
- **Three View Modes** - Table (default), Kanban (by status), Packets (bundled documents)
- **Folder Navigation** - Recursive tree with expand/collapse, document counts
- **Quick Access Filters** - "Awaiting Signature" and "Drafts" shortcuts
- **Status Configuration** - Centralized colors, gradients, icons for draft/sent/signed/expired/void
- **Document Type Icons** - LOI, PSA, JV, Assignment, NDA, Addendum with distinct icons
- **Horizontal Stat Chips** - Total, Awaiting, Signed, Avg Time, Templates
- **DocumentCard Component** - Kanban cards with status gradient bar, signer indicators
- **Document Viewer Sheet** - 540px right panel with 4 tabs (Details, Signers, Versions, Audit)
- **Template Library Dialog** - 5 category tabs (Acquisition, Assignment, Partnership, Legal, Modification)
- **Packet Builder Dialog** - Create document bundles for deals
- **Action Handlers** - All actions wired with toast notifications (Edit, Send, Download, New Version, Duplicate, Archive, Void, Resend)
- **Accessibility** - VisuallyHidden SheetTitle for screen readers
- **Dark Mode** - Explicit `bg-white dark:bg-gray-900` on dialogs/sheets

New components: `StatChip`, `DocumentCard`

Data structure in `seed-data.ts`:
- Documents with signerRoles and auditLog
- Folders with parent relationships
- Templates with rolesSchema
- Packets with packetItems
- Helper functions: `getDocumentsByFolder`, `getTemplatesByCategory`, `getDocumentVersions`, `calculateDocumentMetrics`

Key patterns established:
```typescript
// Toast notifications (NOT sonner)
import { useToast } from "@/components/ui/use-toast";
const { toast } = useToast();
toast({ title: "Action", description: "Details..." });

// Accessibility for Sheet components
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
<SheetContent>
  <VisuallyHidden><SheetTitle>Title</SheetTitle></VisuallyHidden>
  {/* Visible content */}
</SheetContent>

// Conditional lease renewal display
const daysUntilExpiration = getDaysUntil(rental.leaseEnd);
const showRenewalOption = rental.status === "leased" &&
  daysUntilExpiration !== null &&
  daysUntilExpiration <= 60 &&
  daysUntilExpiration >= 0;
```

#### Analytics (`app/app/analytics/page.tsx`)
Completely redesigned with "Data Command Center" aesthetic:
- **No dynamic import flicker** - Direct render, proper skeleton loading
- **Viewport-Fitting Layout** - Uses `h-full` with flex column pattern
- **Single Bordered Container** - Header, stats bar, tabs all inside one rounded container
- **Horizontal Stat Chips Bar** - 8 key metrics with trends (Leads, Qualified, Offers, Contracts, Closed, Net Profit, ROMI, Conversion)
- **StatChip Component** - Compact stat display with icon, label, value, trend indicator, highlight option
- **Custom Tooltip Component** - Polished tooltips with backdrop blur, handles Date objects automatically
- **6 Dashboard Tabs**:
  - **Executive** - Conversion funnel, weekly profit trend, profit waterfall
  - **Marketing** - Channel performance table, lead source pie chart, campaign performance
  - **Acquisition** - Speed metrics, lead quality by source, response time distribution
  - **Profitability** - Profit by market, top deals, margin distribution, deal size by market
  - **Team** - Team stats cards, paginated member table with search/sort (see Team Tab section below)
  - **Vendors** - Performance alerts, vendor matrix, spend by category
- **Enhanced Chart Styling (Modern Look)**:
  - Gradient fills on bar charts and area charts (`linearGradient` definitions)
  - Fading area gradients with multi-stop opacity (0.4 → 0.15 → 0)
  - Rounded corners on bars (`radius={[6, 6, 0, 0]}`)
  - Subtle axis lines (`stroke: '#e5e7eb'`) with hidden tick lines (`tickLine={false}`)
  - Dashed horizontal grid only (`strokeDasharray="3 3" vertical={false}`)
  - Dark mode grid support (`className="dark:stroke-zinc-700"`)
  - Drop shadows on chart elements (`className="drop-shadow-sm"`)
  - Muted cursor hover effect (`cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}`)
  - Donut-style pie charts (`innerRadius` + `paddingAngle`)
  - Active dots with white stroke (`activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}`)
  - LabelList for percentage display on funnel bars
  - Compact card headers (`pb-2 pt-3`) to maximize chart space
- **Date Range Selector** - 7d/30d/90d quick filters
- **Refresh Button** - Manual data refresh with loading state
- **Export Dropdown** - CSV export (Excel/PDF coming soon)
- **Live/Demo Data Badge** - Shows data source status
- **Skeleton Loading** - StatChipSkeleton, ChartCardSkeleton, TableSkeleton
- **API Route Fixed** - Uses Prisma singleton + Clerk auth

**Team Tab (Updated 2026-01-31)**:
- **4 Stat Cards** - Total Revenue, Team Members (14), Win Rate (avg), Response Time (avg)
- **Paginated Table** - 9 members per page (`TEAM_PAGE_SIZE = 9`), static layout (no scroll)
- **Table Columns** - Team Member (avatar + name), Role, Revenue, Deals, Win Rate, Response, SLA, Activities
- **Search & Sort** - Search by name/role, sort by Revenue/Deals/Win Rate
- **Table/Card View Toggle** - Switch between table and card grid views
- **Top 3 Indicators** - Crown/Medal/Award icons for top performers when sorted by revenue desc
- **Avatar Colors** - 6 rotating colors (blue, emerald, purple, amber, rose, cyan)
- **Compact Pagination** - `py-1` padding, page numbers visible in viewport
- **14 Demo Members** - Fallback data in both API and frontend for consistency:
  - Sarah Chen, Mike Rodriguez, Emily Johnson, David Park, Jessica Martinez, James Wilson, Ashley Thompson, Robert Garcia, Amanda Lee, Christopher Brown, Jennifer Davis, Daniel Kim, Megan Taylor, Ryan Anderson
- **API Debug Logging** - Console logs for `currentTeamId` and member count to trace data flow

**Vendors Tab (Updated 2026-01-31)**:
- **4 Stat Cards** - Total Vendors, Total Spend, Avg Rating, Avg On-Time %
- **Static Layout** - No ScrollArea wrapper, content flows naturally
- **Vendor Performance Card** - Scrollable list with `max-h-[420px]`, shows ~4-5 vendors before scroll
- **Rating Formatting** - `.toFixed(2)` to prevent floating point display issues (e.g., `1.76` not `1.7600000000000002`)
- **Category-Based Avatar Colors** - Different gradients per vendor type (Contractor=blue, Electrician=amber, etc.)
- **Alert Styling** - Red border/background for vendors with <80% on-time
- **Spend by Category Chart** - Horizontal bar chart with gradient fill
- **On-Time Performance Trend** - Area chart showing weekly trend

New components: `StatChip`, `StatChipSkeleton`, `ChartCardSkeleton`, `TableSkeleton`, `CustomTooltip`

Chart gradient pattern:
```tsx
<defs>
  <linearGradient id="myGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
  </linearGradient>
</defs>
<Bar dataKey="value" fill="url(#myGradient)" radius={[6, 6, 0, 0]} />
```

### 📋 PAGES TO REDESIGN (Priority Order)

All major pages have been redesigned. Future enhancements:
- **Profile Section** - Photo upload, company info, investor type (Settings page)
- **Team Management** - User invites, role assignment (Settings page)
- **Mobile Optimization** - Responsive improvements across all pages

### Frontend Design Patterns

- **Loading**: Use `<Skeleton />` component, not "Loading..." text
- **Cards**: Always include hover states (`hover:shadow-lg hover:-translate-y-0.5`)
- **Colors**: Use semantic colors (emerald=positive, red=negative, amber=warning)
- **Spacing**: Consistent scale - `space-y-8` for sections, `gap-4` for grids
- **Typography**: `tracking-tight` on headlines, `text-muted-foreground` for secondary
- **Icons**: Use colored icons in rounded containers (`w-8 h-8 rounded-lg bg-blue-50`)
- **Font**: TikTok Sans as primary font (loaded via Google Fonts)
- **Scrollbars**: Use ScrollArea component; scrollbars are 6px wide, full-height, always visible
- **Cards with ScrollAreas**: Add `py-0 gap-0` to Card className to remove default spacing

### Viewport-Fitting Layout Pattern (IMPORTANT)

The app layout (`app/app/layout.tsx`) provides a fixed-height container for all pages:
```tsx
<main className="p-6 h-[calc(100dvh-4rem)] overflow-hidden">
  {children}
</main>
```

**Key Rules for Child Pages:**

1. **DO NOT add extra padding** - The layout already provides `p-6`. Adding `p-4` or `p-6` in your page creates double padding.

2. **Use `h-full` not calculated heights** - Your page component should use `h-full` to fill the available space, NOT `h-[calc(100vh-4rem)]`.

3. **Flex column with min-h-0 for scrollable areas** - The parent must allow children to shrink:
```tsx
// Correct pattern for a page with scrollable content
<div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
  {/* Fixed header section */}
  <div className="shrink-0 border-b px-6 py-4">
    <h1>Page Title</h1>
  </div>

  {/* Fixed toolbar/filters */}
  <div className="shrink-0 border-b px-6 py-3">
    <FilterBar />
  </div>

  {/* Scrollable content area */}
  <div className="flex-1 min-h-0 overflow-hidden">
    <ScrollArea className="h-full">
      <Table>...</Table>
    </ScrollArea>
  </div>
</div>
```

4. **Critical CSS classes:**
   - `shrink-0` on fixed sections (headers, toolbars) - prevents them from shrinking
   - `flex-1 min-h-0` on scrollable content wrapper - allows it to shrink and scroll
   - `overflow-hidden` on containers that shouldn't show scrollbars
   - `h-full` on ScrollArea inside the flex-1 container

5. **Fragment wrapper for siblings** - If your page has modals/sheets alongside the main content:
```tsx
return (
  <>
    <div className="h-full flex flex-col ...">
      {/* Main content */}
    </div>
    <Sheet>...</Sheet>
    <Dialog>...</Dialog>
  </>
);
```

**Common Mistakes:**
- Adding `p-6` or `m-6` to the page container (layout already has padding)
- Using `h-[calc(100vh-4rem)]` instead of `h-full`
- Forgetting `min-h-0` on the flex-1 container (content won't scroll)
- Forgetting `shrink-0` on headers (they'll collapse when content is tall)

### UI/UX Fixes (2026-01-29)

See `docs/development/DECISIONS.md` for comprehensive documentation.

#### Global Styling (`app/globals.css`)
- **Font**: TikTok Sans via `--font-sans` variable
- **ScrollArea Fixes**:
  - Scrollbar always visible: `opacity: 1 !important`
  - Scrollbar width: 6px (`w-1.5`) for cleaner appearance
  - Full-height positioning: `top: 0, bottom: 0, right: 0` inline styles override Radix defaults
  - Transparent background: Prevents visual artifacts in dark mode
  - Hidden corner element via `[data-radix-scroll-area-corner] { display: none }`
  - Fixed Radix `display: table` issue causing spacing
- **Card Override Pattern**: Use `py-0 gap-0` on Cards containing ScrollAreas to remove default padding/gap

#### Leads Page Table
- **Sticky Header**: `className="sticky top-0 bg-card z-10"` inside ScrollArea
- **Table Height**: `max-h-[495px]` shows ~9 rows before scrolling
- **Status Bar**: Minimal footer with `py-0.5 text-[11px]`
- **Seed Data**: 16 sample properties for demo/development fallback

### Pre-existing TypeScript Errors (Not from redesign)

These errors exist in `.next/dev/types/` and need separate fix:
- Next.js 16 requires `Promise<params>` pattern in dynamic routes
- Old debug routes still in cache (run `rm -rf .next` to clear)
- Some Prisma type issues with `BidItem` and nullable fields

## Security Status (Fixed 2026-01-28)

All critical security issues have been addressed:
- ✅ All API routes now have proper auth (API key or Clerk)
- ✅ Removed all `prisma.$disconnect()` calls from routes
- ✅ Fixed auth bypass patterns (`!expectedKey || apiKey !== expectedKey`)
- ✅ Deleted `/api/debug/` endpoints
- ✅ Added auth to webhooks, guardrails, and data endpoints

## Testing

```bash
npm run test              # Run Vitest tests
npm run test:ui           # Vitest with UI
npm run typecheck         # TypeScript check
```

## Common Tasks

### Start dev server
```bash
npm run dev               # Default port 3000
PORT=3007 npm run dev     # Custom port
```

### Database operations
```bash
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Run migrations
npm run prisma:studio     # Open database GUI
```

### Seed demo data
```bash
npx tsx scripts/seed-contracts.ts   # Seed 12 demo contracts
```

### Vendor network management
```bash
# List all users
npx tsx scripts/list-users.ts

# Seed platform vendors from Google Places for a market
npx tsx scripts/seed-platform-vendors.ts

# Refresh stale vendor data
npx tsx scripts/refresh-platform-vendors.ts

# Link vendors to a user's account (admin task)
npx tsx scripts/setup-user-vendor-network.ts \
  --user-email="user@example.com" \
  --market="Jacksonville, FL" \
  --per-category=3 \
  --dry-run  # Preview without creating records
```

### Run cron jobs
```bash
npm run worker              # Start cron worker (runs all scheduled jobs)
npm run worker:dev          # Start with file watching

# Individual cron jobs
npm run cron:g1             # G1 - Deal Approval monitoring
npm run cron:g2             # G2 - Bid Spread monitoring
npm run cron:g3             # G3 - Invoice/Budget monitoring
npm run cron:g4             # G4 - Change Order monitoring
npm run cron:data-refresh   # Data Refresh & Sync
npm run cron:pipeline       # Pipeline Monitoring
npm run cron:contractors    # Contractor Performance
npm run cron:skip-trace     # Skip Tracing & Enrichment
npm run cron:all            # Run all cron jobs sequentially
```

## Homepage / Landing Page (Updated 2026-02-10)

The marketing homepage (`app/page.tsx`) has been redesigned with differentiated sections that convert investors.

### Current Section Order
```tsx
<Hero />
<ROICalculator />
<ScoringEngine />        // NEW - Behavioral learning
<KPICards />
<FeatureTabs />
<GuardrailsSection />
<ToolConsolidation />    // NEW - Tool stack comparison
<ProjectManagementShowcase />
<Process />
<FAQs />
<FinalCTA />
```

### Tool Consolidation Section (`app/components/tool-consolidation.tsx`)
**Purpose:** Show investors the real dollar cost of their fragmented tool stack vs FlipOps all-in-one.

**Key Design Decisions:**
- Single comparison table layout (not two-card with arrow - too scroll-heavy)
- Title: "The All-in-One They Promised. Actually Built."
- Badge: "The Hidden Cost of Fragmentation"
- 6 tool categories with competitor names, prices, and pain points
- Dynamic totals: $402+/mo and $4,824+/yr savings calculated from data
- Footnote mentions additional tools not counted (Salesforce, Mailchimp, QuickBooks, REIsift)

**Data Structure:**
```typescript
const toolComparison = [
  { category: 'Data & Leads', current: { name: 'PropStream', cost: 99, pain: '...' }, flipops: '...' },
  { category: 'Skip Tracing', current: { name: 'BatchLeads', cost: 99, pain: '...' }, flipops: '...' },
  { category: 'CRM', current: { name: 'REsimpli', cost: 99, pain: '...' }, flipops: '...' },
  { category: 'Contracts', current: { name: 'PandaDoc', cost: 30, pain: '...' }, flipops: '...' },
  { category: 'Project Tracking', current: { name: 'smrtPhone', cost: 75, pain: '...' }, flipops: '...' },
  { category: 'Rental Portfolio', current: { name: 'Spreadsheet', cost: 0, pain: '...' }, flipops: '...' },
];
```

### Scoring Engine Section (`app/components/scoring-engine.tsx`)
**Purpose:** Communicate ML-powered personalized scoring without using gimmicky "AI" language.

**Key Design Decisions:**
- Title: "A Scoring Engine That Learns How You Invest"
- Subtitle: "Every investor has a strategy. FlipOps learns yours."
- Badge: "Behavioral Learning" (purple)
- Three-step visual flow (auto-cycles, clickable):
  1. "You work deals" - Shows leads with Pursued/Skipped badges
  2. "The algorithm watches" - Animated cycling through 15+ behavioral signals
  3. "Your scores adapt" - Side-by-side personalization demo

**Personalization Demo:**
- Two investor profiles: Jake M. (Wholesaler, Phoenix) vs Sarah R. (Flipper, Atlanta)
- Same interface, completely different top leads and scores
- Key insight callout: "A wholesaler in Phoenix and a flipper in Atlanta get different top leads — because they should."

**15+ Behavioral Signals Tracked:**
- Price ranges you pursue
- Distress profiles you click
- Property types you skip
- Markets where you close
- Deal sizes you prefer
- Rehab levels you target
- (and more cycling through animation)

### Guardrails Section (`app/components/guardrails-section.tsx`)
**Purpose:** Show automated alerts that protect investor margins.

**Key Design Decisions:**
- Title: "Guardrails That Watch Your Back"
- Three connected cards (Budget Alert, Deadline Warning, Margin Alert)
- Each card shows realistic alert data with property addresses
- Stats footer shows tracking depth (e.g., "12+ cost categories tracked per deal")

### Homepage 3D Premium Design System
All homepage sections use a premium "3D floating card" treatment (Apple/Linear aesthetic):
- **Light mode:** White cards with 6-layer box-shadow floating on `bg-[#f4f4f6]` gray surface
- **Dark mode:** Glass-like surfaces with layered shadows on `bg-black`
- **isDarkMode pattern:** `useState` + `MutationObserver` on `document.documentElement` class `'dark'`
- **Key tokens:** See `docs/development/UI-DECISIONS.md` → "Homepage 3D Premium Design System" section for all design tokens (card treatments, gradient borders, tinted backgrounds, dividers, footer bars)
- **Header nav:** "View Demo" (ghost, links to `/app`) + "Reserve Your Spot" (gradient). Login removed for pre-launch.
- **Auth bypass:** `/app(.*)` added to public routes in `middleware.ts` (TODO to re-enable for beta)

## Known Issues

### Railway Deployment - Height Constraint Issue (2026-02-04)

**Status**: UNRESOLVED - Railway-specific deployment issue

**Symptom**: Overview, Analytics, and Settings pages have full-page scrolling on Railway deployment, but work correctly locally (both dev and production builds).

**What works locally**:
- `npm run dev` - Pages fit viewport, internal scrolling only ✅
- `npm run build && npm run start` - Same, works correctly ✅

**What's broken on Railway**:
- Pages extend past viewport, causing full page scroll
- Version badge confirms code IS deployed (v2.5.0 visible)
- Issue persists despite NO_CACHE=1 environment variable

**Investigation done**:
1. Verified git repo matches local codebase
2. Confirmed production build works locally
3. Code follows correct viewport-fitting pattern (same as working pages like Tasks, Vendors)
4. Version badge updates confirm deployments are happening

**Suspected causes**:
- Railway build cache not fully clearing despite NO_CACHE=1
- Static asset caching at CDN/edge level
- Different build behavior on Railway vs local

**To try next**:
1. Clear Railway's build cache via dashboard (Settings → Clear Build Cache)
2. Delete and recreate Railway service
3. Check Railway build logs for any differences
4. Use `railway up --force` if using CLI

**Code is correct** - this is a deployment infrastructure issue, not a code fix.

## Don't Do

- Don't create new PrismaClient instances in API routes
- Don't call `prisma.$disconnect()` in API routes
- Don't commit credential files (*.json with oauth/credentials in name)
- Don't bypass auth by only checking `if (expectedKey && key !== expectedKey)` - always verify key exists
- Don't add files to root - use appropriate directories (scripts/, docs/, tests/)

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
