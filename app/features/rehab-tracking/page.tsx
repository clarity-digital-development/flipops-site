'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Hammer,
  Wrench,
  HardHat,
  DollarSign,
  Camera,
  Calendar,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  Plug,
  Droplets,
  Wind,
  Landmark,
  PaintBucket,
  CookingPot,
  Bath,
  Trees,
  FileCheck,
  Package,
  BarChart3,
  Bell,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Budget category data ──────────────────────────────────── */
const budgetCategories = [
  { name: 'Roofing', icon: HardHat, budget: '$8,500', actual: '$9,200' },
  { name: 'Electrical', icon: Plug, budget: '$6,000', actual: '$5,800' },
  { name: 'Plumbing', icon: Droplets, budget: '$5,500', actual: '$7,100' },
  { name: 'HVAC', icon: Wind, budget: '$12,000', actual: '$11,400' },
  { name: 'Foundation', icon: Landmark, budget: '$15,000', actual: '$22,000' },
  { name: 'Flooring', icon: Layers, budget: '$4,200', actual: '$4,500' },
  { name: 'Paint', icon: PaintBucket, budget: '$3,000', actual: '$2,800' },
  { name: 'Kitchen', icon: CookingPot, budget: '$14,000', actual: '$15,600' },
  { name: 'Bathroom', icon: Bath, budget: '$9,000', actual: '$8,700' },
  { name: 'Landscaping', icon: Trees, budget: '$3,500', actual: '$3,200' },
  { name: 'Permits', icon: FileCheck, budget: '$2,000', actual: '$2,400' },
  { name: 'Miscellaneous', icon: Package, budget: '$3,000', actual: '$4,800' },
];

/* ── Features deep dive data ───────────────────────────────── */
const features = [
  {
    icon: BarChart3,
    title: 'Budgeted vs Actual Tracking',
    desc: 'Real-time variance reporting for every category. See exactly where you stand against budget at any point in the project — not just when the final invoice arrives.',
  },
  {
    icon: Camera,
    title: 'Photo Documentation',
    desc: 'Before, during, and after photos attached to each category. Build a visual record of the entire rehab for your own records, lenders, and future buyers.',
  },
  {
    icon: DollarSign,
    title: 'Draw Schedule Tracking',
    desc: 'Track rehab loan draws against milestones. Know exactly how much has been disbursed, how much is remaining, and what inspections are needed for the next draw.',
  },
  {
    icon: Calendar,
    title: 'Milestone-Based Timeline',
    desc: 'Set start and target completion dates per category. Track actual progress against planned schedule so delays surface early, not at the end of the project.',
  },
  {
    icon: Users,
    title: 'Vendor Assignment & Bid Tracking',
    desc: 'Assign contractors per category and track competing bids. Build a vendor history so you know which contractors deliver on budget and which consistently overrun.',
  },
];

export default function RehabTrackingPage() {
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

      {/* ── Section 1: Hero ─────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Rehab Tracking</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/25"
            glowColor="245, 158, 11"
          >
            Renovation Management
          </SectionPill>

          <h1 className="glow-heading-orange text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Track Every Dollar of Every Rehab
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            12+ budget categories with real-time variance reporting. Know exactly where overruns happen — and catch them when they&apos;re $500 problems, not $5,000 problems.
          </p>

          {/* Hero stat callout */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 relative z-10"
            style={cardStyle}
          >
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-amber-500">20–30%</p>
              <p className="text-sm text-muted-foreground">Average rehab overrun</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-amber-500">12+</p>
              <p className="text-sm text-muted-foreground">Budget categories tracked</p>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div className="text-left hidden sm:block">
              <p className="text-3xl sm:text-4xl font-bold text-amber-500">Real-Time</p>
              <p className="text-sm text-muted-foreground">Variance reporting</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Why Category-Level Tracking Matters ────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Why Category-Level Tracking Matters
          </h2>
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              Most investors track total renovation spend. That tells you nothing useful.
            </p>
            <p className="text-lg">
              Knowing you spent $85K on a rehab doesn&apos;t help. Knowing you spent <span className="text-foreground font-semibold">$22K on foundation (budgeted $15K)</span> and <span className="text-foreground font-semibold">$8K on HVAC (budgeted $12K)</span> tells you exactly where the overrun happened and which contractor estimate was wrong.
            </p>
            <p className="text-lg">
              One category blew up. The other came in under budget. But if all you track is the total, you&apos;ll never know which contractor to replace and which to keep.
            </p>

            {/* Comparison cards */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h4 className="font-semibold text-foreground">Total-Only Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;We spent $85K on the rehab. Budget was $75K. We went over by $10K.&rdquo;
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  No visibility into which categories overran. No accountability. No learning.
                </p>
              </div>
              <div className="rounded-xl p-5 border border-amber-500/20" style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  <h4 className="font-semibold text-foreground">Category-Level Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  &ldquo;Foundation was $7K over. HVAC saved $4K. Kitchen was $1.6K over. Paint saved $200.&rdquo;
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Exact overrun source identified. Contractor accountability. Data for future estimates.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 px-5 py-4 mt-4">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Industry reality:</span>{' '}
                <span className="text-muted-foreground">The average rehab overrun is 20–30%. Category-level tracking doesn&apos;t eliminate overruns — but it catches them at $500, not $5,000, and builds a data history that makes future estimates dramatically more accurate.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: The 12+ Budget Categories ─────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            The 12+ Budget Categories
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            Every rehab is broken down into granular categories. Each one tracks budgeted vs. actual spend in real time.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {budgetCategories.map((cat, i) => {
              const budgetNum = parseInt(cat.budget.replace(/[$,]/g, ''));
              const actualNum = parseInt(cat.actual.replace(/[$,]/g, ''));
              const variance = actualNum - budgetNum;
              const isOver = variance > 0;

              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className="rounded-xl p-5"
                  style={cardStyle}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <cat.icon className="w-5 h-5 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-semibold">{cat.name}</h4>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Budgeted</span>
                      <span className="font-medium text-foreground">{cat.budget}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Actual</span>
                      <span className="font-medium text-foreground">{cat.actual}</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Variance</span>
                      <span className={`font-semibold ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                        {isOver ? '+' : '-'}${Math.abs(variance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 4: Features Deep Dive ────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/25"
              glowColor="245, 158, 11"
              staggerIndex={1}
            >
              <ClipboardList className="w-4 h-4" />
              Full Rehab Toolkit
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              Everything You Need to Manage a Rehab
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Budget tracking is just the start. FlipOps gives you photo documentation, draw schedules, timeline management, and vendor tracking — all in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Draw schedule visual example */}
          <div className="rounded-2xl p-8 mt-8" style={cardStyle}>
            <h3 className="text-xl font-semibold mb-6">How It All Fits Together</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <Hammer className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-semibold text-sm mb-1">Set Up Budget</p>
                <p className="text-xs text-muted-foreground">Define categories, assign budgets, upload contractor bids</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <Wrench className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-semibold text-sm mb-1">Track Progress</p>
                <p className="text-xs text-muted-foreground">Log expenses, upload photos, update milestones as work progresses</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <p className="font-semibold text-sm mb-1">Review & Learn</p>
                <p className="text-xs text-muted-foreground">Analyze variance reports, build contractor history, improve future estimates</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Budget Alerts Integration ─────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Budget Alerts That Catch Overruns Early
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            When any category exceeds its threshold, FlipOps triggers an alert before the overrun becomes a problem.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
                <Bell className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Category Threshold Alerts</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Set a threshold per category — default is 10%. When actual spend crosses that line, you get an immediate alert with the category name, the variance amount, and the contractor assigned.
              </p>
              {/* Alert example */}
              <div className="rounded-lg bg-red-500/5 border border-red-500/15 px-4 py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Foundation — 47% over budget</p>
                    <p className="text-xs text-muted-foreground mt-0.5">$22,000 actual vs $15,000 budgeted (+$7,000)</p>
                    <p className="text-xs text-muted-foreground">Contractor: Martinez Foundation Co.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Integrated With FlipOps Guardrails</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Rehab budget alerts are part of the broader FlipOps guardrail system. When a category overrun pushes your total rehab cost past the threshold, it automatically recalculates your MAO and margin in real time.
              </p>
              <div className="space-y-2">
                <Link
                  href="/features/guardrails"
                  className="flex items-center gap-2 text-sm text-amber-500 hover:underline font-medium"
                >
                  <ArrowRight className="w-4 h-4" />
                  Learn about Guardrails
                </Link>
                <Link
                  href="/features/margin-alerts"
                  className="flex items-center gap-2 text-sm text-amber-500 hover:underline font-medium"
                >
                  <ArrowRight className="w-4 h-4" />
                  Learn about Margin Alerts
                </Link>
              </div>
            </div>
          </div>

          {/* How alerts work flow */}
          <div className="rounded-2xl p-6 mt-8" style={cardStyle}>
            <h3 className="text-lg font-semibold mb-4">Alert Flow</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Expense Logged</p>
                <p className="text-xs text-muted-foreground mt-0.5">Contractor submits invoice</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 rotate-90 sm:rotate-0 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Threshold Check</p>
                <p className="text-xs text-muted-foreground mt-0.5">Category at 10%+ variance?</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 rotate-90 sm:rotate-0 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Alert Triggered</p>
                <p className="text-xs text-muted-foreground mt-0.5">In-app + email notification</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 rotate-90 sm:rotate-0 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">MAO Recalculated</p>
                <p className="text-xs text-muted-foreground mt-0.5">Deal metrics update automatically</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Rehab Tracking in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps tracks every dollar across 12+ categories and catches overruns before they eat your margin.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-amber-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
