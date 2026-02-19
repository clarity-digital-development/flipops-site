# FlipOps UI/UX Decisions & Fixes

## Date: January 28, 2026 (Updated: February 14, 2026 - Homepage 3D Design System)

## Global UI Changes

### Font Family
**Decision:** Use TikTok Sans as primary font.
**Implementation:**
- Added Google Fonts preconnect in `app/layout.tsx`
- Set `--font-sans: "TikTok Sans"` in `app/globals.css`
- Fallback chain: ui-sans-serif, system-ui, sans-serif

### ScrollArea Component Fixes
**Issue:** Radix ScrollArea had spacing issues and scrollbar visibility problems.
**Fixes in `app/globals.css`:**
```css
/* Always show ScrollArea scrollbar */
[data-slot="scroll-area-scrollbar"] {
  opacity: 1 !important;
  top: 40px !important; /* Start below sticky header */
  height: calc(100% - 40px) !important; /* Adjust height to match */
}

/* Visible scrollbar thumb */
[data-slot="scroll-area-thumb"] {
  background-color: oklch(0.8 0 0) !important;
}
.dark [data-slot="scroll-area-thumb"] {
  background-color: oklch(0.35 0 0) !important;
}

/* Hide ScrollArea corner */
[data-radix-scroll-area-corner] {
  display: none !important;
}

/* Fix Radix display:table issue causing extra spacing */
[data-slot="scroll-area-viewport"] > div {
  display: block !important;
  min-height: 0 !important;
}

/* Remove table container extra space */
[data-slot="table-container"] {
  overflow-x: visible !important;
}

/* Reset margin/padding on table elements */
[data-slot="scroll-area-viewport"] [data-slot="table-container"],
[data-slot="scroll-area-viewport"] table {
  margin: 0 !important;
  padding: 0 !important;
}
```

---

## Leads Page (`app/app/leads/page.tsx`)

### Table Layout
**Decision:** Use ScrollArea with sticky header for the leads table.
**Configuration:**
- `max-h-[495px]` - Shows ~9 rows before scrolling
- `type="scroll"` - Always shows scrollbar when needed
- Sticky header with `className="sticky top-0 bg-card z-10"`

### Status Bar
**Decision:** Minimal status bar below the table.
**Implementation:**
```tsx
<div className="flex-shrink-0 border-t px-3 py-0.5 text-[11px] text-muted-foreground">
  Showing {filteredProperties.length} of {properties.length} leads
  {selectedIds.size > 0 && (
    <span className="ml-2">· {selectedIds.size} selected</span>
  )}
</div>
```
**Rationale:**
- `py-0.5` and `text-[11px]` for minimal vertical footprint
- Shows count and selection status
- Border-t separates from table content

### Card Container
**Decision:** Remove gaps in Card flex container.
**Implementation:**
```tsx
<Card className="border-0 shadow-sm overflow-hidden flex flex-col gap-0">
```
**Rationale:** Prevents unwanted spacing between ScrollArea and status bar.

### Seed Data Fallback
**Decision:** Use local seed data when API is unavailable.
**Implementation:**
- 16 sample properties in `seed-data.ts`
- Covers various Florida cities
- Includes mix of distress signals (foreclosure, pre-foreclosure, tax delinquent, vacant)
- Different outreach statuses (new, contacted, hot, negotiating, dnc)

---

## Campaigns Page (`app/app/campaigns/page.tsx`)

### Sparkline Animation
**Decision:** Show sparklines by default, animate on hover.
**Implementation in `app/globals.css`:**
```css
.sparkline-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
}
```

### Progress Ring Animation
**Decision:** Animated progress ring for campaign completion.
**Implementation:**
```css
@keyframes drawProgress {
  0% { stroke-dashoffset: var(--target-offset); }
  49% { stroke-dashoffset: 0; }
  50% { stroke-dashoffset: 140; }
  100% { stroke-dashoffset: var(--target-offset); }
}
```
**Behavior:** Fills to 100%, resets to empty, fills back to actual value.

### Campaign Card Design
**Features:**
- Status-colored top border (emerald=running, amber=paused, gray=completed, blue=draft)
- Pulsing status indicator for running campaigns
- Channel badges with icons (SMS, Email, Voicemail, Letter)
- Progress ring with percentage
- Sparkline for reply rate trends
- Cost per deal calculation

### Compact List View
**Decision:** Offer both grid and list views.
**List view features:**
- Horizontal layout with key metrics inline
- Status-colored left border
- Mini progress ring
- Condensed metrics (sent, reply%, deals, cost)

### Stats Bar
**Decision:** Horizontal scrolling stat chips on desktop, 3-column grid on mobile.
**Stats shown:**
- Active campaigns
- Total sends
- Reply rate
- Deals (with revenue)
- Cost (with ROI)

### Seed Data
**Decision:** Use local seed data for demo/development.
**Location:** `app/app/campaigns/seed-data.ts`
**Includes:**
- Multiple campaign statuses
- Various channel combinations
- Realistic metrics (sends, replies, leads, contracts)
- A/B test variations
- Cost and revenue data

---

## App Layout (`app/app/layout.tsx`)

### Main Content Area
**Decision:** Fixed height with overflow hidden.
**Implementation:**
```tsx
<main className="p-6 h-[calc(100dvh-4rem)] overflow-hidden">
```
**Rationale:** Prevents page-level scrolling, each page manages its own scroll.

### Sidebar Navigation
**Features:**
- Fixed position on desktop (w-72)
- Slide-in overlay on mobile
- User type-aware filtering via `filterNavigationByInvestorType()`
- Active state highlighting

### Top Bar
**Features:**
- Sticky positioning
- Search input with icon
- Theme toggle
- Notification bell with indicator
- Quick Add Lead button (desktop only)

---

## Theme Configuration

### Color Scheme
**Primary colors (from `app/globals.css`):**
- Primary (teal): `oklch(0.596 0.154 162.243)`
- Accent (blue): `oklch(0.663 0.173 216.618)`

### Dark Mode
**Implementation:**
- `@custom-variant dark (&:where(.dark, .dark *));`
- ThemeProvider with `defaultTheme="dark"`
- Component-specific dark mode classes

---

## Component Patterns

### Table with Sticky Header in ScrollArea
```tsx
<ScrollArea className="max-h-[495px]" type="scroll">
  <Table>
    <TableHeader className="sticky top-0 bg-card z-10">
      ...
    </TableHeader>
    <TableBody>
      ...
    </TableBody>
  </Table>
</ScrollArea>
```

### Scrollbar Positioning for Sticky Headers
When using sticky headers inside ScrollArea, the scrollbar needs adjustment:
```css
[data-slot="scroll-area-scrollbar"] {
  top: 40px !important; /* Header height */
  height: calc(100% - 40px) !important;
}
```

### Status Indicators with Pulse
```tsx
<div className="relative flex items-center justify-center">
  <span className={cn("h-2 w-2 rounded-full", color)} />
  {pulse && (
    <span className={cn("absolute h-2 w-2 rounded-full animate-ping", color, "opacity-75")} />
  )}
</div>
```

---

## Known Issues & Workarounds

### Radix ScrollArea display:table
**Issue:** Radix wraps viewport content in a div with `display: table`.
**Workaround:** Override to `display: block` via CSS.

### Table Container Overflow
**Issue:** shadcn Table wrapper has `overflow-x: auto` causing spacing issues.
**Workaround:** Override to `overflow-x: visible` when inside ScrollArea.

---

## Offers Page (`app/app/offers/page.tsx`)

### Card-Based Offer Display
**Decision:** Use visual cards instead of table rows for offer display.
**Implementation:**
- Grid view: 1/2/3 columns based on screen width
- List view: Compact horizontal cards with left color border
- Status-colored gradient bar at top of each card
- Hover lift effect with shadow transition

### Status Timeline Visualization
**Decision:** 4-step visual timeline showing offer progression.
**Implementation:**
```tsx
const steps = [
  { key: "draft", label: "Draft", icon: FileText },
  { key: "sent", label: "Sent", icon: Send },
  { key: "response", label: "Response", icon: MessageSquare },
  { key: "outcome", label: "Outcome", icon: Target }
];
```
**States:**
- `pending` - Gray background, icon visible
- `active` - Blue background with ring highlight
- `completed` - Green background with checkmark
- `success` - Solid green with white checkmark (accepted)
- `failed` - Solid red with X icon (rejected)
- `expired` - Solid gray with icon

### Expiration Badge Component
**Decision:** Color-coded urgency indicators for offer expiration.
**Implementation:**
- Expired: Gray outline, "Expired" text
- 0-2 days: Rose/red outline, "Expires today" or "Xd left"
- 3+ days: Amber outline, "Xd left"

### Counter Offer Display
**Decision:** Highlight counter offers with distinct styling.
**Implementation:**
- Amber-themed box when status is "countered"
- Side-by-side display: Your Offer | Counter Offer
- MessageSquare icon with counter amount

### Stat Chips with Horizontal Scroll
**Decision:** Compact stat chips in horizontal scrolling container.
**Stats shown:**
- Total offers
- Pending (sent + countered) with total value
- Countered count
- Won (accepted) with total value
- Needs Contract (accepted without contract)
- Conversion rate with trend indicator

### Seed Data Fallback
**Decision:** Use local seed data when API is unavailable.
**Location:** `app/app/offers/seed-data.ts`
**Includes:**
- 12 sample offers covering all statuses
- Realistic Florida property addresses
- Various contingencies, terms, and dates
- Some with contracts, some without

---

## Buyers Page (`app/app/buyers/page.tsx`)

### Date: January 30, 2026

### Horizontal Stat Chips
**Decision:** Replace vertical stat cards with horizontal scrolling stat chips to match Campaigns/Offers pattern.
**Implementation:**
```tsx
<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
  <StatChip label="Active Buyers" value={count} icon={<Users />} color="blue" />
  <StatChip label="VIP Buyers" value={count} icon={<Star />} color="amber" />
  <StatChip label="Active Listings" value={count} icon={<Home />} color="purple" />
  <StatChip label="Pending Offers" value={count} icon={<HandshakeIcon />} color="emerald" />
  <StatChip label="Avg Assignment" value="$X" icon={<DollarSign />} color="emerald" />
  <StatChip label="Cash Buyers" value={count} icon={<Zap />} color="rose" />
</div>
```
**Rationale:** Consistent with other pages, better use of horizontal space, scrollable on mobile.

### StatChip Component
**Implementation:**
```tsx
function StatChip({ label, value, subValue, icon, trend, color }) {
  const colorMap = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5",
  };
  // ...renders chip with icon, label, value, optional subValue and trend
}
```

### Grid/List View Toggle for Buyers
**Decision:** Add view mode toggle matching Campaigns/Offers pattern.
**Implementation:**
```tsx
<div className="flex rounded-lg border p-0.5 bg-gray-100 dark:bg-gray-800">
  <Button variant="ghost" size="sm" className={cn("h-7 px-2.5", buyerViewMode === "grid" && "bg-white shadow-sm")}>
    <LayoutGrid className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="sm" className={cn("h-7 px-2.5", buyerViewMode === "list" && "bg-white shadow-sm")}>
    <List className="h-4 w-4" />
  </Button>
</div>
```

### Buyer Card Grid View
**Features:**
- Status-colored gradient top border (VIP=amber, Active=emerald, Inactive=gray, Blacklisted=rose)
- Avatar with initials
- VIP/Blocked badges
- Market tags
- Metrics grid (Score, Deals, POF status)
- Contact buttons (Email, Call)
- Hover shadow effect

### Status-Colored Borders on Listing Cards
**Decision:** Add gradient status bars to Active Listings cards.
**Implementation:**
```tsx
<Card className="overflow-hidden hover:shadow-md transition-shadow">
  <div className={cn(
    "h-1 w-full",
    status === 'active' && "bg-gradient-to-r from-emerald-400 to-emerald-500",
    status === 'assigned' && "bg-gradient-to-r from-blue-400 to-blue-500",
    status === 'pending' && "bg-gradient-to-r from-amber-400 to-amber-500",
    status === 'closed' && "bg-gradient-to-r from-gray-300 to-gray-400"
  )} />
  <CardContent>...</CardContent>
</Card>
```

### Improved Table Styling
**Changes:**
- Table rows: `hover:bg-muted/50` for subtle hover state
- Empty values: `text-muted-foreground text-sm italic` for "Not set", "No history"
- POF verified badge: emerald colors (`bg-emerald-50 text-emerald-700 border-emerald-200`)

### Enhanced Empty States
**Decision:** Match Offers page pattern with gradient icon containers.
**Implementation:**
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
    <Icon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
  </div>
  <h3 className="text-lg font-semibold mb-2">Title</h3>
  <p className="text-muted-foreground max-w-md mb-6">Description</p>
  <Button>Action</Button>
</div>
```
**Applied to:**
- No Active Listings
- No Property Selected (Smart Matching)
- No Matching Buyers
- No Buyer Offers Yet
- No Recent Offers (Overview)

### ScrollArea for Active Listings
**Decision:** Add scrolling to Active Listings tab.
**Implementation:**
```tsx
<TabsContent value="listings">
  <ScrollArea className="h-[calc(100vh-22rem)]">
    <div className="space-y-4 pr-4">
      {/* listing cards */}
    </div>
  </ScrollArea>
</TabsContent>
```

---

## Contracts Page (`app/app/contracts/page-content.tsx`)

### Date: January 30, 2026

### Larger Stat Numbers
**Decision:** Increase stat chip number text size for better readability.
**Changes:**
- StatChip value: `text-base` → `text-xl`
- StatusPipeline count: `text-lg` → `text-xl`

**Implementation:**
```tsx
// StatChip component
<p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">
  {value}
</p>

// StatusPipeline component
<p className={cn("text-xl font-bold tabular-nums", ...)}>
  {count}
</p>
```
**Rationale:** Numbers were too small relative to the box size, harder to read at a glance.

---

## Renovations Page (`app/app/renovations/page.tsx`)

### Date: January 30, 2026

### Dark Mode for Sheet and Dialogs
**Issue:** Sheet (detail panel) and Dialog components didn't adapt to dark mode.
**Decision:** Add explicit dark mode background classes.
**Implementation:**
```tsx
// Sheet panel for renovation details
<SheetContent side="right" className="w-full sm:max-w-[600px] p-0 flex flex-col bg-white dark:bg-gray-900">

// Update Status Dialog
<DialogContent className="bg-white dark:bg-gray-900">

// Request Bid Dialog
<DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900">
```
**Also:** Add explicit text colors to h3 headings inside dialogs:
```tsx
<h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Property</h3>
```
**Rationale:** shadcn Dialog/Sheet components use CSS variables that may not fully adapt in all contexts. Explicit classes ensure consistent dark mode appearance.

### Stat Chip Border Clipping Fix
**Issue:** Stat chips with `warning` ring effect had top border clipped.
**Decision:** Change container padding from `pb-2` to `py-2`.
**Implementation:**
```tsx
// Before
<div className="flex gap-3 overflow-x-auto pb-2 px-6 scrollbar-hide">

// After
<div className="flex gap-3 overflow-x-auto py-2 px-6 scrollbar-hide">
```
**Rationale:** The `ring-2` effect on warning chips extends beyond the element bounds, requiring top padding to avoid clipping.

### Request Bid Dialog
**Decision:** Integrate vendor selection with bid creation workflow.
**Implementation:**
- Trade selector dropdown using `TRADE_CONFIG` (14 trades with colors)
- Vendor picker that filters by selected trade via `/api/vendors?trade=X`
- Bid amount input with validation
- Notes field for additional context
- Submit creates bid via `/api/bids` POST endpoint

**Data flow:**
1. User clicks "Request Bid" button in Bids tab
2. Select trade → triggers vendor fetch filtered by trade
3. Select vendor → shows vendor reliability score
4. Enter bid amount → required field
5. Submit → creates bid with "pending" status
6. New bid appears in renovation's bid list

**State management:**
```tsx
// Dialog states
const [requestBidDialogOpen, setRequestBidDialogOpen] = useState(false);
const [vendors, setVendors] = useState<any[]>([]);
const [loadingVendors, setLoadingVendors] = useState(false);
const [selectedTrade, setSelectedTrade] = useState("");
const [selectedVendorId, setSelectedVendorId] = useState("");
const [bidAmount, setBidAmount] = useState("");
const [bidNotes, setBidNotes] = useState("");
const [submittingBid, setSubmittingBid] = useState(false);
```

**Empty vendor state:**
```tsx
{selectedTrade && vendors.length === 0 && !loadingVendors && (
  <p className="text-xs text-muted-foreground mt-1">
    <Link href="/app/vendors" className="text-blue-500 hover:underline">
      Add a vendor
    </Link>
    {" "}for this trade first
  </p>
)}
```

### Seed Data Expansion
**Decision:** Expand seed data to cover all status categories for demo/testing.
**Location:** `app/app/renovations/seed-data.ts`
**Coverage:**
- 9 total renovation projects
- 2 in "planning" status
- 3 in "active" status
- 1 in "on_hold" status
- 2 in "completed" status
- 1 in "cancelled" status

**Rationale:** Ensures all status filters and UI states can be tested without needing real database records.

### API + Seed Data Combination
**Decision:** Combine API data with seed data instead of using either/or fallback.
**Implementation:**
```tsx
// Mark API data with isDemo: false, seed data with isDemo: true
const apiWithFlag = mapped.map((r: any) => ({ ...r, isDemo: false }));
const seedWithFlag = seedRenovations.map(r => ({ ...r, isDemo: true }));
setRenovations([...apiWithFlag, ...seedWithFlag]);
```
**Rationale:** Ensures demo data always shows for testing while real data appears alongside when available.

### TRADE_CONFIG Color System
**Decision:** Use consistent color-coded trade badges across the app.
**Configuration:**
```tsx
const TRADE_CONFIG = {
  demolition: { label: "Demolition", color: "bg-red-100 text-red-700" },
  foundation: { label: "Foundation", color: "bg-stone-100 text-stone-700" },
  framing: { label: "Framing", color: "bg-amber-100 text-amber-700" },
  roofing: { label: "Roofing", color: "bg-orange-100 text-orange-700" },
  siding: { label: "Siding", color: "bg-lime-100 text-lime-700" },
  windows: { label: "Windows", color: "bg-cyan-100 text-cyan-700" },
  plumbing: { label: "Plumbing", color: "bg-blue-100 text-blue-700" },
  electrical: { label: "Electrical", color: "bg-yellow-100 text-yellow-700" },
  hvac: { label: "HVAC", color: "bg-teal-100 text-teal-700" },
  insulation: { label: "Insulation", color: "bg-pink-100 text-pink-700" },
  drywall: { label: "Drywall", color: "bg-slate-100 text-slate-700" },
  flooring: { label: "Flooring", color: "bg-emerald-100 text-emerald-700" },
  painting: { label: "Painting", color: "bg-violet-100 text-violet-700" },
  kitchen: { label: "Kitchen", color: "bg-fuchsia-100 text-fuchsia-700" },
  bathroom: { label: "Bathroom", color: "bg-indigo-100 text-indigo-700" },
  landscaping: { label: "Landscaping", color: "bg-green-100 text-green-700" },
};
```

---

## Rentals Page (`app/app/rentals/page.tsx`)

### Date: January 30, 2026 (Updated: January 30, 2026 - Accessibility, Toast, Renewal Feature)

### Design Direction: "Wealth Command Center"
**Decision:** Dark theme with warm gold/amber accents for financial data.
**Rationale:**
- Real estate investors managing wealth need confident, professional aesthetic
- Gold accents for rent/money create visual hierarchy for key metrics
- Dark background (#0a0a0a) reduces eye strain for data-heavy dashboards
- Emerald for positive cash flow, rose for negative creates instant understanding

### Merged Page Architecture
**Decision:** Combine page.tsx and page-content.tsx into single file.
**Rationale:**
- Eliminates dynamic import flicker on page load
- Matches pattern established in Leads, Campaigns, Offers pages
- Simpler maintenance with single file

### Horizontal Stat Chips
**Decision:** Scrollable stat bar with color-coded metrics.
**Implementation:**
```tsx
<StatChip
  label="Monthly Rent"
  value={formatCurrency(amount, true)}
  icon={Banknote}
  color="gold"
  highlight  // Adds ring glow effect
/>
```
**Stats displayed:**
- Properties (blue)
- Leased count + vacant subtext (emerald)
- Monthly Rent (gold, highlighted)
- Cash Flow with trend arrow (emerald/rose based on +/-)
- Avg Cap Rate (color-coded by performance)
- Portfolio Value (default)
- Expiring Leases (amber, conditional)
- Open Tickets (amber, conditional)

### OccupancyGauge Component
**Decision:** SVG circular progress indicator for occupancy rate.
**Implementation:**
```tsx
function OccupancyGauge({ percentage, size = "md" }) {
  // Color coding:
  // >= 90%: emerald with glow
  // >= 70%: amber with glow
  // < 70%: rose with glow
}
```
**Sizes:** sm (48px), md (64px), lg (80px)
**Features:**
- Animated stroke-dashoffset transition
- Drop shadow glow effect
- Percentage displayed in center

### LeaseCountdown Component
**Decision:** Color-coded urgency indicator for lease expiration.
**Implementation:**
```tsx
// Color thresholds:
// Expired: gray
// <= 30 days: rose (urgent)
// <= 60 days: amber (warning)
// <= 90 days: yellow (attention)
// > 90 days: emerald (healthy)
```

### CashFlowIndicator Component
**Decision:** Inline positive/negative cash flow display.
**Implementation:**
```tsx
function CashFlowIndicator({ amount }) {
  const isPositive = amount >= 0;
  return (
    <div className={isPositive ? "text-emerald-400" : "text-rose-400"}>
      {isPositive ? <TrendingUp /> : <TrendingDown />}
      {formatCurrency(Math.abs(amount))}
    </div>
  );
}
```

### RentalCard Component
**Decision:** Visual property cards with comprehensive metrics.
**Features:**
- Status gradient bar at top (emerald=leased, gray=vacant, blue=listed, amber=maintenance)
- Address with city/state
- Property stats (beds, baths, sqft)
- OccupancyGauge in header
- Metrics grid: Rent (gold), Cash Flow (colored), Cap Rate (colored)
- Status badge + LeaseCountdown in footer
- Tenant count and maintenance ticket indicators
- Hover: shadow lift effect, amber text highlight

### Grid/List View Toggle
**Decision:** Dual view modes for property display.
**Grid View:** 1/2/3 columns responsive, full property cards
**List View:** Compact horizontal rows with:
- Status gradient sidebar (1px rounded bar)
- Address + status badge inline
- Rent, Cash Flow, Occupancy metrics
- Hover highlight to amber

### RentalDetailSheet Component
**Decision:** Right-side slide-out panel (540px) with tabbed interface.
**Tabs:**
1. **Overview** - Key metrics cards, lease info (if leased), recent payments
2. **Tenants** - TenantCard components with contact info, payment status, lease dates
3. **Financials** - FinancialSummary with income/expense breakdown, property value
4. **Maintenance** - MaintenanceCard components with priority/status badges

**Header Features:**
- Status-colored gradient background
- Property address and location
- OccupancyGauge (lg size)
- Quick stats grid (beds, baths, sqft, year)

**Footer Actions:**
- Edit button (outline)
- Record Payment button (gold gradient)

### TenantCard Component
**Decision:** Contact-focused tenant display with payment status.
**Features:**
- Avatar with UserCircle icon
- Payment status badge (current=emerald, late=amber, delinquent=rose)
- Email and phone with icons
- Monthly rent (amber)
- Lease end with countdown for expiring leases

### MaintenanceCard Component
**Decision:** Ticket-style display for maintenance requests.
**Features:**
- Priority badge (low=gray, medium=blue, high=amber, urgent=rose)
- Status badge (open=blue, in_progress=amber, completed=emerald, cancelled=gray)
- Title and description (2-line clamp)
- Cost display (rose for expenses)
- Created date and vendor info in footer

### FinancialSummary Component
**Decision:** Comprehensive financial breakdown for property detail view.
**Sections:**
1. Key metrics grid: Monthly Cash Flow (gradient card), Cap Rate
2. Monthly Breakdown: Income vs Expenses header, itemized expense list
3. Property Value: Purchase, Current Market Value, Equity

### Financial Calculations
**Implementation:**
```tsx
// Monthly expenses
const monthlyExpenses = mortgage + propertyTax + insurance + hoa + utilities + maintenanceReserve;

// Cash flow
const monthlyCashFlow = monthlyRent - monthlyExpenses;

// Cap rate (NOI / Purchase Price)
const annualNOI = (monthlyRent - monthlyExpenses + mortgage) * 12;
const capRate = (annualNOI / purchasePrice) * 100;

// Cash-on-cash return (assuming 25% down payment)
const annualCashFlow = monthlyCashFlow * 12;
const cashOnCash = (annualCashFlow / (purchasePrice * 0.25)) * 100;
```

### Seed Data Structure
**Location:** `app/app/rentals/seed-data.ts`
**Coverage:**
- 10 rental properties across Florida
- Status distribution: 5 leased, 2 vacant, 1 listed, 1 maintenance, 1 premium
- Tenants with payment history
- Maintenance requests with various priorities/statuses
- Realistic financial data (purchase price, rent, expenses)

### Dark Mode Styling
**Decision:** Explicit dark theme colors throughout.
**Key classes:**
- Background: `bg-[#0a0a0a]`
- Card surfaces: `bg-white/[0.03]` to `bg-white/[0.06]` on hover
- Borders: `border-white/10` to `border-white/20` on hover
- Text: `text-white`, `text-gray-400`, `text-gray-500`
- Input focus: `focus:border-amber-500/50 focus:ring-amber-500/20`
- Select dropdown: `bg-[#1a1a1a] border-white/10`

### Status Configuration
**Implementation:**
```tsx
const STATUS_CONFIG = {
  vacant: {
    gradient: "from-gray-400 to-gray-500",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/30"
  },
  leased: {
    gradient: "from-emerald-400 to-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30"
  },
  maintenance: {
    gradient: "from-amber-400 to-amber-500",
    // ...
  },
  listed: {
    gradient: "from-blue-400 to-blue-500",
    // ...
  },
};
```

### Accessibility: Sheet Title for Screen Readers
**Issue:** Console error "DialogContent requires a DialogTitle for the component to be accessible for screen reader users"
**Decision:** Add visually hidden SheetTitle to satisfy Radix accessibility requirements.
**Implementation:**
```tsx
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

<SheetContent side="right" className="...">
  <VisuallyHidden>
    <SheetTitle>Property Details: {rental.address}</SheetTitle>
  </VisuallyHidden>
  {/* Visible h2 header already provides visual title */}
  <h2 className="text-xl font-bold">{rental.address}</h2>
</SheetContent>
```
**Rationale:** The visible h2 serves as the visual title, while VisuallyHidden SheetTitle satisfies screen reader requirements without duplicate visible text.

### Toast Notifications (IMPORTANT)
**Issue:** Buttons in RentalDetailSheet weren't showing feedback when clicked.
**Root Cause:** Initially imported `toast` from `sonner`, but project uses shadcn/ui `useToast` hook.
**Decision:** Use project's toast system consistently.
**Implementation:**
```tsx
// CORRECT - shadcn/ui toast
import { useToast } from "@/components/ui/use-toast";

function RentalDetailSheet({ rental, open, onClose }) {
  const { toast } = useToast(); // Must be called at component top level, before any early returns

  const handleEdit = () => {
    toast({
      title: "Edit Property",
      description: `Opening editor for ${rental.address}...`,
    });
  };

  const handleRecordPayment = () => {
    toast({
      title: "Payment Recorded",
      description: `Payment dialog would open for ${rental.address}`,
    });
  };
  // ...
}

// WRONG - sonner is not used in this project
import { toast } from "sonner"; // ❌ Don't use
toast.success("Message"); // ❌ Wrong API
```
**Rationale:** The Toaster component in `app/layout.tsx` uses shadcn's toast system, not sonner.

### CashFlowIndicator Centering
**Issue:** Cash flow values weren't centered like other metrics in the card grid.
**Decision:** Add `justify-center` to CashFlowIndicator flex container.
**Implementation:**
```tsx
function CashFlowIndicator({ amount }: { amount: number }) {
  const isPositive = amount >= 0;
  return (
    <div className={cn(
      "flex items-center justify-center gap-1 font-bold tabular-nums text-sm", // Added justify-center
      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
    )}>
      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      <span>{formatCurrency(Math.abs(amount))}</span>
    </div>
  );
}
```
**Rationale:** Visual consistency with other metrics in the 3-column grid (Rent, Cash Flow, Cap Rate).

### Lease Renewal Feature
**Decision:** Add "Send Renewal Contract" button for properties with leases expiring within 60 days.
**Implementation:**
```tsx
// Calculate expiration and conditional display
const daysUntilExpiration = getDaysUntil(rental.leaseEnd);
const showRenewalOption = rental.status === "leased" &&
  daysUntilExpiration !== null &&
  daysUntilExpiration <= 60 &&
  daysUntilExpiration >= 0;

// Renewal button with amber gradient
{showRenewalOption && (
  <Button
    onClick={handleSendRenewal}
    className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
  >
    <Send className="h-4 w-4 mr-2" />
    Send Renewal Contract
    <span className="ml-2 text-xs opacity-80">({daysUntilExpiration}d left)</span>
  </Button>
)}
```
**Styling:**
- Full-width button positioned above Edit/Record Payment buttons
- Amber-to-yellow gradient matches gold financial theme
- Days remaining badge provides urgency context
- Only shows for leased properties within 60-day window

### Action Button Footer Layout
**Decision:** Two-row layout with conditional renewal button.
**Implementation:**
```tsx
<div className="border-t p-4 space-y-2">
  {/* Conditional renewal button (full width) */}
  {showRenewalOption && (
    <Button className="w-full ...">Send Renewal Contract</Button>
  )}
  {/* Edit and Record Payment buttons (side by side) */}
  <div className="flex gap-2">
    <Button variant="outline" className="flex-1" onClick={handleEdit}>
      <Edit className="h-4 w-4 mr-2" />
      Edit
    </Button>
    <Button className="flex-1" onClick={handleRecordPayment}>
      <Receipt className="h-4 w-4 mr-2" />
      Record Payment
    </Button>
  </div>
</div>
```

### Theme Support Update
**Decision:** Use theme variables instead of hardcoded dark colors for better theme compatibility.
**Changes:**
- Background: `bg-card` instead of `bg-[#0a0a0a]`
- Text: `text-foreground` and `text-muted-foreground` instead of `text-white`/`text-gray-400`
- Borders: `border-border` instead of `border-white/10`
**Rationale:** Works with both light and dark mode without explicit dark: variants everywhere.

---

## Vendors Page (`app/app/vendors/page.tsx`)

### Date: January 30, 2026

### Design Direction: "Vendor Command Center"
**Decision:** Professional vendor management interface with trade-colored visual system.
**Rationale:**
- Vendors are categorized by trade (roofing, plumbing, etc.) - color coding provides instant recognition
- Reliability gauges give at-a-glance vendor quality assessment
- Clean header design prioritizes readability over decoration

### Merged Page Architecture
**Decision:** Combine page.tsx and page-content.tsx into single file.
**Rationale:**
- Eliminates dynamic import flicker on page load
- Matches pattern established across other redesigned pages

### TRADE_CONFIG Color System
**Decision:** Use consistent color-coded trade badges with icons.
**Configuration:**
```tsx
const TRADE_CONFIG = {
  roofing: { label: "Roofing", color: "bg-orange-100 text-orange-700", gradient: "from-orange-400 to-orange-500", icon: Home },
  plumbing: { label: "Plumbing", color: "bg-blue-100 text-blue-700", gradient: "from-blue-400 to-blue-500", icon: Droplet },
  electrical: { label: "Electrical", color: "bg-yellow-100 text-yellow-700", gradient: "from-yellow-400 to-yellow-500", icon: Zap },
  hvac: { label: "HVAC", color: "bg-teal-100 text-teal-700", gradient: "from-teal-400 to-teal-500", icon: Wind },
  landscaping: { label: "Landscaping", color: "bg-green-100 text-green-700", gradient: "from-green-400 to-green-500", icon: Trees },
  'general-contractor': { label: "General", color: "bg-slate-100 text-slate-700", gradient: "from-slate-400 to-slate-500", icon: HardHat },
  painting: { label: "Painting", color: "bg-violet-100 text-violet-700", gradient: "from-violet-400 to-violet-500", icon: Paintbrush },
  flooring: { label: "Flooring", color: "bg-emerald-100 text-emerald-700", gradient: "from-emerald-400 to-emerald-500", icon: Square },
  demolition: { label: "Demolition", color: "bg-red-100 text-red-700", gradient: "from-red-400 to-red-500", icon: Hammer },
  framing: { label: "Framing", color: "bg-amber-100 text-amber-700", gradient: "from-amber-400 to-amber-500", icon: Building },
};
```
**Usage:**
- Card gradient stripe at top uses `gradient` property
- Trade icon badge uses `color` property for background
- Filter chips use `color` property

### ReliabilityGauge Component
**Decision:** SVG circular gauge showing vendor reliability percentage.
**Implementation:**
```tsx
function ReliabilityGauge({ percentage, size = "md" }) {
  // Color thresholds:
  // >= 90%: emerald
  // >= 75%: amber
  // >= 50%: orange
  // < 50%: rose
}
```
**Sizes:** sm (40px), md (48px), lg (64px)
**Features:**
- Circular progress with colored stroke
- Percentage displayed in center
- Used in both card and detail sheet header

### VendorCard Component
**Decision:** Visual cards with trade identity and key metrics.
**Features:**
- Trade-colored gradient stripe at top (1.5px height)
- Vertical trade-colored bar on left (list view)
- Trade icon in colored badge
- Vendor name with verified badge
- Star rating with review count
- Location with MapPin icon
- Quick stats row: Reviews, Min Rate, Reliability Gauge
- Availability badge in footer
- Hover lift effect

### Clean Detail Sheet Header
**Decision:** Remove heavy gradient, use subtle neutral background.
**Before:**
```tsx
<div className={cn("bg-gradient-to-br p-6", tradeConfig.gradient + "/10")}>
```
**After:**
```tsx
<div className="shrink-0 p-6 border-b bg-muted/30">
```
**Rationale:** The trade-colored gradient made text and rating elements harder to read. Neutral background with trade color only in the icon badge provides cleaner visual hierarchy.

### Status Card as Full Colored Block
**Decision:** Display availability status as full colored stat card instead of pill inside card.
**Before:**
```tsx
<div className="text-center p-2 rounded-lg bg-background border">
  <Badge className={cn("text-xs", availability.className)}>
    {availability.label}
  </Badge>
</div>
```
**After:**
```tsx
<div className={cn("text-center p-2 rounded-lg border", availability.className)}>
  <span className="font-bold">{availability.label}</span>
  <p className="text-[10px] opacity-70 mt-0.5">Status</p>
</div>
```
**Rationale:** Consistent visual treatment with other stat cards - the color fills the entire card rather than being a small pill, making status more prominent.

### Availability Status Configuration
**Implementation:**
```tsx
const availabilityConfig = {
  available: { label: "Available", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  limited: { label: "Limited", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  booked: { label: "Booked", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  unknown: { label: "Unknown", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
};
```

### Stat Chips in Detail Header
**Decision:** Use clean bordered stat cards instead of translucent overlays.
**Implementation:**
```tsx
<div className="grid grid-cols-4 gap-3 mt-4">
  <div className="text-center p-2 rounded-lg bg-background border">
    <div className="flex items-center justify-center gap-1 text-amber-600">
      <Star className="h-4 w-4 fill-current" />
      <span className="font-bold">{rating}</span>
    </div>
    <p className="text-[10px] text-muted-foreground mt-0.5">Rating</p>
  </div>
  {/* Reviews, Min Rate, Status cards follow same pattern */}
</div>
```
**Rationale:** `bg-background border` provides consistent styling that works in both light and dark modes without transparency issues.

### Grid/List View Toggle
**Decision:** Dual view modes matching other pages.
**Grid View:** 1/2/3 columns responsive, full vendor cards
**List View:** Compact horizontal rows with:
- Trade gradient bar on left
- Trade icon badge
- Vendor name + verified badge
- Location
- Rating, reviews, rate inline
- Reliability gauge (sm size)
- Availability badge

### Seed Data Integration
**Decision:** Combine API data with seed data for demo purposes.
**Implementation:**
```tsx
const effectiveVendors = useMemo(() => {
  const apiConverted = apiVendors.map(convertApiVendor);
  const seedWithFlag = seedVendors.map(v => ({ ...v, isDemo: true }));
  const apiWithFlag = apiConverted.map(v => ({ ...v, isDemo: false }));
  return [...apiWithFlag, ...seedWithFlag];
}, [apiVendors]);
```
**Coverage:** 12 demo vendors across Arizona and Nevada, covering all trade types and availability statuses.

---

## Documents Page (`app/app/documents/page.tsx`)

### Date: January 31, 2026

### Design Direction: "Document Command Center"
**Decision:** Professional document management interface with status-driven visual hierarchy.
**Rationale:**
- Documents have clear lifecycle states (draft → sent → signed/expired/void)
- Color-coded status system provides instant recognition of document state
- Multiple view modes (table, kanban, packets) accommodate different workflows

### Three-Panel Layout
**Decision:** Left sidebar (folders) + main content area + right detail sheet.
**Implementation:**
```tsx
<div className="h-full flex flex-col overflow-hidden">
  <div className="flex-1 min-h-0 flex gap-3 p-3">
    {/* Left Sidebar - 224px fixed width */}
    <div className="w-56 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
      {/* New Document button, Quick Access, Folders tree, Storage indicator */}
    </div>

    {/* Main Content - flexible width */}
    <div className="flex-1 min-w-0 flex flex-col border rounded-lg bg-card overflow-hidden">
      {/* Header, Metrics bar, Filters, Content area with view modes */}
    </div>
  </div>
</div>
```

### Status Configuration System
**Decision:** Centralized status config with colors, gradients, and icons.
**Implementation:**
```tsx
const statusConfig: Record<DocumentStatus, {
  color: string;
  bgColor: string;
  gradient: string;
  icon: typeof FileText;
  label: string;
}> = {
  draft: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    gradient: 'from-slate-400 to-slate-500',
    icon: FileText,
    label: 'Draft'
  },
  sent: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    gradient: 'from-blue-400 to-blue-500',
    icon: Send,
    label: 'Awaiting Signature'
  },
  signed: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    gradient: 'from-emerald-400 to-emerald-500',
    icon: CheckCircle,
    label: 'Signed'
  },
  void: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    gradient: 'from-red-400 to-red-500',
    icon: XCircle,
    label: 'Void'
  },
  expired: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    gradient: 'from-amber-400 to-amber-500',
    icon: AlertCircle,
    label: 'Expired'
  },
};
```
**Usage:**
- Table rows use `bgColor` for type icon background
- Kanban columns use gradient dot indicator
- Cards use `gradient` for top status bar
- Badges combine `bgColor` and `color` classes

### Document Type Icons
**Decision:** Map document types to distinct Lucide icons.
**Implementation:**
```tsx
const docTypeIcons: Record<Document['docType'], typeof FileText> = {
  LOI: FileSignature,
  PSA: FileCheck,
  JV: Users,
  Assignment: GitBranch,
  NDA: Lock,
  Addendum: FilePlus,
  Other: FileText,
};
```

### Three View Modes
**Decision:** Support table, kanban, and packets views with toggle.
**Implementation:**
```tsx
<div className="flex items-center border rounded-md">
  <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} onClick={() => setViewMode('table')}>
    <List className="h-4 w-4" />
  </Button>
  <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} onClick={() => setViewMode('kanban')}>
    <LayoutGrid className="h-4 w-4" />
  </Button>
  <Button variant={viewMode === 'packets' ? 'secondary' : 'ghost'} onClick={() => setViewMode('packets')}>
    <Package className="h-4 w-4" />
  </Button>
</div>
```

**Table View:**
- Checkbox selection for bulk operations
- Document icon with status-colored background
- Tags displayed as outline badges
- Signer avatars with status-colored backgrounds
- Actions dropdown with status-aware options

**Kanban View:**
- 5 columns (draft, sent, signed, expired, void)
- DocumentCard components with hover effects
- Empty state dashed placeholder

**Packets View:**
- Card-based packet display
- Nested document list with order numbers
- Actions dropdown per packet

### DocumentCard Component (Kanban)
**Decision:** Compact card with status gradient bar and signer indicators.
**Props:**
```tsx
function DocumentCard({
  doc,
  onClick,
  onView,
  onDownload,
  onSend,
}: {
  doc: Document;
  onClick: () => void;
  onView: () => void;
  onDownload: () => void;
  onSend: () => void;
})
```
**Features:**
- Status gradient bar at top (1px height)
- Type icon in status-colored badge
- Document title with hover highlight
- DocType badge + version number
- Related entity name
- Signer role circles with status colors
- Dropdown menu on hover (opacity transition)

### Horizontal Stat Chips
**Decision:** Compact metrics bar below header.
**Implementation:**
```tsx
<div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
  <StatChip icon={FileText} label="total" value={metrics.total} color="gray" />
  <StatChip icon={Send} label="awaiting" value={metrics.byStatus.sent} color="blue" />
  <StatChip icon={CheckCircle} label="signed" value={metrics.byStatus.signed} color="emerald" />
  <StatChip icon={Clock} label="avg time" value={`${metrics.avgSigningTimeHours}h`} color="purple" />
  <StatChip icon={Layers} label="templates" value={metrics.templatesActive} color="amber" />
</div>
```

### Folder Navigation Tree
**Decision:** Recursive folder rendering with expand/collapse.
**Implementation:**
```tsx
const renderFolderTree = (parentId?: string, level = 0) => {
  const folders = documentsSeedData.folders.filter(f => f.parentFolderId === parentId);
  return folders.map(folder => {
    const hasChildren = documentsSeedData.folders.some(f => f.parentFolderId === folder.id);
    const isExpanded = expandedFolders.includes(folder.id);
    // ... render folder with chevron, icon, name, doc count
    {hasChildren && isExpanded && renderFolderTree(folder.id, level + 1)}
  });
};
```
**Features:**
- Indentation based on level (`paddingLeft: ${level * 12 + 8}px`)
- ChevronRight/ChevronDown for expandable folders
- Document count badge
- Selected state highlighting

### Document Viewer Sheet
**Decision:** 540px right-side panel with tabbed interface.
**Implementation:**
```tsx
<Sheet open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
  <SheetContent className="w-[540px] sm:max-w-[540px] bg-white dark:bg-gray-900 p-0 flex flex-col">
    <VisuallyHidden.Root>
      <SheetTitle>Document Details</SheetTitle>
    </VisuallyHidden.Root>
    {/* Status gradient header, document info, action buttons */}
    {/* 4 tabs: Details, Signers, Versions, Audit */}
  </SheetContent>
</Sheet>
```
**Tabs:**
1. **Details** - Related entity, created by, dates, tags
2. **Signers** - Role cards with status badges
3. **Versions** - Version history with view buttons
4. **Audit** - Activity timeline with action icons

### Action Handlers (Toast Placeholders)
**Decision:** All document actions show toast notifications as placeholders for backend integration.
**Implementation:**
```tsx
const handleSendDocument = (doc: Document) => {
  toast({
    title: "Document sent",
    description: `${doc.title} has been sent for signature.`,
  });
};

const handleDownloadDocument = (doc: Document) => {
  toast({
    title: "Download started",
    description: `Downloading ${doc.title}...`,
  });
};

const handleEditDocument = (doc: Document) => {
  setSelectedDocument(doc);
  setShowDocumentViewer(true);
  toast({
    title: "Edit mode",
    description: `Editing ${doc.title}`,
  });
};

const handleDuplicateDocument = (doc: Document) => {
  toast({
    title: "Document duplicated",
    description: `Created copy of ${doc.title}`,
  });
};

const handleArchiveDocument = (doc: Document) => {
  toast({
    title: "Document archived",
    description: `${doc.title} has been archived.`,
  });
};

const handleVoidDocument = (doc: Document) => {
  toast({
    title: "Document voided",
    description: `${doc.title} has been voided.`,
    variant: "destructive",
  });
};

const handleNewVersion = (doc: Document) => {
  setSelectedDocument(doc);
  toast({
    title: "Creating new version",
    description: `Starting new version of ${doc.title}`,
  });
};

const handleResendDocument = (doc: Document) => {
  toast({
    title: "Reminder sent",
    description: `Signature reminder sent for ${doc.title}`,
  });
};

const handleViewDocument = (doc: Document) => {
  setSelectedDocument(doc);
  setShowDocumentViewer(true);
};
```
**Rationale:** Toast notifications provide immediate UI feedback. Backend integration will replace these with actual API calls.

### Status-Aware Action Visibility
**Decision:** Show/hide actions based on document status.
**Implementation:**
```tsx
{doc.status === 'draft' && (
  <>
    <DropdownMenuItem onClick={() => handleEditDocument(doc)}>Edit</DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleSendDocument(doc)}>Send</DropdownMenuItem>
  </>
)}
{doc.status === 'sent' && (
  <DropdownMenuItem onClick={() => handleResendDocument(doc)}>Resend</DropdownMenuItem>
)}
{doc.status !== 'void' && (
  <DropdownMenuItem className="text-red-600" onClick={() => handleVoidDocument(doc)}>Void</DropdownMenuItem>
)}
```
**Logic:**
- Edit/Send only for drafts
- Resend only for sent documents
- Void available for all except already voided

### Template Library Dialog
**Decision:** Full-width dialog with category tabs.
**Implementation:**
- 5 category tabs: Acquisition, Assignment, Partnership, Legal, Modification
- Template cards with category-colored gradient bars
- Template info: name, type, version, description, pages, signers
- "Use Template" button triggers `handleUseTemplate`

### Packet Builder Dialog
**Decision:** Step-by-step packet creation wizard.
**Features:**
- Packet type selector (Acquisition, Assignment, Disposition, JV, Custom)
- Packet name input
- Related deal selector
- Document checklist based on packet type
- Generate Packet button

### Seed Data Structure
**Location:** `app/app/documents/seed-data.ts`
**Types:**
```tsx
interface Document {
  id: string;
  title: string;
  docType: 'LOI' | 'PSA' | 'JV' | 'Assignment' | 'NDA' | 'Addendum' | 'Other';
  status: 'draft' | 'sent' | 'signed' | 'void' | 'expired';
  version: number;
  folderId: string;
  tags: string[];
  relatedEntity: 'deal' | 'property' | 'project' | null;
  relatedId: string | null;
  relatedName: string | null;
  signerRoles: SignerRole[];
  auditLog: AuditEvent[];
  // dates and metadata
}

interface Folder {
  id: string;
  name: string;
  parentFolderId?: string;
  iconType?: 'deals' | 'global' | 'templates' | 'archive';
}

interface DocumentTemplate {
  id: string;
  name: string;
  docType: Document['docType'];
  category: 'Acquisition' | 'Assignment' | 'Partnership' | 'Legal' | 'Modification';
  description: string;
  estimatedPages: number;
  rolesSchema: { role: string; required: boolean }[];
  version: string;
}

interface Packet {
  id: string;
  name: string;
  packetType: 'Acquisition' | 'Assignment' | 'Disposition' | 'JV' | 'Custom';
  status: string;
  packetItems: PacketItem[];
  relatedDealName: string;
}
```
**Helper Functions:**
- `getDocumentsByFolder(folderId)` - Filter documents by folder
- `getTemplatesByCategory(category)` - Filter templates by category
- `getDocumentVersions(documentId)` - Get version history
- `calculateDocumentMetrics()` - Compute stats for metrics bar

---

## Tasks Page (`app/app/tasks/page-content.tsx`)

### Date: January 30, 2026

### Viewport-Fitting Layout Pattern (CRITICAL)

**Issue:** Pages with tables/lists would extend past the viewport, causing page-level scrolling instead of content-area scrolling. The content wouldn't fit properly within the app layout.

**Root Cause:** The app layout (`app/app/layout.tsx`) already provides:
```tsx
<main className="p-6 h-[calc(100dvh-4rem)] overflow-hidden">
  {children}
</main>
```

Child pages were adding EXTRA padding and calculating their own heights, causing conflicts.

**Solution:** Child pages should use `h-full` to fill the space provided by the layout, NOT calculate their own heights.

**Correct Implementation:**
```tsx
// page-content.tsx - DO THIS
return (
  <>
    <div className="h-full flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-card overflow-hidden">
      {/* Header - fixed height, won't shrink */}
      <div className="shrink-0 border-b px-6 py-4">
        <h1>Tasks</h1>
        <p>Subtitle</p>
      </div>

      {/* Toolbar - fixed height, won't shrink */}
      <div className="shrink-0 border-b px-6 py-3">
        <FilterBar />
        <SearchInput />
      </div>

      {/* Content - fills remaining space, scrolls internally */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-card z-10">...</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => <TableRow key={item.id}>...</TableRow>)}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>

    {/* Modals/Sheets as siblings */}
    <Sheet>...</Sheet>
    <Dialog>...</Dialog>
  </>
);
```

**WRONG - Don't do this:**
```tsx
// ❌ Adding padding that conflicts with layout's p-6
<div className="p-6 h-[calc(100vh-4rem)]">

// ❌ Calculating own height instead of using h-full
<div className="h-[calc(100vh-4rem)]">

// ❌ Missing min-h-0 on flex-1 container (content won't scroll)
<div className="flex-1 overflow-hidden">

// ❌ Missing shrink-0 on headers (they'll collapse)
<div className="border-b px-6 py-4">
```

### Critical CSS Classes Explained

| Class | Purpose | Without It |
|-------|---------|------------|
| `h-full` | Fill parent's height | Page won't fill viewport |
| `flex flex-col` | Stack children vertically | Can't separate header/content |
| `shrink-0` | Prevent element from shrinking | Headers collapse when content grows |
| `flex-1` | Take remaining space | Content area won't expand |
| `min-h-0` | Allow shrinking below content height | ScrollArea won't scroll |
| `overflow-hidden` | Hide overflow, enable scroll children | Double scrollbars appear |

### Fragment Wrapper Pattern
**Decision:** Use React Fragment when page has both main content and sibling components (Sheet, Dialog).
**Implementation:**
```tsx
return (
  <>
    <div className="h-full ...">
      {/* Main page content */}
    </div>
    <TaskDetailSheet task={selectedTask} ... />
    <Dialog open={createDialogOpen} ...>...</Dialog>
  </>
);
```
**Rationale:** Sheet and Dialog components render via portals but need to be in the component tree. Fragment allows multiple top-level elements without adding an extra DOM wrapper.

### Scrollable Table with Sticky Header
**Decision:** Use ScrollArea with sticky table headers for long lists.
**Implementation:**
```tsx
<div className="flex-1 min-h-0 overflow-hidden">
  <ScrollArea className="h-full">
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-b">
          <TableHead className="sticky top-0 bg-card z-10">Column 1</TableHead>
          <TableHead className="sticky top-0 bg-card z-10">Column 2</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id}>...</TableRow>
        ))}
      </TableBody>
    </Table>
  </ScrollArea>
</div>
```
**Key points:**
- Parent div needs `flex-1 min-h-0 overflow-hidden`
- ScrollArea needs `className="h-full"`
- Each TableHead needs `sticky top-0 bg-card z-10`
- bg-card ensures header background matches when scrolling

### Consistent Section Padding
**Decision:** Use `px-6` consistently for all horizontal sections within the bordered container.
**Implementation:**
```tsx
<div className="h-full flex flex-col border rounded-lg">
  <div className="shrink-0 border-b px-6 py-4">Header</div>
  <div className="shrink-0 border-b px-6 py-3">Toolbar</div>
  <div className="flex-1 min-h-0">
    {/* Table doesn't need px-6 - cells have internal padding */}
  </div>
</div>
```
**Rationale:** Consistent `px-6` ensures header, toolbar, and table columns align visually.

### Loading State Pattern
**Decision:** Use same h-full pattern for loading states.
**Implementation:**
```tsx
if (!isLoaded) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
```
**Rationale:** Loading state should fill the same space as loaded content.

---

## Analytics Page - Team Tab (`app/app/analytics/page.tsx`)

### Date: January 31, 2026

### Design Direction: "Team Command Center"
**Decision:** Professional team performance dashboard with paginated table view.
**Rationale:**
- Teams can scale to many members - pagination prevents endless scrolling
- Table view provides dense data presentation for comparing metrics
- Static table (no scroll) with pagination keeps all content in viewport

### Team Tab Architecture
**Decision:** Split into stat cards + paginated table within viewport.
**Implementation:**
```tsx
{/* Team Stats Cards - 4 color-coded cards */}
<div className="grid grid-cols-4 gap-3">
  <Card className="bg-gradient-to-br from-blue-50 ...">Revenue</Card>
  <Card className="bg-gradient-to-br from-emerald-50 ...">Team Members</Card>
  <Card className="bg-gradient-to-br from-amber-50 ...">Win Rate</Card>
  <Card className="bg-gradient-to-br from-purple-50 ...">Response</Card>
</div>

{/* Team Table - static, no scroll */}
<Card>
  <CardHeader>Team Performance + Search + View Toggle</CardHeader>
  <CardContent className="p-0">
    <div>
      <Table>...</Table>
      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-1 border-t">
        <p>Showing X-Y of Z</p>
        <div>Page buttons</div>
      </div>
    </div>
  </CardContent>
</Card>
```

### Page Size Configuration
**Decision:** 9 members per page to fit in viewport without scrolling.
**Implementation:**
```tsx
const TEAM_PAGE_SIZE = 9;
```
**Rationale:**
- 10 members caused pagination to be cut off
- 8 members left too much empty space
- 9 members is optimal for most viewport sizes

### Static Table (No Scroll)
**Decision:** Remove scroll behavior, let pagination handle overflow.
**Before:**
```tsx
<Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <CardContent className="p-0 flex-1 overflow-auto min-h-0">
    <div className="h-full flex flex-col">
```
**After:**
```tsx
<Card>
  <CardContent className="p-0">
    <div>
```
**Rationale:** With pagination, there's no need for internal scrolling - table height is fixed by page size.

### Compact Pagination Footer
**Decision:** Minimal padding to maximize table space.
**Implementation:**
```tsx
<div className="flex items-center justify-between px-4 py-1 border-t">
  <p className="text-xs text-muted-foreground">
    Showing {start}-{end} of {total}
  </p>
  <div className="flex items-center gap-1">
    <Button size="sm" className="h-7 w-7 p-0">...</Button>
  </div>
</div>
```
**Changes:**
- `py-3` → `py-1` (reduced from 12px to 4px vertical padding)
- Keeps pagination controls visible without cutting off

### Table Row Styling
**Decision:** Consistent padding with visual indicators for top performers.
**Implementation:**
```tsx
<TableRow key={member.userId} className="hover:bg-muted/50">
  <TableCell className="py-2">
    <div className="flex items-center gap-2">
      {isTopThree && (
        <div className={cn("flex items-center justify-center w-5", rankColors[globalIndex])}>
          {globalIndex === 0 ? <Crown className="h-4 w-4 fill-current" /> :
           globalIndex === 1 ? <Medal className="h-4 w-4" /> :
           <Award className="h-4 w-4" />}
        </div>
      )}
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
        avatarColors[i % avatarColors.length]
      )}>
        {member.userName.split(' ').map(n => n[0]).join('')}
      </div>
      <span className="text-xs font-medium">{member.userName}</span>
    </div>
  </TableCell>
  {/* ... other cells with py-2 */}
</TableRow>
```
**Features:**
- `py-2` on all cells for consistent vertical rhythm
- Top 3 indicators (Crown, Medal, Award) when sorted by revenue desc
- Rotating avatar colors (6 colors) based on row index

### Demo Data Consistency
**Decision:** Frontend and API fallbacks must match to prevent discrepancies.
**Issue:** Frontend had 4 demo members, API had 14 - caused confusion when API failed.
**Fix:** Updated `DEFAULT_TEAM` in page.tsx to include all 14 members:
```tsx
const DEFAULT_TEAM: TeamMetrics[] = [
  { userId: '1', userName: 'Sarah Chen', role: 'Acquisition', ... },
  { userId: '2', userName: 'Mike Rodriguez', role: 'Acquisition', ... },
  // ... 12 more members
  { userId: '14', userName: 'Ryan Anderson', role: 'Acquisition', ... },
];
```
**Rationale:** If API fails or returns empty, frontend fallback shows consistent 14-member demo.

### API Debug Logging
**Decision:** Add console logs to track team data flow for debugging.
**Implementation:**
```tsx
// In /api/analytics/route.ts
console.log('[Analytics API] Team tab - currentTeamId:', currentUser?.currentTeamId || 'none');
console.log('[Analytics API] Found', teamMembers.length, 'team members in DB');
console.log('[Analytics API] Returning', teamMetrics.length, 'team members (fallback:', teamMetrics.length === 14, ')');
```
**Rationale:** Helps identify whether:
- User has no team assigned (uses 14-member fallback)
- Team exists but has no members (uses 14-member fallback)
- API is returning real data vs fallback

### CustomTooltip Date Handling
**Issue:** Chart tooltips crashed when label was a Date object (React can't render objects).
**Decision:** Format Date objects before rendering.
**Implementation:**
```tsx
function CustomTooltip({ active, payload, label, formatter }) {
  // Format label if it's a Date object
  const formattedLabel = label instanceof Date
    ? label.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    : label;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-lg px-3 py-2">
      {formattedLabel && <p className="text-xs font-medium text-foreground mb-1">{formattedLabel}</p>}
      {/* ... payload items */}
    </div>
  );
}
```
**Rationale:** The trends chart uses Date objects in data. XAxis has tickFormatter, but Tooltip label needed explicit handling.

### Database Schema Requirement
**Issue:** `User.currentTeamId` column didn't exist, causing API 500 errors.
**Fix:** Run Prisma schema sync:
```bash
DATABASE_URL="..." npx prisma db push
```
**Models involved:**
- `User.currentTeamId` - Links user to their active team
- `TeamMember` - Team membership records
- `Activity` - Activity tracking for metrics calculation

---

## Analytics Page - Vendors Tab (`app/app/analytics/page.tsx`)

### Date: January 31, 2026

### Static Tab Layout
**Decision:** Remove ScrollArea wrapper, let content flow naturally.
**Before:**
```tsx
<TabsContent value="vendors" className="flex-1 min-h-0 mt-0 p-0">
  <ScrollArea className="h-full">
    <div className="p-4 space-y-4">
```
**After:**
```tsx
<TabsContent value="vendors" className="mt-0 p-0">
  <div className="p-4 space-y-4">
```
**Rationale:** Vendors tab content doesn't need viewport-filling behavior. Static layout eliminates unnecessary empty space at bottom.

### Vendor Performance Card Height
**Decision:** Increase max height to show more vendors while keeping scroll for overflow.
**Implementation:**
```tsx
<CardContent className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
```
**Change:** `max-h-[300px]` → `max-h-[420px]`
**Rationale:**
- 300px only showed ~3 vendors, cutting off too much content
- 420px shows ~4-5 vendors before needing to scroll
- Still maintains scroll for full vendor list (9 vendors)

### Rating Floating Point Fix
**Issue:** Vendor ratings displayed with floating point precision errors (e.g., `1.7600000000000002`).
**Decision:** Format ratings to 2 decimal places.
**Before:**
```tsx
<span className="text-sm font-bold tabular-nums">{vendor.avgRating}</span>
```
**After:**
```tsx
<span className="text-sm font-bold tabular-nums">{vendor.avgRating.toFixed(2)}</span>
```
**Rationale:** Clean display like `1.76` instead of `1.7600000000000002`.

---

## Underwriting Page - Profit Summary & MAO Waterfall (`app/app/underwriting/`)

### Date: February 6, 2026

### Deal Profit Summary Card
**Decision:** Screenshot-worthy profit card with comprehensive ROI visualization.
**Location:** `app/app/underwriting/deal-profit-summary.tsx`
**Demo:** `/app/demo/profit-summary`
**Implementation:**
```tsx
<DealProfitSummary
  dealType="wholesale" | "flip" | "rental"
  purchasePrice={number}
  arv={number}
  repairs={number}
  holdingMonths={number}
  assumptions={{ /* cost assumptions */ }}
/>
```

**Features:**
- **ROI Gauge** - SVG semi-circular gauge showing return percentage
  - Color-coded thresholds: emerald (20%+), amber (10-20%), rose (<10%)
  - Gradient fill with animated drawing effect
  - Center text showing ROI percentage
- **Timeline Stats Row** - 3-column grid showing:
  - Purchase Price (blue icon container)
  - Total Investment (purple icon container)
  - Projected Profit (emerald icon container)
- **Waterfall Breakdown** - Step-by-step calculation:
  - ARV (starting point)
  - Minus: Repairs, Realtor Commission, Closing Costs, Holding Costs
  - Plus: Rental Income (rental deals only)
  - Equals: Net Profit
  - Each line shows calculation with color-coded values
- **Deal Type Support** - Adapts calculations for:
  - Wholesale: Quick flip, minimal holding costs
  - Flip: Rehab costs, realtor commission, holding costs
  - Rental: Monthly income, long-term holding, equity build

**Styling:**
- Card with gradient border (`border-t-4` with deal-type color)
- Clean section dividers (`border-t`)
- Tabular numbers for alignment (`tabular-nums`)
- Icon containers with gradient backgrounds
- Responsive grid layout (1 col mobile, 3 col desktop)

**Rationale:** Investors need a clear, visual summary of deal profitability that can be easily shared with partners or lenders. The ROI gauge provides instant understanding, while the waterfall shows full transparency of the calculation.

### MAO Waterfall with Full Cost Breakdown
**Decision:** Transparent maximum allowable offer calculation with all costs visible.
**Location:** `app/app/underwriting/mao-waterfall.tsx`
**Integration:** Underwriting page main view
**Implementation:**
```tsx
<MAOWaterfall
  arv={number}
  repairCost={number}
  assumptions={{
    realtorCommission: 6,
    buyClosing: 3,
    sellClosing: 2,
    holdingMonths: 6,
    monthlyHolding: 800,
    profitMargin: 15
  }}
  showSettings={boolean}
/>
```

**Features:**
- **Waterfall Visualization** - Top-down calculation flow:
  1. ARV (After Repair Value) - Starting point in emerald
  2. Minus Repair Cost - Red with wrench icon
  3. Minus Realtor Commission (6% default) - Red with home icon
  4. Minus Buy Closing Costs (3% default) - Red with file icon
  5. Minus Sell Closing Costs (2% default) - Red with receipt icon
  6. Minus Holding Costs (months × monthly) - Red with calendar icon
  7. Minus Profit Target (15% default) - Red with target icon
  8. **= Maximum Allowable Offer** - Large emerald result box
- **Adjustable Assumptions Panel** - Collapsible settings with sliders:
  - Realtor Commission: 0-10% (0.5% steps)
  - Buy Closing: 0-5% (0.5% steps)
  - Sell Closing: 0-5% (0.5% steps)
  - Holding Months: 0-24 (1 month steps)
  - Monthly Holding Cost: $0-$3000 ($100 steps)
  - Profit Margin: 5-30% (1% steps)
- **Percentage Display** - Shows both dollar amounts and % of ARV
- **Icons** - Each line item has contextual Lucide icon
- **Running Total** - Cumulative subtraction visible at each step

**Styling:**
- Clean white/gray card backgrounds
- Red for subtractions (text-rose-600)
- Emerald for final MAO (text-emerald-600)
- Larger font for MAO result (text-2xl font-bold)
- Subtle borders between calculation steps
- Collapsible settings panel with ChevronDown icon

**Calculation Logic:**
```typescript
const totalHoldingCost = assumptions.holdingMonths * assumptions.monthlyHolding;
const realtorCost = arv * (assumptions.realtorCommission / 100);
const buyClosingCost = arv * (assumptions.buyClosing / 100);
const sellClosingCost = arv * (assumptions.sellClosing / 100);
const profitTarget = arv * (assumptions.profitMargin / 100);

const mao = arv - repairCost - realtorCost - buyClosingCost - sellClosingCost - totalHoldingCost - profitTarget;
```

**Rationale:** New investors often struggle to understand why an offer is lower than ARV. The waterfall makes every cost assumption transparent and adjustable, building confidence in the offer calculation.

---

## Contracts Page - Milestone Urgency Badges (`app/app/contracts/page-content.tsx`)

### Date: February 6, 2026

### Contract Milestone Urgency Badges
**Decision:** Color-coded urgency indicators for contract closing dates.
**Location:** `app/app/contracts/page-content.tsx` (integrated into existing table and board views)
**Implementation:**
```tsx
// Calculate days until closing
const daysUntil = closingDate ? Math.ceil((new Date(closingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

// Urgency badge logic
{closingDate && (
  daysUntil !== null && daysUntil < 0 ? (
    <Badge variant="destructive" className="text-xs">
      <AlertCircle className="h-3 w-3 mr-1" />
      Overdue {Math.abs(daysUntil)}d
    </Badge>
  ) : daysUntil !== null && daysUntil <= 3 ? (
    <Badge variant="destructive" className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      URGENT - {daysUntil}d left
    </Badge>
  ) : daysUntil !== null && daysUntil <= 7 ? (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Soon - {daysUntil}d left
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs">
      <Calendar className="h-3 w-3 mr-1" />
      {daysUntil}d left
    </Badge>
  )
)}
```

**Urgency Thresholds:**
- **Overdue** (negative days) - Red destructive badge, AlertCircle icon, shows days past due
- **URGENT** (≤3 days) - Red destructive badge, Clock icon, "URGENT" prefix
- **Soon** (≤7 days) - Amber badge, AlertTriangle icon, "Soon" prefix
- **Normal** (>7 days) - Gray outline badge, Calendar icon, simple countdown

**Display Locations:**
- **Table View** - Closing Date column shows date + urgency badge
- **Kanban Board View** - Card footer shows urgency badge alongside other metadata

**Styling:**
- Icons sized `h-3 w-3` with `mr-1` spacing
- Text size `text-xs` for compact display
- Color consistency:
  - Overdue/Urgent: `variant="destructive"` (red)
  - Soon: `bg-amber-100 text-amber-700` with dark mode support
  - Normal: `variant="outline"` (gray)

**Rationale:** Contract closing deadlines are critical milestones. Visual urgency indicators help teams prioritize time-sensitive contracts and avoid missed deadlines. The 3-day and 7-day thresholds align with common real estate practices (3 days for emergency action, 7 days for final preparations).

---

## Leads Page - Score Breakdown Tooltip (`app/app/leads/page.tsx`)

### Date: February 6, 2026

### Score Breakdown Tooltip
**Decision:** Hover tooltip showing detailed breakdown of lead distress score calculation.
**Location:** `app/app/leads/page.tsx` (integrated into score column)
**Implementation:**
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="cursor-help">
        {/* Score gauge/badge */}
      </div>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <div className="space-y-1">
        <p className="font-semibold text-sm">Score Breakdown</p>
        {scoreBreakdown.length > 0 ? (
          <ul className="text-xs space-y-0.5">
            {scoreBreakdown.map((signal, i) => (
              <li key={i} className="flex justify-between">
                <span>{signal.name}</span>
                <span className="font-mono">+{signal.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No breakdown available</p>
        )}
      </div>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Data Parsing:**
```typescript
// Parse scoreBreakdown JSON if available
let scoreBreakdown: Array<{ name: string; points: number }> = [];
if (property.scoreBreakdown) {
  try {
    scoreBreakdown = JSON.parse(property.scoreBreakdown);
  } catch (e) {
    // Fallback: Generate from distress flags
    scoreBreakdown = [
      property.isForeclosure && { name: "Foreclosure", points: 25 },
      property.isPreForeclosure && { name: "Pre-Foreclosure", points: 20 },
      property.isVacant && { name: "Vacant", points: 15 },
      property.isTaxDelinquent && { name: "Tax Delinquent", points: 15 },
      property.hasLien && { name: "Property Lien", points: 10 }
    ].filter(Boolean);
  }
}
```

**Features:**
- **Hover Activation** - Tooltip appears on hover over score badge
- **Signal List** - Each contributing distress signal with point value
- **Monospace Points** - `font-mono` for aligned point values
- **Fallback Logic** - Generates breakdown from boolean flags if JSON unavailable
- **Max Width** - `max-w-xs` prevents overly wide tooltips
- **Cursor Hint** - `cursor-help` indicates tooltip availability

**Typical Signals & Point Values:**
- Pre-Foreclosure: 25 points
- Auction: 25 points
- Tax Lien: 20 points
- Vacant: 15 points
- Out-of-State Owner: 15 points
- Inherited Property: 15 points
- High Equity: 10 points
- Long-Term Owner: 15 points
- Portfolio Owner: 10 points

**Styling:**
- Clean card with subtle shadow
- Dark mode support via tooltip component defaults
- Space between rows (`space-y-0.5`)
- Flex justify-between for name/points alignment
- Muted text for empty state

**Rationale:** Users see a distress score (0-100) but don't understand why a property scored that way. The breakdown tooltip provides transparency, helping users trust the scoring algorithm and identify which signals are present for each lead.

---

## Overview/Dashboard Page (`app/app/page.tsx`)

### Date: February 3, 2026

### Fixed Height Bottom Cards Pattern
**Issue:** Hot Leads and Today's Actions cards would extend past the viewport, causing page-level scrolling. Multiple approaches were tried:
- `max-h-[480px]` - Cards were too tall or too short depending on content
- `items-stretch` on grid - Cards grew too tall when third column was short
- No max-height - Cards extended well past viewport

**Decision:** Use fixed `h-[510px]` height for Hot Leads and Today's Actions cards to align with the third column (Deal Pipeline + Recent Activity).

**Implementation:**
```tsx
{/* Main grid - Hot leads, Actions, Pipeline */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
  {/* Hot Leads */}
  <Card className="lg:col-span-1 flex flex-col h-[510px]">
    <CardHeader className="pb-2 flex-shrink-0">
      {/* Header content */}
    </CardHeader>
    <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {hotLeads.length > 0 ? (
        <>
          <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
            {/* Scrollable lead items */}
          </div>
          <Link href="/app/leads" className="flex-shrink-0 mt-auto pt-2">
            <Button variant="ghost" className="w-full text-sm">
              View all hot leads
            </Button>
          </Link>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
          {/* Empty state */}
        </div>
      )}
    </CardContent>
  </Card>

  {/* Today's Actions - same pattern */}
  <Card className="flex flex-col h-[510px]">
    {/* Same structure as Hot Leads */}
  </Card>

  {/* Pipeline + Notifications */}
  <div className="flex flex-col gap-6">
    <PipelineFunnel stages={pipelineStages} />
    <NotificationsPreview notifications={notifications} />
  </div>
</div>
```

**Key CSS Classes:**
- `h-[510px]` - Fixed height to match third column
- `items-start` - Grid alignment prevents stretching
- `flex flex-col` - Enables flex layout inside card
- `flex-shrink-0` - Prevents header from shrinking
- `flex-1 min-h-0 overflow-hidden` - Content area fills remaining space
- `overflow-y-auto min-h-0` - Internal scrolling for content
- `mt-auto pt-2` - Pins "View all" button to bottom

**Rationale:** A fixed height of 510px was determined empirically to match the combined height of Deal Pipeline + Recent Activity cards in the third column. This ensures the bottom edges of all three columns align, creating a clean visual layout that fits within the viewport without page-level scrolling.

### Internal Scrolling Pattern
**Decision:** When content exceeds card height, scroll internally rather than growing the card.
**Implementation:**
```tsx
<CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
  <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
    {items.map(item => (
      <div key={item.id}>...</div>
    ))}
  </div>
</CardContent>
```
**Rationale:** Internal scrolling keeps the card at its fixed height while allowing users to view all content. The `min-h-0` on both the CardContent and scrollable div is critical for flex overflow to work.

### Button Pinned to Bottom
**Decision:** "View all" buttons should always appear at the bottom of the card, regardless of content amount.
**Implementation:**
```tsx
<Link href="/app/leads" className="flex-shrink-0 mt-auto pt-2">
  <Button variant="ghost" className="w-full text-sm">
    View all hot leads
    <ArrowRight className="h-4 w-4 ml-2" />
  </Button>
</Link>
```
**Key classes:**
- `flex-shrink-0` - Prevents button from shrinking
- `mt-auto` - Pushes button to bottom of flex container
- `pt-2` - Adds spacing above button

---

## Settings Page (`app/app/settings/page.tsx`)

### Date: February 3, 2026

### Design Direction: "Clean Professional Settings"
**Decision:** Consolidated two-tab interface with all preferences accessible without deep navigation.
**Rationale:**
- Settings should be quick to access and modify
- Grouping related settings reduces cognitive load
- Two-column layout on desktop maximizes screen real estate

### Two-Tab Architecture
**Decision:** Preferences tab for all current settings, Integrations tab as placeholder for future features.
**Implementation:**
```tsx
<Tabs defaultValue="preferences" className="flex-1 flex flex-col min-h-0">
  <TabsList className="w-fit flex-shrink-0">
    <TabsTrigger value="preferences" className="gap-2">
      <Settings className="h-4 w-4" />
      Preferences
    </TabsTrigger>
    <TabsTrigger value="integrations" className="gap-2">
      <Rocket className="h-4 w-4" />
      Integrations
    </TabsTrigger>
  </TabsList>

  <div className="flex-1 min-h-0 mt-4">
    <TabsContent value="preferences" className="h-full mt-0 overflow-auto">
      {/* Two-column grid of settings cards */}
    </TabsContent>
    <TabsContent value="integrations" className="h-full mt-0 overflow-auto">
      {/* Coming soon placeholder */}
    </TabsContent>
  </div>
</Tabs>
```

### Two-Column Grid Layout
**Decision:** Settings organized in a two-column grid on desktop for balanced visual weight.
**Implementation:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8 pr-4">
  {/* Left Column */}
  <div className="space-y-6">
    <Card>{/* Notifications */}</Card>
    <Card>{/* Account & Security */}</Card>
  </div>

  {/* Right Column */}
  <div className="space-y-6">
    <Card>{/* Regional Settings */}</Card>
    <Card>{/* Email Signature */}</Card>
  </div>
</div>
```
**Column Organization:**
- Left: Notifications, Account & Security (action-focused)
- Right: Regional Settings, Email Signature (configuration-focused)

### Notifications Card
**Decision:** Toggle-based controls with conditional sub-options.
**Implementation:**
```tsx
{/* Email Alerts Toggle */}
<div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
  <div className="flex items-center gap-3">
    <Mail className="h-4 w-4 text-muted-foreground" />
    <div>
      <Label className="text-sm">Email Alerts</Label>
      <p className="text-xs text-muted-foreground">Important updates via email</p>
    </div>
  </div>
  <Switch checked={formData.emailAlerts} onCheckedChange={(checked) => updateField("emailAlerts", checked)} />
</div>

{/* Conditional Digest Time Selector */}
{formData.dailyDigest && (
  <div className="space-y-2 pl-3 border-l-2 border-muted ml-2">
    <Label className="text-sm">Digest Time</Label>
    <Select value={formData.digestTime || "08:00"} onValueChange={(value) => updateField("digestTime", value)}>
      {/* Time options */}
    </Select>
  </div>
)}
```
**Rationale:** Sub-options (like digest time) only appear when their parent toggle is enabled, reducing visual clutter.

### Account & Security Card
**Decision:** Minimal security section with external link to Clerk + danger zone for account deletion.
**Implementation:**
```tsx
<Card>
  <CardHeader className="pb-4">
    <div className="flex items-center gap-2">
      <Shield className="h-5 w-5 text-muted-foreground" />
      <CardTitle className="text-base">Account & Security</CardTitle>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* External link to Clerk */}
    <Button variant="outline" size="sm" onClick={() => window.open("https://accounts.clerk.dev/user", "_blank")}>
      <ExternalLink className="h-4 w-4 mr-2" />
      Manage Security
    </Button>

    {/* Danger Zone */}
    <div className="pt-4 border-t">
      <div className="flex items-center gap-2 text-destructive mb-3">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">Danger Zone</span>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        {/* Confirmation dialog content */}
      </AlertDialog>
      <p className="text-xs text-muted-foreground mt-2">Disabled during beta</p>
    </div>
  </CardContent>
</Card>
```
**Rationale:** Security is managed by Clerk; we provide a link rather than duplicating functionality. Account deletion is included but disabled during beta.

### Email Signature Card
**Decision:** Toggle-controlled signature form with live preview.
**Implementation:**
```tsx
<Card>
  <CardHeader className="pb-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Email Signature</CardTitle>
      </div>
      <Switch
        checked={formData.emailSignatureEnabled ?? false}
        onCheckedChange={(checked) => updateField("emailSignatureEnabled", checked)}
      />
    </div>
    <CardDescription className="text-xs">Appended to outbound emails</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Input fields - disabled when signature is off */}
    <Input disabled={!formData.emailSignatureEnabled} placeholder="John Smith" />
    <Input disabled={!formData.emailSignatureEnabled} placeholder="Company Name" />
    <Textarea disabled={!formData.emailSignatureEnabled} placeholder="Best regards,..." rows={4} />

    {/* Live Preview */}
    {formData.emailSignatureEnabled && (formData.emailSenderName || formData.emailCompanyName || formData.emailSignature) && (
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs font-medium mb-2 text-muted-foreground">Preview:</p>
        <div className="text-sm whitespace-pre-line border-t border-muted pt-2">
          {formData.emailSignature || <>...</>}
        </div>
      </div>
    )}
  </CardContent>
</Card>
```
**Rationale:** Preview helps users see exactly how their signature will appear before saving.

### Integrations Tab (Coming Soon)
**Decision:** Placeholder with planned integrations grid.
**Implementation:**
```tsx
<TabsContent value="integrations" className="h-full mt-0 overflow-auto">
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Rocket className="h-16 w-16 text-muted-foreground mb-6" />
    <h3 className="text-xl font-semibold">Integrations & Automation</h3>
    <p className="text-muted-foreground mt-3 max-w-md">
      Connect your favorite tools and automate your workflow.
    </p>
    <Badge variant="outline" className="mt-6 text-sm px-4 py-1">
      Coming Q2 2025
    </Badge>

    {/* Preview grid of planned integrations */}
    <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4 text-left max-w-2xl">
      <div className="p-4 border rounded-lg bg-muted/30">
        <p className="font-medium text-sm">Slack Notifications</p>
        <p className="text-xs text-muted-foreground mt-1">Get deal alerts</p>
      </div>
      {/* More integration cards... */}
    </div>
  </div>
</TabsContent>
```
**Rationale:** Shows users what's coming without making promises about specific dates. The grid preview builds anticipation.

### Viewport-Fitting Layout
**Decision:** Use standard viewport-fitting pattern from app layout.
**Implementation:**
```tsx
<div className="h-full flex flex-col overflow-hidden">
  <div className="flex-shrink-0 pb-4">
    {/* Header with title and Save button */}
  </div>

  <Tabs defaultValue="preferences" className="flex-1 flex flex-col min-h-0">
    {/* Tab content */}
  </Tabs>
</div>
```
**Key classes:**
- `h-full` - Fill parent height (from app layout)
- `flex flex-col overflow-hidden` - Flex container with hidden overflow
- `flex-shrink-0` - Header doesn't shrink
- `flex-1 min-h-0` - Tabs content fills remaining space and can scroll

---

## Homepage / Landing Page (2026-02-10)

The marketing homepage has been redesigned with conversion-focused sections that differentiate FlipOps from generic competitors.

### Tool Consolidation Section

**Location:** `app/components/tool-consolidation.tsx`

**Decision:** Use a single comparison table instead of two-card layout with arrow.
**Rationale:** The two-card layout required too much scrolling for a simple comparison. A side-by-side table tells the story in a single glance.

**Layout Structure:**
```tsx
<section className="py-16 lg:py-24 bg-gray-50 dark:bg-zinc-900/50">
  {/* Header with badge and title */}
  {/* Comparison Table */}
  <div className="bg-white dark:bg-zinc-900 rounded-xl border overflow-hidden shadow-lg">
    {/* Table Header: "Your Current Stack" | "With FlipOps" */}
    {/* Table Rows: 6 tool categories */}
    {/* Summary Row: Total costs */}
    {/* Savings Callout */}
  </div>
  {/* Footnote */}
</section>
```

**Key Design Choices:**
- **Title:** "The All-in-One They Promised. Actually Built." - Positions FlipOps as delivering what others claim
- **Badge:** Rose-colored "The Hidden Cost of Fragmentation" with AlertTriangle icon
- **Left Column (Current Stack):** Shows tool name, monthly cost, pain point with X icon
- **Right Column (FlipOps):** Shows feature description with Check icon
- **Dynamic Totals:** Calculated from data array (currently $402+/mo, $4,824+/yr)
- **FlipOps Price:** Shows "All-in-one" instead of specific price (multiple plans available)

**Color Coding:**
```tsx
// Left side (competitor tools)
bg-rose-50 dark:bg-rose-950/30  // Header
bg-gray-50/50 dark:bg-zinc-800/30  // Rows
text-rose-600  // Cost display

// Right side (FlipOps)
bg-emerald-50 dark:bg-emerald-950/30  // Header
text-emerald-500  // Check icons
```

**Tool Comparison Data:**
- PropStream ($99) → Unified lead intake & scoring
- BatchLeads ($99) → Built-in skip tracing
- REsimpli ($99) → Deal-aware CRM with ROI tracking
- PandaDoc ($30) → Contract management, auto-populated
- smrtPhone ($75) → Renovation tracking with budget alerts
- Spreadsheet (Free*) → Portfolio dashboard with lease tracking

**Footnote Copy:** "*Free tools cost you time and sanity. And that's before counting Salesforce, Mailchimp, QuickBooks, REIsift..."

---

### Scoring Engine Section

**Location:** `app/components/scoring-engine.tsx`

**Decision:** Three-step visual flow with auto-cycling demo panels.
**Rationale:** Shows the ML feedback loop without using "AI" buzzwords. Makes personalization tangible.

**Layout Structure:**
```tsx
<section className="py-16 lg:py-24 bg-white dark:bg-zinc-950">
  {/* Header with badge and title */}
  {/* Three-Step Cards (auto-cycles every 4s, clickable) */}
  {/* Active Step Demo Panel */}
  {/* Key Insight Callout */}
</section>
```

**Three Steps:**
1. **"You work deals"** - Shows lead cards with Pursued/Skipped badges
2. **"The algorithm watches"** - Animated cycling through 15 behavioral signals
3. **"Your scores adapt"** - Side-by-side personalization demo

**Step Card Design:**
```tsx
// Each step has color theming
const colorClasses = {
  blue: { bg, border, icon, number },   // Step 1
  purple: { bg, border, icon, number }, // Step 2
  emerald: { bg, border, icon, number } // Step 3
};

// Connection line between cards (desktop only)
<div className="hidden md:block absolute top-1/2 left-1/3 right-1/3 h-0.5
  bg-gradient-to-r from-blue-300 via-purple-300 to-emerald-300" />
```

**Behavioral Signals List:**
```typescript
const behavioralSignals = [
  'Price ranges you pursue',
  'Distress profiles you click',
  'Property types you skip',
  'Markets where you close',
  'Deal sizes you prefer',
  'Rehab levels you target',
  'Lead sources you favor',
  'Response time patterns',
  'Offer-to-close ratios',
  'Seasonal preferences',
  'Neighborhood demographics',
  'Days on market thresholds',
  'Equity percentages',
  'Motivation indicators',
  'Competition avoidance',
];
```

**Personalization Demo:**
- Two investor cards side-by-side
- Jake M. (Wholesaler, Phoenix, AZ) - Orange theme
- Sarah R. (Flipper, Atlanta, GA) - Blue theme
- Different top leads with different scores
- Italic notes: "High-velocity deals..." vs "High ARV potential..."

**Key Insight Callout:**
```tsx
<div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border p-6 text-center">
  <p>"A wholesaler in Phoenix and a flipper in Atlanta get different top leads —"</p>
  <p className="font-bold text-purple-700">because they should.</p>
  <p className="text-sm text-gray-500">One-size-fits-all scoring is broken...</p>
</div>
```

**LeadCard Component:**
```tsx
function LeadCard({ address, city, price, score, isHighlighted, action }) {
  // Shows property address, city, price
  // Score with color coding (emerald 85+, blue 70+, gray otherwise)
  // Optional action badge (Pursued/Skipped with ThumbsUp/ThumbsDown icons)
}
```

---

### Guardrails Section

**Location:** `app/components/guardrails-section.tsx`

**Decision:** Three connected alert cards showing real-world scenarios.
**Rationale:** Makes abstract "guardrails" concept concrete with specific examples.

**Layout Structure:**
```tsx
<section className="py-16 lg:py-24 bg-gray-50 dark:bg-zinc-900/50">
  {/* Header */}
  <div className="grid md:grid-cols-3 gap-0 max-w-5xl mx-auto">
    {/* Three connected cards */}
  </div>
</section>
```

**Three Alert Types:**
1. **Budget Alert** (amber) - Shows electrical overspend with budget vs actual
2. **Deadline Warning** (rose) - Shows inspection contingency countdown
3. **Margin Alert** (orange) - Shows MAO calculation with margin warning

**Card Structure:**
```tsx
<div className="flex flex-col bg-white dark:bg-zinc-900 border">
  {/* Header with icon and title */}
  <div className={`${headerBg} border-b ${headerBorder} px-4 py-2`}>
    <Icon /> {title}
  </div>

  {/* Content - specific to each alert type */}
  {card.id === 'budget' && <BudgetAlertContent />}

  {/* Stats Footer */}
  <div className="mt-auto border-t bg-gray-50 px-4 py-3">
    <span className="text-blue-600 font-bold">{statValue}</span>
    <span className="text-gray-600">{statLabel}</span>
  </div>
</div>
```

**Connected Card Styling:**
```tsx
// First card: rounded left corners
i === 0 ? 'rounded-t-lg md:rounded-l-lg md:rounded-tr-none' : ''

// Last card: rounded right corners
i === 2 ? 'rounded-b-lg md:rounded-r-lg md:rounded-bl-none' : ''

// Middle card: no border overlap
i === 1 ? 'border-t-0 md:border-t md:border-l-0 border-b-0 md:border-b' : ''
```

---

## SectionPill Lightbar Glow Effect (February 11, 2026)

**Component:** `app/components/section-pill.tsx`

**What it does:** A reusable pill badge with a scroll-triggered lightbar animation underneath. In dark mode, a bright core bar appears below the pill and casts a downward glow cone into the content below — like light shining down from an overhead bar. Light mode shows just the pill with no glow.

### Architecture

The effect uses **5 stacked radial-gradient layers** positioned absolutely below the pill, each progressively wider and fainter, creating a smooth atmospheric glow cone:

| Layer | Purpose | Gradient Ellipse | Div Size | Mask |
|-------|---------|-----------------|----------|------|
| 1 - Hotspot | Tight bright center under bar | 200px x 140px | 550px x 300px | maskTight |
| 2 - Inner Cone | Bridges hotspot to primary | 400px x 320px | 950px x 650px | maskMedium |
| 3 - Primary | Main downward light cone | 600px x 500px | 1400px x 1050px | maskWide |
| 4 - Outer Spread | Softens primary edge | 800px x 450px | 1850px x 950px | maskWide |
| 5 - Ambient | Wide subtle atmosphere | 1000px x 550px | 2300px x 1150px | maskAmbient |

### Critical Implementation Rules

**Two things must work together to avoid hard edges:**

1. **Linear top-edge masks** — Each glow div uses a `linear-gradient(to bottom, transparent 0%, ... black N%, black 100%)` mask that fades in the top few percent. This prevents a hard horizontal line at the top of the glow where the div begins. Without this, there's an abrupt transition from black (above div) to bright glow (top of div).

2. **Oversized div containers** — Each div must be significantly wider than its gradient ellipse (div width > 2.1x the gradient's horizontal radius). This ensures the radial gradient fades to fully transparent before reaching the div's side edges. Without this, you get hard vertical lines where the div boundary cuts off a still-visible gradient.

**Why both are needed:**
- Masks alone won't fix side edges (linear masks only affect top-to-bottom)
- Oversized divs alone won't fix the top edge (the gradient's brightest point is at `50% 0%`, creating a hard horizontal transition at the div's top boundary)

### What NOT to do

- **Don't use radial elliptical masks** — They create their own hard boundary lines that are even more visible than the problem they're trying to solve
- **Don't remove masks entirely** — Without top-edge masks, the gradient's center (brightest point) sits exactly at the div's top edge, creating a hard horizontal glow line
- **Don't keep div sizes small when boosting gradient intensity** — If you increase the gradient ellipse radii, you MUST increase the div sizes proportionally or the sides will show hard cutoff lines

### Masks (from HTML reference demo)

```ts
const maskTight = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 3%, black 10%, black 100%)';
const maskMedium = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.2) 2%, rgba(0,0,0,0.5) 5%, black 10%, black 100%)';
const maskWide = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 2%, rgba(0,0,0,0.4) 4%, rgba(0,0,0,0.7) 7%, black 12%, black 100%)';
const maskAmbient = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 3%, rgba(0,0,0,0.7) 6%, black 12%, black 100%)';
```

### Parent Section Overflow

Parent sections that contain SectionPill must use `overflow-x-clip` (NOT `overflow-hidden`). `overflow-hidden` clips the glow layers vertically. `overflow-x-clip` only clips horizontal overflow, allowing the glow to extend downward. Affected files:
- `scoring-engine.tsx`
- `hero-v2.tsx`
- `tool-consolidation-v8.tsx`
- `new-investor-section.tsx`

### Props

```ts
interface SectionPillProps {
  children: ReactNode;
  className?: string;
  pillClassName?: string;  // Tailwind classes for pill styling
  glowColor?: string;      // RGB values e.g. "45, 212, 191"
  staggerIndex?: number;   // Delays animation for staggered reveals
}
```

### Animation

- Scroll-triggered via IntersectionObserver (threshold 0.3, fires once)
- Core bar: scaleX from 0.15 to 1 with cubic-bezier ease
- Glow layers: opacity 0 to 1 with staggered delays (0.05s to 0.25s)
- Pill width measured via ResizeObserver to match core bar width dynamically

---

## Homepage 3D Premium Design System

### Date: February 14, 2026

The homepage uses a premium "3D floating card" treatment across all sections in both light mode and dark mode. The design language draws from Apple and Linear aesthetics — white cards floating on a gray surface (light mode) and glass-like surfaces on black (dark mode).

### Section Backgrounds
```
Light mode: bg-[#f4f4f6]     — Warm gray surface (cards float on this)
Dark mode:  bg-black          — Pure black (via dark:bg-black)
```

### Light Mode: 3D Card Treatment
```tsx
// Standard card floating on gray surface
{
  background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
  border: 'none',
  boxShadow: [
    '0 0 0 1px rgba(0, 0, 0, 0.06)',        // subtle ring border
    'inset 0 1px 0 rgba(255, 255, 255, 0.8)', // top highlight
    'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',     // bottom inner shadow
    '0 1px 2px rgba(0, 0, 0, 0.04)',          // tight drop shadow
    '0 4px 12px rgba(0, 0, 0, 0.06)',         // medium drop shadow
    '0 12px 32px rgba(0, 0, 0, 0.04)',        // large ambient shadow
  ].join(', '),
}
```

### Light Mode: Table/Panel Treatment (flat white)
```tsx
{
  background: '#ffffff',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxShadow: [
    'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
    '0 1px 2px rgba(0, 0, 0, 0.04)',
    '0 4px 12px rgba(0, 0, 0, 0.06)',
    '0 12px 32px rgba(0, 0, 0, 0.04)',
  ].join(', '),
}
```

### Dark Mode: 3D Glass Card Treatment
```tsx
{
  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
  border: 'none',
  boxShadow: [
    '0 0 0 1px rgba(255, 255, 255, 0.08)',     // white ring border
    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',  // top highlight
    'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',        // bottom inner shadow
    '0 2px 4px rgba(0, 0, 0, 0.25)',            // tight drop shadow
    '0 8px 20px rgba(0, 0, 0, 0.35)',           // medium drop shadow
    '0 16px 40px rgba(0, 0, 0, 0.25)',          // large ambient shadow
  ].join(', '),
}
```

### Gradient Header Bar Depth
```tsx
// Applied to colored header bars (e.g., guardrails card headers, cost panel headers)
{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.15)' }
```

### Subtle Tinted Backgrounds
```tsx
// For cost/alert areas — use very low opacity color tints instead of opaque Tailwind classes
// Rose-tinted area:
{ background: 'linear-gradient(180deg, rgba(244, 63, 94, 0.07) 0%, rgba(244, 63, 94, 0.03) 100%)' }
// Emerald-tinted area:
{ background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%)' }
```

### Card Dividers (within connected card groups)
```tsx
// Light mode divider between adjacent cards
{ borderRight: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.5)' }
// Dark mode divider
{ borderRight: '1px solid rgba(0,0,0,0.4)', boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.04)' }
```

### Footer/Stats Bar Treatment
```tsx
// Light mode
{ background: '#f9fafb', borderTop: '1px solid rgba(0, 0, 0, 0.06)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)' }
// Dark mode
{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 100%)', borderTop: '1px solid rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }
```

### Active Tab / Selection Gradient Border
Used on the Feature Tabs section to indicate the selected tab:
```tsx
// CSS gradient border technique (works with border-radius)
{
  border: '1.5px solid transparent',
  background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, #3b82f6, #8b5cf6) border-box',
  boxShadow: '0 1px 3px rgba(59, 130, 246, 0.15)',
}
```
`background-clip` with `padding-box` and `border-box` creates a visible gradient in the border area while keeping the inner content white.

### Animated Spinning Gradient Border (Scoring Engine)
Used on the active step card in the Scoring Engine section:
```tsx
// Wrapper: overflow-hidden + rounded-xl + p-[2px]
// Inner spinning div: absolute inset-[-50%] + conic-gradient + animate-spin
// Content div: relative + bg-white + rounded-[10px]
<div className="overflow-hidden rounded-xl p-[2px] relative">
  <div className="absolute inset-[-50%] animate-spin"
    style={{ background: 'conic-gradient(from 0deg, transparent 0%, #3b82f6 25%, #8b5cf6 50%, #3b82f6 75%, transparent 100%)' }}
  />
  <div className="relative bg-white rounded-[10px] p-6">
    {/* card content */}
  </div>
</div>
```

### isDarkMode State Pattern
All homepage sections that need dark/light conditional styling use this pattern:
```tsx
const [isDarkMode, setIsDarkMode] = useState(false);

useEffect(() => {
  const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
  check();
  const obs = new MutationObserver(check);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}, []);
```
This watches for the `dark` class on `<html>` (set by the theme toggle) and re-renders with the appropriate inline styles.

### Sections with 3D Treatment Applied
1. **Hero** (`hero-v2.tsx`) — Section bg: `bg-[#f4f4f6]` with bottom gradient fade; dark mode gradient backgrounds with layered box-shadows
2. **Interactive Score Demo** (`interactive-score-demo.tsx`) — Light: table-style treatment; dark: glass card
3. **Scoring Engine** (`scoring-engine.tsx`) — Active step card: animated spinning gradient border; inactive: static 3D cards
4. **New Investor Section** (`new-investor-section.tsx`) — 3D cards with color-tinted ring shadows
5. **Feature Tabs** (`feature-tabs-v2.tsx`) — Full 3D treatment, gradient border active tab via `background-clip`
6. **Tool Consolidation** (`tool-consolidation-v8.tsx`) — 3D cards, gradient header bars, rose/emerald tinted cost areas
7. **Guardrails** (`guardrails-section.tsx`) — Single 3D floating container, dividers between cards, gradient headers, stats footer

### Header Navigation (`header.tsx`)
- **"View Demo"** — ghost button linking to `/app` (bypasses Clerk auth for pre-beta)
- **"Reserve Your Spot"** — primary gradient button (from-primary to-accent)
- Login button removed for pre-launch
- Auth bypass: `middleware.ts` has `/app(.*)` in public routes with `TODO` to re-enable for beta

### Dashboard Dark Mode Fix (`globals.css`)
Tailwind v4's `@theme` block defines static CSS variables that don't change in dark mode. Theme-derived utility classes like `bg-muted`, `bg-secondary`, `bg-card`, `border-border` render with light-mode values in dark mode.

**Solution:** Added `!important` dark overrides in `@layer components` within `globals.css`:
```css
.dark .bg-muted { background-color: oklch(0.18 0 0) !important; }
.dark .bg-secondary { background-color: oklch(0.18 0 0) !important; }
.dark .bg-popover { background-color: oklch(0.14 0 0) !important; }
.dark .bg-card { background-color: oklch(0.14 0 0) !important; }
.dark .bg-input { background-color: oklch(0.18 0 0) !important; }
.dark .bg-background { background-color: #000000 !important; }
.dark .border-border { border-color: oklch(0.3 0 0) !important; }
```

**Why `!important`:** In Tailwind v4, `@layer components` has lower CSS cascade priority than unlayered Tailwind utilities. Without `!important`, dark overrides cannot beat the utility-generated rules.

**Card component** (`components/ui/card.tsx`) also uses explicit `dark:bg-zinc-900 dark:text-gray-100 dark:border-zinc-800` utilities.

### CSS Glow/Lightbar Effect Notes
When creating radial-gradient glow layers that cast light downward:
- **Linear top masks** prevent the hard horizontal line at the top edge (fade from transparent to black over first 3-12%)
- **Div containers must be significantly wider than the gradient ellipse** (div width > 2.1x the gradient's horizontal radius) so the gradient fades to transparent before hitting the side edges
- The div's own top boundary prevents upward bleed (no need for radial masks)
- **Radial masks create their OWN hard lines** — avoid them for this pattern
- When boosting gradient intensity/size, always increase div sizes proportionally
- Parent sections need `overflow-x-clip` (not `overflow-hidden`) to allow vertical overflow for glow layers

---
