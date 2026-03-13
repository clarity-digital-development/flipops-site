# FlipOps - Comprehensive Platform Documentation

*Real Estate Investment Automation Platform*

**Last Updated:** February 5, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Overview](#platform-overview)
3. [Technology Stack](#technology-stack)
4. [User Workflows](#user-workflows)
5. [Core Features](#core-features)
6. [Page-by-Page Breakdown](#page-by-page-breakdown)
7. [Design System](#design-system)
8. [Backend Systems](#backend-systems)
9. [Data Models](#data-models)
10. [Automation & Guardrails](#automation--guardrails)
11. [Integrations](#integrations)
12. [Deployment & Infrastructure](#deployment--infrastructure)

---

## Executive Summary

FlipOps is a comprehensive real estate investment automation platform designed for wholesalers, house flippers, and buy-and-hold investors. Built by an active real estate investor, it combines intelligent property discovery, deal analysis, project management, and outreach automation into a single unified platform.

### Core Value Propositions

- **Find More Deals**: Automated property discovery monitors foreclosures, pre-foreclosures, tax-delinquent properties, and distressed assets 24/7
- **Analyze Faster**: Intelligent scoring algorithms evaluate properties against 15+ investment criteria, surfacing only the highest-potential opportunities
- **Keep Projects on Budget**: Four automated guardrails (G1-G4) protect against budget overruns, bad bids, and scope creep
- **Close More Contracts**: Multi-channel outreach campaigns (SMS, email, voicemail, direct mail) with A/B testing and sentiment analysis

### Target Users

| Investor Type | Primary Use Cases |
|---------------|-------------------|
| **Wholesalers** | Lead generation, campaigns, buyer management, contract assignments |
| **Flippers** | Deal analysis, renovation management, vendor coordination, budget tracking |
| **Buy-and-Hold** | Rental management, tenant tracking, cash flow analysis, maintenance coordination |

---

## Platform Overview

### What FlipOps Does

1. **Property Discovery & Lead Management**
   - Monitors multiple data sources for distressed properties
   - Scores properties using proprietary 0-100 distress algorithm
   - Auto-enriches high-scoring leads with skip tracing
   - Manages lead lifecycle from discovery through closing

2. **Deal Analysis & Underwriting**
   - ARV estimation with comp analysis
   - Repair cost estimation by trade category
   - Exit strategy comparison (wholesale, flip, rental)
   - MAO (Maximum Allowable Offer) calculation

3. **Outreach & Communication**
   - Multi-channel campaigns (SMS, email, voicemail, direct mail)
   - Unified inbox for all lead conversations
   - A/B testing and performance analytics
   - Sentiment analysis for replies

4. **Transaction Management**
   - Offer creation and tracking through closing
   - Contract lifecycle management
   - Document management with e-signature workflow
   - Buyer network for wholesale assignments

5. **Project Management**
   - Renovation tracking with scope, bids, and change orders
   - Vendor network management
   - Budget monitoring with guardrail alerts
   - Task management with SLA tracking

6. **Rental Portfolio Management**
   - Property performance dashboards
   - Tenant and lease management
   - Maintenance request tracking
   - Cash flow and cap rate analysis

---

## Technology Stack

### Frontend
- **Framework**: Next.js 16 with App Router
- **React**: v19 with Server Components
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives + shadcn/ui patterns
- **Charts**: Recharts for data visualization
- **Font**: TikTok Sans (Google Fonts)

### Backend
- **Runtime**: Node.js
- **ORM**: Prisma with PostgreSQL
- **Auth**: Clerk (OAuth, SSO, MFA)
- **API**: Next.js API Routes with Zod validation

### Automation
- **Cron Jobs**: TypeScript workers (lib/cron/)
- **Workflow Engine**: n8n (optional external integration)
- **Skip Tracing**: BatchData API ($0.20/record)
- **Property Data**: ATTOM API, RealEstateAPI

### Infrastructure
- **Database**: PostgreSQL on Railway
- **Web App**: Railway or Vercel
- **Worker Service**: Railway (separate service)

---

## User Workflows

### Workflow 1: Lead Discovery to Contact

```
Property Discovery → Distress Scoring → Skip Trace Enrichment → Campaign Assignment → Outreach → Response Handling
```

1. **ATTOM Discovery Job** (Daily 6 AM) scans for distressed properties
2. **Distress Scorer** evaluates each property (0-100 scale)
3. Properties scoring 70+ auto-trigger **BatchData Skip Trace**
4. Enriched leads appear in **Leads** page with contact info
5. User assigns leads to **Campaign** or contacts via **Inbox**
6. System tracks responses, sentiment, and conversation history

### Workflow 2: Deal Analysis to Contract

```
Lead → Underwriting Analysis → Offer Creation → Negotiation → Contract → Closing
```

1. User opens lead in **Underwriting** page
2. System fetches comps and calculates ARV
3. User adds repair estimates by trade category
4. System calculates MAO and displays exit scenarios
5. User creates **Offer** with terms and contingencies
6. Offer tracked through sent → response → accepted/rejected
7. Accepted offers convert to **Contracts**
8. Contract tracked through pending → signed → escrow → closed

### Workflow 3: Renovation Management

```
Contract Closed → Renovation Created → Scope Defined → Bids Requested → Work Tracked → Project Completed
```

1. **Contract** closes, user starts **Renovation**
2. User defines scope with trade-specific line items
3. System calculates baseline budget from scope
4. User requests **Bids** from vendors in their network
5. **G2 Guardrail** monitors bid spread (alerts if >15% variance)
6. Invoices submitted, **G3 Guardrail** monitors budget
7. Change orders evaluated by **G4 Guardrail**
8. Project completed, metrics recorded

### Workflow 4: Wholesale Assignment

```
Contract → Buyer Matching → Buyer Offers → Assignment → Closing → Assignment Fee Collected
```

1. User has property under **Contract**
2. System matches with **Buyers** based on criteria
3. Buyers submit offers through buyer portal
4. User accepts offer and creates **Assignment**
5. Assignment tracked through closing
6. Assignment fee collected at closing

---

## Core Features

### Distress Scoring Algorithm (v2.0)

Properties are scored 0-100 based on weighted distress signals:

| Signal | Weight | Points |
|--------|--------|--------|
| Pre-Foreclosure | HIGH | 25 |
| Auction Status | HIGH | 25 |
| Tax Liens | HIGH | 20 |
| Vacancy | MEDIUM | 15 |
| Out-of-State Owner | MEDIUM | 15 |
| Inherited Property | MEDIUM | 15 |
| High Equity (>50%) | LOW | 10 |
| Long-term Owner (10+ yrs) | LOW | 15 |
| Portfolio Owner | LOW | 10 |

**Score Grades:**
- A (65+): Hot lead, high motivation
- B (50-64): Good prospect
- C (35-49): Moderate interest
- D (20-34): Low priority
- F (0-19): Not recommended

### Four Guardrails System (G1-G4)

Automated protection against common investment mistakes:

| Guardrail | Purpose | Trigger |
|-----------|---------|---------|
| **G1: Deal Approval** | Maximum exposure protection | Monte Carlo simulation, P80 exposure check |
| **G2: Bid Spread** | Vendor bid variance control | Alerts when bids vary >15% from baseline |
| **G3: Invoice Guardian** | Budget overrun prevention | Tiered alerts (GREEN/TIER1/TIER2) on variance |
| **G4: Change Order Gate** | Scope creep protection | Evaluates CO impact with simulation |

### Multi-Channel Campaigns

Campaign capabilities:
- **Channels**: SMS, Email, Voicemail drops, Direct mail
- **Sequencing**: Multi-step drip campaigns with delays
- **Targeting**: Filter by distress signals, location, equity, status
- **Testing**: A/B testing for message variations
- **Analytics**: Reply rate, sentiment analysis, conversion tracking
- **Compliance**: DNC checking, consent management, quiet hours

### Vendor Network System

Two-tier vendor architecture:

1. **Platform Vendors**: Sourced from Google Places API, shared across users
   - 28 trade categories (GC, Roofer, Plumber, Electrician, etc.)
   - Automatic rating/review import
   - Market-specific organization

2. **User Vendors**: Private vendors created by individual users
   - Personal contacts and relationships
   - Custom notes, ratings, and tags
   - Favorite and preferred status

---

## Page-by-Page Breakdown

### Dashboard / Overview (`/app`)

**Purpose**: Central command center showing key metrics and actions at a glance.

**Components**:
- Dynamic greeting (Good morning/afternoon/evening)
- 6 KPI cards with sparklines and trend indicators
- Investor-specific stats (Wholesaler/Flipper/Buy-and-Hold sections)
- Hot Leads card (properties scoring 85+)
- Today's Actions card (tasks due today + overdue)
- Deal Pipeline funnel visualization
- Recent Notifications widget

**Key Metrics**:
- Active Deals, Pipeline Value, Monthly Revenue
- Leads (new/contacted), Contracts, Offers
- Investor-type specific: Assignments, Flips in Progress, Units Under Management

### Leads (`/app/leads`)

**Purpose**: Property discovery and lead management.

**Components**:
- Stats cards (Total, Not Contacted, Hot Leads, Follow-ups Due)
- Filterable/sortable data table with bulk selection
- Visual score gauges with color coding
- Property detail drawer with contact info
- Bulk actions (update status, export, delete)

**Status Flow**: New → Contacted → Qualified → Hot → Negotiating → DNC

### Inbox (`/app/inbox`)

**Purpose**: Unified communication hub for all lead conversations.

**Components**:
- Three-panel layout (thread list, conversation, lead details)
- Gmail-style sorting (unread first, then by date)
- Message bubbles with delivery status
- Lead score ring and sentiment indicators
- Quick actions (call, email, schedule, make offer)
- Offer generation dialog

**Design**: "Editorial Precision" aesthetic with rounded cards and subtle shadows.

### Campaigns (`/app/campaigns`)

**Purpose**: Outreach automation and performance tracking.

**Components**:
- Campaign cards with animated progress rings
- Sparkline charts for reply rate trends
- Channel badges (SMS, Email, Voicemail, Letter)
- Status indicators with pulse animation
- Grid/List view toggle
- Campaign wizard for creation

**Detail View Tabs**:
1. Overview (step funnel, channel performance, sentiment)
2. Analytics (geographic performance, A/B results)
3. Deliveries (message-level log)
4. Audience (filters, matched leads)
5. Settings (compliance, throttling)

### Underwriting (`/app/underwriting`)

**Purpose**: Deal analysis and offer preparation.

**Components**:
- Property selector (collapsible left panel)
- Property hero card with distress badges
- DealGauge (circular viability score 0-100%)
- Comps tab with SimilarityRing indicators
- Repairs tab with trade-categorized estimates
- Scenarios tab (Wholesale, Flip, Rental comparison)
- Net Sheet summary (ARV → Repairs → MAO → Offer)
- Create Offer dialog

**Calculations**:
- ARV from selected comps with adjustments
- Repair estimates with contingency buffer
- MAO using 70% rule variants
- Exit scenario ROI projections

### Offers (`/app/offers`)

**Purpose**: Offer creation, tracking, and response management.

**Components**:
- Stat chips (Total, Pending, Countered, Won, Needs Contract)
- Offer cards with status timeline
- Counter offer display (amber styling)
- Expiration badges with urgency indicators
- Grid/List view toggle
- Status update and contract creation dialogs

**Status Flow**: Draft → Sent → Countered/Accepted/Rejected → Contract

### Contracts (`/app/contracts`)

**Purpose**: Contract lifecycle management through closing.

**Components**:
- Status pipeline visualization
- 8 metric chips (including Avg Days, Total Value)
- List view (table) and Board view (kanban)
- Slide-out detail panel with tabs
- Assignment and renovation/rental linking

**Status Flow**: Pending → Signed → Escrow → Closed

### Renovations (`/app/renovations`)

**Purpose**: Flip project management and budget tracking.

**Components**:
- BudgetGauge showing spent vs committed vs baseline
- Trade-colored scope chips
- Grid/List/Kanban view modes
- Detail sheet with 5 tabs (Overview, Scope, Bids, Changes, Actions)
- Request Bid dialog with vendor selection

**Budget Tracking**:
- Baseline from scope line items
- Committed from approved bids
- Spent from invoices
- Variance alerts via G3 Guardrail

### Vendors (`/app/vendors`)

**Purpose**: Vendor network management across 28 trade categories.

**Components**:
- ReliabilityGauge component
- Trade-colored gradient stripes and badges
- Star rating with review count
- Availability status indicators
- Grid/List view toggle
- Detail sheet with tabs (Overview, Reviews, Projects, Documents)
- Add Vendor form (private vendors)

**Data Sources**: Google Places API (platform), Manual entry (private)

### Rentals (`/app/rentals`)

**Purpose**: Rental portfolio management and performance tracking.

**Components**:
- OccupancyGauge (circular progress)
- LeaseCountdown (urgency badges)
- CashFlowIndicator (positive/negative with trends)
- Gold accent for rent/financial amounts
- Detail sheet with tabs (Overview, Tenants, Financials, Maintenance)
- Lease renewal feature for expiring leases

**Calculations**:
- Monthly cash flow
- Cap rate
- Cash-on-cash return
- Property equity

### Buyers (`/app/buyers`)

**Purpose**: Wholesale buyer network management.

**Components**:
- Buyer cards with status gradients
- VIP and POF verified badges
- Market preference tags
- Active Listings tab
- Smart Matching engine
- Buyer offers tracking

### Tasks (`/app/tasks`)

**Purpose**: Team task management with SLA tracking.

**Components**:
- SLA Compliance Gauge
- Status pipeline (All, Open, In Progress, Blocked, Overdue, Done)
- Table and Grid view modes
- Task detail sheet with subtasks, activity, comments
- Checkbox bulk selection
- Priority and due date management

### Documents (`/app/documents`)

**Purpose**: Document management with e-signature workflow.

**Components**:
- Folder navigation tree
- Three view modes (Table, Kanban, Packets)
- Status-driven styling (draft, sent, signed, expired, void)
- Document viewer sheet with version history
- Template library (5 categories)
- Packet builder for document bundles

### Analytics (`/app/analytics`)

**Purpose**: Business intelligence and performance dashboards.

**6 Tabs**:
1. **Executive**: Conversion funnel, profit trends, waterfall
2. **Marketing**: Channel performance, lead sources, campaigns
3. **Acquisition**: Speed metrics, lead quality, response time
4. **Profitability**: Market analysis, top deals, margins
5. **Team**: Member performance table, SLA metrics
6. **Vendors**: Performance alerts, spend analysis, on-time trends

**Chart Styling**: Gradient fills, rounded bars, dashed grids, custom tooltips.

### Settings (`/app/settings`)

**Purpose**: User preferences and account management.

**Two Tabs**:
1. **Preferences**: Notifications, regional settings, email signature
2. **Integrations**: Coming Q2 2025 (Slack, Zapier, CRM, etc.)

---

## Design System

### Color Palette

**Primary Colors** (oklch color space):
- Primary (Teal): `oklch(0.596 0.154 162.243)` - Main brand color
- Accent (Blue): `oklch(0.663 0.173 216.618)` - Links, highlights
- Destructive (Red): `oklch(0.577 0.245 27.325)` - Errors, warnings

**Semantic Colors**:
- Emerald: Positive metrics, success states
- Amber: Warnings, pending items, gold for financial data
- Rose/Red: Negative metrics, errors, urgent items
- Blue: Information, primary actions
- Gray: Neutral, disabled states

### Typography

- **Primary Font**: TikTok Sans (Google Fonts)
- **Monospace**: Geist Mono (for code, tabular numbers)
- **Base Size**: 14.4px (16px * 0.9 for 90% design scale)
- **Headlines**: `tracking-tight` for tighter letter-spacing

### Component Patterns

**Card Hover States**:
```css
hover:shadow-lg hover:-translate-y-0.5 transition-all
```

**Status Gradients**:
- Running/Active: `from-emerald-400 to-emerald-500`
- Paused/Warning: `from-amber-400 to-amber-500`
- Completed/Draft: `from-gray-300 to-gray-400`
- Error/Blocked: `from-rose-400 to-rose-500`

**Stat Chips**: Compact horizontal displays with icon, label, value, and optional trend indicator.

**Gauges**: SVG circular progress indicators (OccupancyGauge, ReliabilityGauge, DealGauge, ProgressRing).

### Layout Patterns

**Viewport-Fitting** (critical for app pages):
```tsx
// App layout provides: h-[calc(100dvh-4rem)] overflow-hidden
// Child pages use:
<div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
  <div className="shrink-0 border-b px-6 py-4">Header</div>
  <div className="flex-1 min-h-0 overflow-hidden">
    <ScrollArea className="h-full">Content</ScrollArea>
  </div>
</div>
```

**Three-Panel Layout** (Inbox, Documents):
```tsx
<div className="flex h-full gap-4">
  <div className="w-[306px] shrink-0">Left Panel</div>
  <div className="flex-1 min-w-0">Main Content</div>
  <div className="w-[252px] shrink-0">Right Panel</div>
</div>
```

---

## Backend Systems

### API Route Structure

All API routes follow this pattern:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check (Clerk or API key)
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get internal user ID
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    // 3. Parse & validate body with Zod
    const body = await request.json();
    const data = Schema.parse(body);

    // 4. Business logic with Prisma
    const result = await prisma.model.create({ data });

    // 5. Return JSON response
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  // NO finally { prisma.$disconnect() } - uses shared singleton
}
```

### Key API Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/properties/ingest` | POST | Import properties with scoring |
| `/api/leads` | GET, POST | Lead management |
| `/api/campaigns` | GET, POST, PATCH, DELETE | Campaign CRUD |
| `/api/offers` | GET, POST, PATCH, DELETE | Offer management |
| `/api/contracts` | GET, POST, PATCH | Contract lifecycle |
| `/api/vendors/my` | GET, POST | User vendor network |
| `/api/vendors/platform` | GET | Browse platform vendors |
| `/api/deals/approve` | POST | G1 Guardrail |
| `/api/bids/award` | POST | G2 Guardrail |
| `/api/invoices/ingest` | POST | G3 Guardrail |
| `/api/change-orders/submit` | POST | G4 Guardrail |
| `/api/notifications` | GET, POST, PATCH | Notification system |
| `/api/analytics` | GET | Dashboard analytics |

### Cron Jobs (lib/cron/)

| Job | Schedule | Purpose |
|-----|----------|---------|
| G1 - Deal Approval | Every 15 min | Monitor exposure on deals |
| G2 - Bid Spread | Every 15 min | Alert on bid variance |
| G3 - Invoice Budget | Every 15 min | Track budget status |
| G4 - Change Order | Every 15 min | Evaluate COs |
| Pipeline Monitoring | Daily 9 AM | Deal stage analysis |
| Contractor Performance | Daily 10 AM | Vendor metrics |
| ATTOM Discovery | Daily 6 AM | Property sourcing |
| Skip Tracing | Weekly Sunday 7 AM | BatchData enrichment |
| Data Refresh | Daily 8 AM | Property data sync |

Run with: `npm run worker` or individual: `npm run cron:g1`

---

## Data Models

### Core Entities

```
User
├── Properties (discovered/imported)
│   ├── Deals (active transactions)
│   │   ├── Offers
│   │   │   └── Contracts
│   │   ├── DealSpec (renovation scope)
│   │   │   ├── ScopeTreeNode (line items)
│   │   │   ├── Bids
│   │   │   ├── ChangeOrders
│   │   │   └── BudgetLedger
│   │   └── Rental
│   │       ├── Tenants
│   │       ├── RentalIncome
│   │       └── RentalExpense
│   └── PropertyEvent (history)
├── Campaigns
│   └── CampaignRecipients
├── Buyers
│   └── BuyerOffers
├── UserVendor (private vendors)
├── UserVendorRelationship (platform vendor links)
├── Tasks
├── Notifications
└── Documents
```

### Key Relationships

- **Property → Deals**: One property can have multiple deals over time
- **Deal → Offers**: Multiple offers per deal during negotiation
- **Offer → Contract**: One accepted offer creates one contract
- **Contract → Assignment**: Wholesale deals link to buyer
- **Contract → DealSpec**: Flip projects link to renovation
- **Contract → Rental**: Hold properties link to rental
- **User → UserVendor**: Private vendors owned by user
- **User → UserVendorRelationship → PlatformVendor**: Linked platform vendors

---

## Automation & Guardrails

### G1: Deal Approval Guardrail

**Purpose**: Prevent overexposure on any single deal.

**Process**:
1. Monte Carlo simulation runs 1000+ scenarios
2. Calculates P80 (80th percentile) exposure
3. Compares against user's max exposure policy
4. Alerts if P80 exceeds threshold

**Configuration**: Max exposure %, confidence interval

### G2: Bid Spread Control

**Purpose**: Ensure vendor bids are reasonable.

**Process**:
1. Collects all bids for a trade category
2. Calculates baseline from scope estimate
3. Measures variance between bids and baseline
4. Alerts if any bid exceeds 15% variance

**Thresholds**: Default 15%, configurable per trade

### G3: Invoice/Budget Guardian

**Purpose**: Track budget health in real-time.

**Tiers**:
- GREEN (0-5% over): On track
- TIER1 (5-15% over): Warning notification
- TIER2 (>15% over): Urgent alert, requires approval

**Process**: Every invoice updates budget ledger, calculates variance

### G4: Change Order Gatekeeper

**Purpose**: Evaluate scope changes before approval.

**Evaluation Criteria**:
- Cost impact vs remaining budget
- Schedule impact vs deadline
- Risk assessment
- Alternative analysis

**Output**: Approve/Deny recommendation with reasoning

---

## Integrations

### Current Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| Clerk | Authentication, user management | Active |
| PostgreSQL | Primary database | Active |
| Google Places API | Vendor sourcing | Active |
| ATTOM API | Property discovery, AVM | Active |
| BatchData | Skip tracing | Active ($0.20/record) |

### Planned Integrations

| Service | Purpose | Timeline |
|---------|---------|----------|
| Twilio | SMS/Voice campaigns | Q1 2025 |
| SendGrid | Email campaigns | Q1 2025 |
| Lob/PostGrid | Direct mail | Q2 2025 |
| Zapier/Make | Workflow automation | Q2 2025 |
| Slack | Notifications | Q2 2025 |
| DocuSign/PandaDoc | E-signatures | Q2 2025 |

---

## Deployment & Infrastructure

### Railway Configuration

**Web Service** (nixpacks.toml):
```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

**Worker Service** (nixpacks.worker.toml):
```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm ci --include=dev"]

[phases.build]
cmds = ["echo 'Worker service - skipping Next.js build'"]

[start]
cmd = "npm run worker"
```

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend
- `FO_API_KEY` or `FLIPOPS_API_KEY` - Internal API auth

**Optional (by feature)**:
- `ATTOM_API_KEY` - Property discovery
- `BATCHDATA_API_KEY` - Skip tracing
- `GOOGLE_PLACES_API_KEY` - Vendor sourcing
- `REAPI_API_KEY` - Property data (currently expired)

### Development Commands

```bash
# Start development
npm run dev
PORT=3007 npm run dev  # Custom port

# Database
npm run prisma:generate   # Regenerate client
npm run prisma:migrate    # Run migrations
npm run prisma:studio     # Database GUI

# Testing
npm run test              # Run tests
npm run typecheck         # TypeScript check

# Workers
npm run worker            # Start cron worker
npm run worker:dev        # Watch mode
npm run cron:all          # Run all jobs once
```

---

## Security Notes

- All API routes protected by Clerk auth or API key
- API key validation: Check both existence AND match
- No `prisma.$disconnect()` in routes (connection pooling)
- HMAC-SHA256 for external webhooks
- Sensitive files excluded from git (.env, credentials)

---

## Contact & Support

- **Platform**: https://flipops.io
- **Email**: tannercarlson@flipops.io
- **GitHub Issues**: Report bugs and feature requests

---

*FlipOps - Where Technology Meets Real Estate Opportunity*
