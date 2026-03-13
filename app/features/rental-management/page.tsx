'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Building2,
  Key,
  Wallet,
  Wrench,
  BarChart3,
  Users,
  FileText,
  CalendarClock,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Home,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Feature card data ──────────────────────────────────────── */
const features = [
  {
    icon: FileText,
    title: 'Lease Management',
    desc: 'Store lease documents, track terms and expiration dates, manage renewal options, and monitor rent escalation clauses — all tied to the property record.',
    details: [
      'Upload and store lease PDFs and attachments',
      'Track lease start/end dates with renewal reminders',
      'Rent escalation clauses with auto-calculation',
      'Renewal option tracking with notification triggers',
    ],
  },
  {
    icon: Wallet,
    title: 'Rent Collection Tracking',
    desc: 'Full payment history per tenant. Track late payments, arrears, and collection trends over time to spot problems before they become evictions.',
    details: [
      'Monthly payment ledger per unit',
      'Late payment flags and arrears tracking',
      'Payment trend analysis over time',
      'Automated late notice triggers',
    ],
  },
  {
    icon: Wrench,
    title: 'Maintenance Workflow',
    desc: 'Tenant submits a request. You assign it to a vendor. Track resolution time and cost. Maintenance history builds automatically per property.',
    details: [
      'Tenant request submission portal',
      'Vendor assignment and tracking',
      'Resolution time and cost logging',
      'Per-property maintenance history',
    ],
  },
  {
    icon: CalendarClock,
    title: 'Vacancy Tracking',
    desc: 'Days vacant, turnover costs, marketing timeline, and time-to-lease metrics. Know exactly what vacancy is costing you per property.',
    details: [
      'Days vacant counter per unit',
      'Turnover cost tracking (cleaning, repairs, marketing)',
      'Time-to-lease metrics and trends',
      'Vacancy cost impact on cash flow',
    ],
  },
  {
    icon: BarChart3,
    title: 'Portfolio-Level Analytics',
    desc: 'Total cash flow, average occupancy rate, maintenance cost per unit, and net yield per property — across your entire portfolio.',
    details: [
      'Total portfolio cash flow dashboard',
      'Average occupancy rate across all units',
      'Maintenance cost per unit trending',
      'Net yield per property with true cost basis',
    ],
  },
];

/* ── BRRRR advantages ───────────────────────────────────────── */
const brrrrAdvantages = [
  {
    icon: RefreshCw,
    title: 'Seamless Rehab-to-Rental Transition',
    desc: 'When rehab is complete, flip the property into rental mode with one click. No re-entering data, no switching platforms, no lost context.',
  },
  {
    icon: Layers,
    title: 'Full Acquisition + Rehab History Retained',
    desc: 'Every dollar you spent on acquisition, every repair line item, every contractor invoice — it all stays attached to the property record when it becomes a rental.',
  },
  {
    icon: DollarSign,
    title: 'True Cash-on-Cash Return',
    desc: 'Calculate real cash-on-cash returns without manual spreadsheet aggregation. Purchase price + rehab costs + holding costs vs. rental income — all in one place.',
  },
  {
    icon: TrendingUp,
    title: 'ROI That Includes Everything',
    desc: 'Most rental tools show you income minus expenses. FlipOps shows you income minus expenses minus what you actually paid to acquire and rehab the property. That\'s the number that matters.',
  },
];

export default function RentalManagementPage() {
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
            <span className="text-foreground font-medium">Rental Management</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
            glowColor="16, 185, 129"
          >
            Rental Portfolio
          </SectionPill>

          <h1 className="glow-heading-emerald text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Your Rental Portfolio, Connected to Everything
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            Lease management, rent collection, maintenance workflows, and portfolio analytics — all connected to your acquisition and rehab data.
          </p>

          {/* Hero icon cluster */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 relative z-10"
            style={cardStyle}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Why This Is in FlipOps ──────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Why Rental Management Lives Inside FlipOps
          </h2>
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              Your rental&apos;s profitability is a function of four numbers: <span className="text-foreground font-semibold">what you paid</span> + <span className="text-foreground font-semibold">what you spent on rehab</span> + <span className="text-foreground font-semibold">what you collect in rent</span> &minus; <span className="text-foreground font-semibold">maintenance costs</span>. That full picture only exists if acquisition, rehab, and rental data live together in one system.
            </p>
            <p className="text-lg">
              Today, most BRRRR investors switch platforms after rehab. Acquisition data lives in one tool, rehab tracking in spreadsheets or another app, and rental management in yet another. The complete financial picture — the one that tells you whether a deal was actually profitable — gets lost in the gap between tools.
            </p>

            {/* The equation visual */}
            <div className="grid sm:grid-cols-4 gap-4 pt-4">
              {[
                { label: 'Acquisition Cost', icon: Home, color: 'blue' },
                { label: 'Rehab Spend', icon: Wrench, color: 'amber' },
                { label: 'Rental Income', icon: DollarSign, color: 'emerald' },
                { label: 'Maintenance Costs', icon: AlertCircle, color: 'red' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-5 text-center" style={cardStyle}>
                  <div className={`w-10 h-10 rounded-lg bg-${item.color}-500/10 flex items-center justify-center mx-auto mb-3`}>
                    <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="text-lg pt-2">
              FlipOps keeps the entire lifecycle in one place. When you transition a property from rehab to rental, <span className="text-foreground font-semibold">every dollar of context travels with it</span>. No re-entering data. No lost spreadsheets. No guessing what your true basis is when calculating returns.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Features ────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
              glowColor="16, 185, 129"
              staggerIndex={1}
            >
              <Building2 className="w-4 h-4" />
              Everything You Need to Manage Rentals
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              Built for Investors, Not Property Managers
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Most rental management tools are built for property managers handling hundreds of doors. FlipOps is built for investors who want to understand their portfolio&apos;s true performance — with full deal history included.
            </p>
          </div>

          <div className="space-y-8">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
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
                    <div className="grid sm:grid-cols-2 gap-2">
                      {feature.details.map((detail) => (
                        <div key={detail} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: For BRRRR Operators ─────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
              glowColor="16, 185, 129"
              staggerIndex={2}
            >
              <RefreshCw className="w-4 h-4" />
              Built for the BRRRR Method
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              BRRRR Without the Platform Gap
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Buy, Rehab, Rent, Refinance, Repeat — the strategy only works when every stage is connected. FlipOps is the first platform where the &ldquo;Rent&rdquo; phase has full context from Buy and Rehab.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {brrrrAdvantages.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* BRRRR flow visual */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h3 className="text-lg font-semibold mb-4">The BRRRR Lifecycle in FlipOps</h3>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { step: 'Buy', color: 'blue' },
                { step: 'Rehab', color: 'amber' },
                { step: 'Rent', color: 'emerald', active: true },
                { step: 'Refinance', color: 'purple' },
                { step: 'Repeat', color: 'emerald' },
              ].map((item, idx) => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded-lg font-semibold ${
                    item.active
                      ? 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30'
                      : `bg-${item.color}-500/10 text-${item.color}-500`
                  }`}>
                    {item.step}
                  </div>
                  {idx < 4 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Every stage shares the same property record. No data loss between phases.
            </p>
            <div className="flex justify-center mt-4">
              <Link
                href="/for/brrrr-investors"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-500 hover:underline font-medium"
              >
                Learn more about FlipOps for BRRRR investors
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Rental Management in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps connects your acquisition, rehab, and rental data into a single view of portfolio performance.
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
        </div>
      </section>

      <Footer />
    </div>
  );
}
