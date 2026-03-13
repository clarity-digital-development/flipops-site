'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  HardHat,
  DollarSign,
  AlertTriangle,
  Clock,
  Users,
  Wrench,
  Home,
  Star,
  Receipt,
  ArrowRight,
  Hammer,
  Zap,
  PlugZap,
  Droplets,
  Thermometer,
  Landmark,
  PaintBucket,
  ChefHat,
  Bath,
  TreePine,
  FileCheck,
  MoreHorizontal,
  CalendarCheck,
  Milestone,
  TrendingUp,
  UserCheck,
  ClipboardList,
  Building2,
  Network,
  CreditCard,
  ShieldCheck,
  ArrowDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Renovation budget categories ──────────────────────────── */
const rehabCategories = [
  { name: 'Roofing', icon: Home, avg: '$8,200' },
  { name: 'Electrical', icon: PlugZap, avg: '$4,500' },
  { name: 'Plumbing', icon: Droplets, avg: '$5,100' },
  { name: 'HVAC', icon: Thermometer, avg: '$6,800' },
  { name: 'Foundation', icon: Landmark, avg: '$7,500' },
  { name: 'Flooring', icon: Building2, avg: '$3,900' },
  { name: 'Paint', icon: PaintBucket, avg: '$2,200' },
  { name: 'Kitchen', icon: ChefHat, avg: '$12,500' },
  { name: 'Bathroom', icon: Bath, avg: '$8,400' },
  { name: 'Landscaping', icon: TreePine, avg: '$2,800' },
  { name: 'Permits', icon: FileCheck, avg: '$1,500' },
  { name: 'Misc', icon: MoreHorizontal, avg: '$3,000' },
];

/* ── Renovation features ───────────────────────────────────── */
const renoFeatures = [
  {
    title: 'Vendor Assignment Per Category',
    desc: 'Assign contractors to specific scopes with bid tracking. Compare bids side-by-side before awarding work.',
    icon: UserCheck,
  },
  {
    title: 'Timeline Tracking with Milestones',
    desc: 'Set start/end dates per category, track milestone completions, and see the critical path across your entire rehab.',
    icon: Milestone,
  },
  {
    title: 'Budget Alerts at Category Level',
    desc: 'Get notified the moment any category exceeds its threshold — catch overruns at $500, not $5,000.',
    icon: AlertTriangle,
  },
  {
    title: 'Change Order Management',
    desc: 'Every scope change is logged with cost and timeline impact. No surprise overruns at the end of the project.',
    icon: ClipboardList,
  },
];

/* ── Rental features ───────────────────────────────────────── */
const rentalFeatures = [
  {
    title: 'Seamless Rehab-to-Rental Transition',
    desc: 'When renovation completes, the property flips to rental mode — budgets, vendor history, and total investment carry forward automatically.',
    icon: ArrowRight,
  },
  {
    title: 'Tenant Tracking',
    desc: 'Lease dates, rent amounts, payment history, and renewal alerts. Know who owes what and when every lease is up.',
    icon: Users,
  },
  {
    title: 'Maintenance Management',
    desc: 'Ticket system with vendor assignment, cost tracking, and tenant communication. No more text-message chaos.',
    icon: Wrench,
  },
  {
    title: 'Portfolio View',
    desc: 'Occupancy, cash flow, cap rate, and cash-on-cash return across every property. See your portfolio health at a glance.',
    icon: TrendingUp,
  },
];

/* ── Vendor features ───────────────────────────────────────── */
const vendorFeatures = [
  {
    title: 'Centralized Vendor Database',
    desc: 'Every contractor, inspector, and service provider in one place — with their trade, service area, and contact info.',
    icon: Network,
  },
  {
    title: 'Performance History',
    desc: 'On-time completion rate, budget accuracy, quality notes, and callback frequency. Data-driven contractor decisions.',
    icon: Star,
  },
  {
    title: 'Assignment Tracking',
    desc: 'See which vendors are assigned to which properties and categories. Past performance visible at assignment time.',
    icon: CalendarCheck,
  },
  {
    title: 'Payment Tracking',
    desc: 'Paid, outstanding, and invoiced amounts per vendor per project. Know exactly where every dollar went.',
    icon: CreditCard,
  },
];

/* ── Problem points ────────────────────────────────────────── */
const problemPoints = [
  {
    stat: '20–30%',
    label: 'Average rehab budget overrun',
    desc: 'Without category-level tracking, overruns hide until the final invoice.',
    icon: DollarSign,
  },
  {
    stat: '3–5',
    label: 'Tools investors juggle post-close',
    desc: 'Spreadsheets, PM software, contractor texts, accounting apps, and bank statements.',
    icon: ArrowDownRight,
  },
  {
    stat: '100%',
    label: 'Data continuity lost',
    desc: 'If your PM tool doesn\'t know your MAO or target margin, it can\'t tell you when spending puts the deal underwater.',
    icon: AlertTriangle,
  },
];

/* ── Framer-motion helpers ─────────────────────────────────── */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
};

export default function PropertyManagementPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const cardStyle = isDarkMode
    ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
      };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />

      {/* ── Section 1: Hero ───────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Property Management</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
            glowColor="139, 92, 246"
          >
            Post-Close Operations
          </SectionPill>

          <h1 className="glow-heading-purple text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Your Deal Doesn&apos;t End at Closing
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            FlipOps manages renovations, rentals, and vendors after close — so your entire
            investment lifecycle lives in one system.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-10 relative z-10"
          >
            {['Renovation Tracking', 'Rental Management', 'Vendor Database'].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
                style={cardStyle}
              >
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                {label}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: The Problem ────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              The Post-Close Black Hole
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every platform focuses on <strong className="text-foreground">find</strong> and{' '}
              <strong className="text-foreground">close</strong>. The moment you close, you switch
              to spreadsheets, separate PM tools, and contractor text threads. The data thread
              breaks — and that&apos;s where investor losses actually happen.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {problemPoints.map((p, i) => (
              <motion.div
                key={p.label}
                {...stagger}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="rounded-2xl p-8 text-center"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
                  <p.icon className="w-7 h-7 text-purple-500" />
                </div>
                <p className="text-4xl font-bold text-purple-500 mb-2">{p.stat}</p>
                <p className="text-sm font-semibold mb-2">{p.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="rounded-2xl p-8 mt-12" style={cardStyle}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold mb-1">Data continuity is the real differentiator</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The majority of investor losses happen <em>during</em> renovation (budget overruns,
                  timeline delays, contractor issues) and <em>during</em> the hold period (vacancy,
                  maintenance surprises). If your PM tool doesn&apos;t know your MAO or target margin,
                  it can&apos;t tell you when spending is putting the deal underwater. FlipOps connects
                  your underwriting numbers directly to your post-close operations — so every dollar
                  spent is measured against the deal you actually approved.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 3: Renovation Management ──────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
              <HardHat className="w-7 h-7 text-purple-500" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Renovation Management
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Budget tracking across 12+ categories so overruns get caught at $500 — not $5,000.
            </p>
          </motion.div>

          {/* Budget categories grid */}
          <motion.div {...fadeUp} className="mb-14">
            <h3 className="text-lg font-semibold text-center mb-6">Category-Level Budget Tracking</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {rehabCategories.map((cat, i) => (
                <motion.div
                  key={cat.name}
                  {...stagger}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className="rounded-xl p-4 text-center"
                  style={cardStyle}
                >
                  <cat.icon className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">avg {cat.avg}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Renovation feature cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {renoFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                {...stagger}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="rounded-2xl p-8 flex items-start gap-5"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Industry stat callout */}
          <motion.div {...fadeUp} className="rounded-2xl p-6 mt-12 border border-purple-500/20" style={cardStyle}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Industry insight</p>
                <p className="text-sm text-muted-foreground">
                  The average rehab overrun is 20–30%. Category-level tracking catches overruns at $500, not $5,000 — turning a
                  blown budget into a manageable line-item adjustment.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center mt-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/features/rehab-tracking" className="inline-flex items-center gap-1.5">
                <Hammer className="w-4 h-4" />
                Deep dive: Rehab Tracking
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section 4: Rental Management ──────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
              <Home className="w-7 h-7 text-purple-500" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Rental Management
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              For BRRRR operators: transition from renovation to rental mode without losing a single data point.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {rentalFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                {...stagger}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="rounded-2xl p-8 flex items-start gap-5"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="rounded-2xl p-8 mt-12" style={cardStyle}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowDownRight className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold mb-1">Why this matters for BRRRR investors</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  BRRRR investors currently switch platforms after rehab, losing the complete financial picture.
                  Your acquisition cost, rehab spend, and target ARV should inform your rental strategy — but
                  when that data lives in a different tool, you&apos;re flying blind. FlipOps keeps the entire
                  financial thread intact from acquisition through cash flow.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center mt-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/features/rental-management" className="inline-flex items-center gap-1.5">
                <Home className="w-4 h-4" />
                Deep dive: Rental Management
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section 5: Vendor Management ──────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
              <Users className="w-7 h-7 text-purple-500" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Vendor Management
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A centralized vendor database with performance history that gets more valuable with every flip.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {vendorFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                {...stagger}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="rounded-2xl p-8 flex items-start gap-5"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="rounded-2xl p-6 mt-12 border border-purple-500/20" style={cardStyle}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Compounding advantage</p>
                <p className="text-sm text-muted-foreground">
                  After 10 flips, you have a curated, performance-tested vendor network. You know who
                  delivers on time, who stays on budget, and who needs oversight. That&apos;s a competitive
                  advantage no spreadsheet can build.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="flex justify-center mt-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/features/vendor-management" className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Deep dive: Vendor Management
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Cross-links ───────────────────────────────────────── */}
      <section className="py-16 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h3 className="text-xl font-semibold mb-2">Connected Features</h3>
            <p className="text-sm text-muted-foreground">Property management ties into every part of the FlipOps platform.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { href: '/features/rehab-tracking', label: 'Rehab Tracking', icon: Hammer },
              { href: '/features/rental-management', label: 'Rental Management', icon: Home },
              { href: '/features/vendor-management', label: 'Vendor Management', icon: Users },
              { href: '/features/guardrails', label: 'Guardrails', icon: ShieldCheck },
              { href: '/features/budget-tracking', label: 'Budget Tracking', icon: Receipt },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl p-4 flex items-center gap-3 hover:scale-[1.02] transition-transform"
                style={cardStyle}
              >
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <link.icon className="w-4.5 h-4.5 text-purple-500" />
                </div>
                <span className="text-sm font-medium">{link.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA ────────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Close the Loop on Every Deal</h2>
          <p className="text-muted-foreground mb-8">
            See how FlipOps manages the full lifecycle — from acquisition through cash flow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
