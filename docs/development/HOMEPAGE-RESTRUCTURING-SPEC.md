# FlipOps Homepage Restructuring & Competitive Positioning — Implementation Spec

**Document Purpose:** This is the master implementation spec for restructuring flipops.io's homepage and building out subpages. Claude Code should reference this document when working on any homepage, subpage, or navigation changes. Update the status checkboxes as work is completed.

**Last Updated:** March 13, 2026
**Owner:** Tanner Carlson

---

## Table of Contents

1. [Strategic Context](#1-strategic-context)
2. [Positioning Framework](#2-positioning-framework)
3. [Homepage Restructure — Section-by-Section Spec](#3-homepage-restructure)
4. [Navigation Updates](#4-navigation-updates)
5. [Subpage Architecture — Phased Build](#5-subpage-architecture)
6. [SEO Architecture](#6-seo-architecture)
7. [Design System Notes](#7-design-system-notes)
8. [Implementation Phases & Status Tracking](#8-implementation-phases)

---

## 1. Strategic Context

### The Market Gap FlipOps Owns

No competitor delivers the full investment lifecycle in one platform. The proptech market is split:

- **Pre-close platforms** (lead gen, CRM, outreach, deal pipeline) — strong at finding and closing deals, zero post-acquisition capability
- **Post-close platforms** (rehab tracking, budgeting, vendor management) — strong at managing projects, zero lead gen or CRM

**FlipOps bridges both sides.** This is a structural differentiator, not an incremental one.

### Verified Competitive Gaps (No Competitor Has These)

- [ ] **Title/closing integration** — 0 of 7 audited competitors offer native title/closing workflows. FlipOps' upcoming Qualia integration is first-to-market.
- [ ] **Active rental management** — No competitor manages actual rentals (tenants, leases, maintenance). BRRRR calculators exist but don't manage the rental.
- [ ] **Per-user behavioral learning** — No competitor confirms personalized ML that adapts to individual investor deal patterns over time.
- [ ] **Full lifecycle in one platform** — No single competitor covers ML lead scoring → outreach → deal pipeline → property management.

### FlipOps' Moat (Three-Layer Compound Flywheel)

1. **Data Network Effect** — Each user action (pursuing, skipping, closing leads) improves the scoring algorithm. More users = better scores for everyone.
2. **Full-Lifecycle Data Capture** — Because FlipOps tracks lead-to-rental, it knows which leads produced *profitable outcomes*, not just which leads converted. This feedback loop is impossible for pre-close-only competitors to replicate.
3. **Switching Cost Accumulation** — After 12 months, an investor's pipeline data, vendor relationships, budget templates, renovation playbooks, financial records, and buyer lists all live in FlipOps. Leaving means rebuilding months of operational history.

### Three Target Audiences

| Audience | Primary Pain | What They Care About |
|----------|-------------|---------------------|
| **Wholesalers** | Finding motivated sellers fast, moving deals in days | Speed, distress scoring, skip tracing, buyer database, assignment pipeline |
| **Fix-and-Flippers** | Protecting margins, managing rehab budgets | MAO calculator, budget tracking, margin alerts, vendor management, guardrails |
| **BRRRR Operators** | Full lifecycle from distressed property to cash-flowing rental | Distress scoring, underwriting, rehab tracking, rental management, refinance tracking |

Each audience includes both **new investors** (need guidance, guardrails, education) and **experienced investors** (need efficiency, consolidation, better data).

---

## 2. Positioning Framework

### Positioning Evolution (Phase Over Time)

| Phase | Timeframe | Position |
|-------|-----------|----------|
| **Launch** | Pre-launch → 100 users | "AI-powered distress scoring for RE investors" (sharp wedge) |
| **Growth** | 100–1,000 users | "Full deal pipeline with AI intelligence" (lifecycle story) |
| **Category** | 1,000+ users | "Real Estate Investment Operating System" (own the category) |

### Strategic Narrative

| Element | FlipOps Story |
|---------|--------------|
| **Old World** | Investors juggle 6–8 disconnected tools. They're flying blind on which leads to pursue. |
| **The Shift** | Off-market deals require speed, precision, and data intelligence. Winners aren't making more calls — they're calling the right sellers. |
| **New World** | AI identifies distressed properties, initiates outreach, guides the deal through close, and manages the property — with financial guardrails the entire way. |
| **The Vehicle** | FlipOps: The Real Estate Investment Operating System. |

### Category Language

Use "Real Estate Investment Operating System" (REI OS) rather than "RE Investor CRM." This signals FlipOps is bigger than a CRM.

### "Name the Enemy"

The enemy is **"Tool Sprawl"** — the practice of duct-taping 6+ disconnected tools together and losing deals in the gaps between them. Secondary enemy: **"Blind Bidding"** — pursuing leads without data intelligence.

---

## 3. Homepage Restructure

### Current State → Target State

**Current:** 8 sections (Hero, KPI Stats, Behavioral Learning, FlipOps Approach, Savings Calculator, Guardrails, New Investors, Pricing)

**Target:** 6 sections — tighter, higher-converting, depth moves to subpages

### Section 1: Hero

**Purpose:** Communicate what FlipOps does, who it's for, and why it matters in under 5 seconds.

**Implementation:**

- [x] **Eyebrow text:** "Real Estate Investment Operating System"
- [x] **Headline:** "Find Distressed Properties Before Anyone Else"
- [x] **Subheadline:** "FlipOps scores every property in America for distress signals, auto-contacts motivated sellers, and manages your deal from first touch to final disposition. One platform. Every deal."
- [x] **Primary CTA:** "View Demo" (outline button) + "Reserve Your Spot" (green filled button) — pre-launch CTAs
- [x] **Secondary CTA:** (see above)
- [x] **Micro-proof badges:** Absorbed KPI stats into hero as compact row: "157M+ properties analyzed" | "15+ distress signals" | "Real-time scoring"
- [x] **Visual:** Kept existing lead scoring table UI on right side

### Section 2: Trust Bar

**Purpose:** Instant credibility.

**Implementation:**

- [x] Using: "Powered by CoreLogic's 157M+ property database" + "Built by an active real estate investor" + "Real-time distress scoring across all 50 states"
- [ ] Once available, add logos and user counts

### Section 3: Persona Routing

**Purpose:** Let visitors self-identify.

**Implementation:**

- [x] Three equal cards with icon, headline, description, CTA
- [x] Wholesalers (blue), Fix-and-Flippers (amber), BRRRR Investors (emerald)
- [x] Purple SectionPill with glow heading

### Section 4: Product Walkthrough (Tabbed)

**Implementation:**

- [x] Tabs restructured to: Find / Analyze / Close / Manage (numbered 01-04)
- [x] Each tab has lifecycle-framed bullet points and "Learn more" links
- [x] Existing demo components preserved and reassigned

### Section 5: Savings Calculator

- [x] Simplified to 4 slider inputs
- [x] Links to `/tools/savings-calculator` for detailed version

### Section 6: Final CTA

- [x] "Your next deal is already distressed. Find it first."
- [x] "Reserve Your Spot" CTA (pre-launch)
- [x] Pricing teaser linking to `/pricing`

### What Gets Removed From Homepage

- [x] KPI Stats bar — merged into Hero
- [x] Behavioral Learning — preserved for `/features/distress-scoring`
- [x] Guardrails section — preserved for `/features/guardrails`
- [x] New Investors section — replaced with persona routing
- [x] Full Pricing section — moving to `/pricing`

---

## 4. Navigation Updates

### Updated Top Nav

- [x] Features dropdown (Overview, Distress Scoring, Deal Pipeline, MAO Calculator, Property Management, Guardrails)
- [x] For Investors dropdown (Wholesalers, Fix-and-Flippers, BRRRR Investors)
- [x] Compare dropdown (vs Traditional CRMs, vs Data-Only Platforms, vs Project Management Tools)
- [x] Static links: Pricing, Blog
- [x] CTAs: View Demo, Reserve Your Spot

### Footer Nav

- [x] 5-column layout: Brand, Product, For Investors, Company + Contact

---

## 5. Subpage Architecture

### Phase 1: Core Subpages (14 pages)

- [x] `/features` — Features hub page
- [x] `/features/distress-scoring` — Move Behavioral Learning content here
- [x] `/features/deal-pipeline` — Full pipeline walkthrough
- [x] `/features/mao-calculator` — MAO calculator with interactive tool
- [x] `/features/property-management` — Post-close capabilities
- [x] `/features/guardrails` — Move Guardrails content here
- [x] `/for/wholesalers` — Wholesaler persona page
- [x] `/for/fix-and-flippers` — Flipper persona page
- [x] `/for/brrrr-investors` — BRRRR persona page
- [x] `/pricing` — Full pricing section
- [x] `/demo` — Demo booking / product tour
- [x] `/about` — Company story
- [x] `/blog` — Launch with 5-10 posts
- [x] `/faq` — Comprehensive FAQ

### Phase 2: SEO & Conversion Pages

- [x] `/tools/mao-calculator` — Free standalone tool (SEO play)
- [x] `/tools/arv-calculator` — Free standalone ARV calculator
- [x] `/tools/savings-calculator` — Expanded savings calculator
- [x] `/compare/vs-traditional-crms` — Category comparison (no named competitors)
- [x] `/compare/vs-data-platforms` — Category comparison
- [x] `/compare/vs-project-tools` — Category comparison
- [ ] Remaining individual feature pages
- [ ] First use case pages
- [ ] First case studies

### Phase 3+: Scaling

- [ ] `/for/new-investors` or `/getting-started`
- [ ] `/academy`
- [ ] `/glossary`
- [ ] `/integrations`
- [ ] Scale blog content
- [ ] Template library

---

## 6. SEO Architecture

### URL Structure

- Max two levels deep: `flipops.io/features/distress-scoring`
- Flat, readable, keyword-rich URLs
- No trailing slashes

### Page Type → Keyword Strategy

| Page Type | Target Keyword Pattern | Example |
|-----------|----------------------|---------|
| Feature pages | Long-tail feature keywords | "real estate distress scoring software" |
| Persona pages | Persona + need queries | "best software for wholesalers" |
| Comparison pages | High-intent decision queries | "best RE investor CRM 2026" |
| Tool pages | Utility queries (high volume) | "MAO calculator", "ARV calculator" |
| Blog posts | Educational top-of-funnel | "how to find distressed properties" |
| Glossary | Informational queries | "what is ARV in real estate" |

### Internal Linking Model

Hub-and-spoke: `/features` hub → individual feature pages → related use cases → persona pages

### Schema & Metadata

- [ ] FAQ schema on comparison, feature, pricing pages
- [ ] Breadcrumbs on all subpages
- [ ] Open Graph tags on all pages
- [ ] Canonical URLs on all pages

---

## 7. Design System Notes

### Existing Elements to Preserve

- Dark background (`#09090b`)
- Teal/green accent color (`#2dd4bf`)
- Section pill badges with lightbar glow effect
- Card components with colored accent borders
- Lead scoring table UI
- Savings calculator component
- Guardrails alert cards
- Dark elevated table styling

### New Components Needed

- [x] Persona routing cards
- [ ] Feature page template
- [ ] Comparison table component
- [ ] Free tool page template
- [ ] Use case walkthrough component

### Responsive Considerations

- Persona cards stack vertically on mobile
- Tabs become vertical accordion on mobile
- Calculator inputs stack vertically on mobile
- Nav dropdowns become accordion/drawer on mobile

---

## Notes for Claude Code

- **Do not rename or restructure existing route paths** unless explicitly listed in this spec
- **All new pages should follow existing Next.js 16 / TypeScript / Tailwind patterns**
- **Dark mode is the primary design context** — design for dark first, light second
- **Lightbar glow effect on section pills** should be applied on all new subpages
- **Reuse existing components** wherever possible
- **Each subpage should include:** meta title, meta description, Open Graph image, breadcrumb navigation, and at least one CTA
- **Comparison pages:** NEVER name specific competitor companies. Use category framing.
- **Qualia integration:** use "title & closing integration (coming soon)" — do not overpromise on timeline
- **Pre-launch CTAs:** Use "View Demo" and "Reserve Your Spot" instead of "Start Free" until launch
