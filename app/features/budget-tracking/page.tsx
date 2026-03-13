'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ChevronRight,
  BarChart3,
  Wallet,
  Calculator,
  PieChart,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight,
  Building2,
  Receipt,
  Landmark,
  ShieldCheck,
  Wrench,
  Home,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Feature card data ───────────────────────────────────────── */
const features = [
  {
    icon: Wallet,
    title: 'Deal-Level P&L',
    desc: 'Acquisition cost, renovation cost, holding costs, selling costs, net profit or loss — all in one view. Every deal has a live P&L that updates as costs are incurred, not after the fact.',
    details: [
      'Purchase price and closing costs tracked from contract',
      'Renovation spending flows in from scope and invoices',
      'Holding costs calculated automatically each month',
      'Selling costs and commissions deducted at disposition',
      'Net profit or loss always current — never a manual calculation',
    ],
  },
  {
    icon: Layers,
    title: 'Category-Level Budget Management',
    desc: '12+ renovation categories with budgeted vs. actual tracking. Know exactly where you are in every category before the next invoice hits.',
    details: [
      'Kitchen, bathrooms, roofing, HVAC, electrical, plumbing, flooring, paint, landscaping, demolition, permits, and more',
      'Set budgets per category during underwriting',
      'Actual spend updates as invoices are approved',
      'Variance alerts when a category exceeds budget',
      'Reallocation tools to shift budget between categories',
    ],
  },
  {
    icon: Calculator,
    title: 'Holding Cost Calculator',
    desc: 'Automatic monthly holding cost calculations based on loan terms, property taxes, insurance, utilities, and HOA dues. No more forgetting to account for the months that eat your margin.',
    details: [
      'Loan interest calculated from principal and rate',
      'Property taxes prorated monthly',
      'Insurance premiums amortized',
      'Utility estimates based on property size',
      'HOA dues tracked if applicable',
      'Total holding cost per month and cumulative',
    ],
  },
  {
    icon: PieChart,
    title: 'Portfolio-Level Financials',
    desc: 'Total capital deployed, total revenue, aggregate margins, and cash-on-cash returns across your entire portfolio. One dashboard, every dollar.',
    details: [
      'Total capital deployed across all active deals',
      'Revenue recognized from closed dispositions',
      'Aggregate profit margins across deal types',
      'Cash-on-cash return calculations',
      'Period-over-period comparisons (monthly, quarterly, annual)',
    ],
  },
];

/* ── Fragmentation pain points ───────────────────────────────── */
const fragmentationTools = [
  { tool: 'QuickBooks', tracks: 'Income & expenses', icon: Receipt },
  { tool: 'CRM / Deal Tracker', tracks: 'Deal status & pipeline', icon: Building2 },
  { tool: 'Spreadsheet', tracks: 'Renovation budget', icon: FileSpreadsheet },
  { tool: 'Bank Statements', tracks: 'Actual cash flow', icon: Landmark },
];

export default function BudgetTrackingPage() {
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
            <span className="text-foreground font-medium">Budget Tracking</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
            glowColor="16, 185, 129"
          >
            Financial Tracking
          </SectionPill>

          <h1 className="glow-heading-emerald text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Every Dollar, From Acquisition to Disposition
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            Deal-level P&L, category budgets, holding costs, and portfolio financials — all in one view.
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
              <p className="text-3xl sm:text-4xl font-bold text-emerald-500">12+</p>
              <p className="text-sm text-muted-foreground">Renovation categories tracked</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-emerald-500">Live</p>
              <p className="text-sm text-muted-foreground">P&L updates as costs hit</p>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div className="text-left hidden sm:block">
              <p className="text-3xl sm:text-4xl font-bold text-emerald-500">100%</p>
              <p className="text-sm text-muted-foreground">Holding costs auto-calculated</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Feature Cards ────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Financial Visibility at Every Level
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            From individual line items to portfolio-wide returns — every dollar is accounted for, every metric is current.
          </p>

          <div className="space-y-8">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8"
                style={cardStyle}
              >
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <feature.icon className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">{feature.desc}</p>
                    <ul className="space-y-2">
                      {feature.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Why Financial Tracking Is Built-In ─────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
              glowColor="16, 185, 129"
              staggerIndex={1}
            >
              <ShieldCheck className="w-4 h-4" />
              Why This Matters
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              Why Financial Tracking Is Built-In, Not Bolted On
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              When your accounting lives in one system, your deals in another, and your renovation budget in a spreadsheet — getting true deal profitability requires hours of manual reconciliation.
            </p>
          </div>

          {/* The fragmentation problem */}
          <div className="rounded-2xl p-8 mb-8" style={cardStyle}>
            <h3 className="text-xl font-semibold mb-6">The Fragmentation Problem</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {fragmentationTools.map((item) => (
                <div key={item.tool} className="rounded-xl p-4 text-center" style={cardStyle}>
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-sm font-semibold">{item.tool}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.tracks}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-red-500/5 border border-red-500/10 px-5 py-4">
              <p className="text-sm text-foreground">
                <AlertTriangle className="w-4 h-4 text-red-500 inline mr-1.5 -mt-0.5" />
                <span className="font-semibold">The result:</span>{' '}
                <span className="text-muted-foreground">
                  No single system knows your true deal profitability. You find out whether a deal was profitable weeks after closing — sometimes months. By then, the lessons are stale and the mistakes are repeated.
                </span>
              </p>
            </div>
          </div>

          {/* The FlipOps difference */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Always-Current P&L</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Because FlipOps tracks the entire deal lifecycle — from lead acquisition through disposition — every cost is captured at the moment it occurs. Your P&L isn&apos;t a report you generate. It&apos;s a living number that updates in real time.
              </p>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <CircleDollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Reconciliation Required</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When the deal data, renovation invoices, holding costs, and selling costs all live in one system, there&apos;s nothing to reconcile. The numbers match because there&apos;s only one source of truth. Your accountant will thank you.
              </p>
            </div>
          </div>

          {/* Holding cost erosion example */}
          <div className="rounded-2xl p-8 mt-8" style={cardStyle}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">The Hidden Cost Most Investors Miss</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Holding costs are the silent margin killer. Every month a project extends, you&apos;re paying loan interest, property taxes, insurance, and utilities — costs that don&apos;t feel large individually but compound quickly.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-5 gap-3 text-center">
              {[
                { label: 'Loan Interest', amount: '$1,250/mo', icon: Landmark },
                { label: 'Property Taxes', amount: '$375/mo', icon: Home },
                { label: 'Insurance', amount: '$150/mo', icon: ShieldCheck },
                { label: 'Utilities', amount: '$200/mo', icon: Wrench },
                { label: 'Total Holding', amount: '$1,975/mo', icon: DollarSign, highlight: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl p-4 ${item.highlight ? 'border border-emerald-500/20' : ''}`}
                  style={cardStyle}
                >
                  <div className={`w-8 h-8 rounded-lg ${item.highlight ? 'bg-emerald-500/10' : 'bg-amber-500/10'} flex items-center justify-center mx-auto mb-2`}>
                    <item.icon className={`w-4 h-4 ${item.highlight ? 'text-emerald-500' : 'text-amber-500'}`} />
                  </div>
                  <p className={`text-lg font-bold ${item.highlight ? 'text-emerald-500' : 'text-foreground'}`}>{item.amount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 px-5 py-4 mt-4">
              <p className="text-sm text-muted-foreground">
                A 2-month project extension at $1,975/mo = <span className="text-foreground font-semibold">$3,950 in unplanned costs</span>. On a deal with a 20% target margin, that alone can drop you to 17%. FlipOps calculates this automatically — so you always know your true position.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Financial Tracking in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps tracks every dollar from acquisition through disposition — with live P&L that updates as costs are incurred.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-emerald-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>

          {/* Cross-links */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">Related Features</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { label: 'Rehab Tracking', href: '/features/rehab-tracking' },
                { label: 'Guardrails', href: '/features/guardrails' },
                { label: 'Margin Alerts', href: '/features/margin-alerts' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-emerald-500/30"
                >
                  {link.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
