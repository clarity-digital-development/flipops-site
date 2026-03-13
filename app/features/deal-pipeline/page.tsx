'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Search,
  Calculator,
  SendHorizontal,
  FileCheck,
  Users,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  ShieldCheck,
  TrendingUp,
  Workflow,
  CalendarClock,
  DollarSign,
  Fingerprint,
  FileWarning,
  Scale,
  Handshake,
  BadgeDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Pipeline stage data ──────────────────────────────────────── */
const stages = [
  {
    num: '01',
    title: 'Leads',
    subtitle: 'New properties surfaced by distress scoring',
    icon: Search,
    tracked: [
      'Distress score (0–100)',
      'Owner contact info (from skip tracing)',
      'Property details (beds, baths, sqft, lot, year built)',
      'Estimated ARV from comps',
      'Initial notes and tags',
    ],
    automations: [
      'Auto-skip-trace when distress score hits 70+',
      'Auto-assign to outreach campaign if active',
      'Duplicate detection across lists',
    ],
    risk: 'Without structured lead intake, high-scoring leads get buried under noise. Investors waste skip tracing budget on low-probability contacts because there\'s no threshold enforcement.',
    crossLink: { href: '/features/distress-scoring', label: 'How Distress Scoring Works' },
  },
  {
    num: '02',
    title: 'Underwriting',
    subtitle: 'Leads you\'ve decided to evaluate seriously',
    icon: Calculator,
    tracked: [
      'ARV analysis with comp selection',
      'Repair estimate (line-item or quick)',
      'MAO calculation with adjustable assumptions',
      'Comparable sales grid and adjustments',
      'Market data and trend indicators',
    ],
    automations: [
      'MAO auto-calculates as ARV and repairs update',
      'Guardrails flag deals outside your parameters',
      'Comp suggestions based on property profile',
    ],
    risk: 'This is where most deals die quietly. Without a structured underwriting stage, investors either skip analysis entirely (and overpay) or lose the deal while manually building spreadsheets. The MAO calculator and comp tools live here for a reason — speed matters.',
    crossLink: { href: '/features/mao-calculator', label: 'MAO Calculator Deep Dive' },
  },
  {
    num: '03',
    title: 'Offers',
    subtitle: 'Properties where you\'ve submitted an offer',
    icon: SendHorizontal,
    tracked: [
      'Offer amount and terms',
      'Seller response and counter-offers',
      'Offer expiration date',
      'Negotiation history and notes',
      'Multiple offer tracking per property',
    ],
    automations: [
      'Offer expiration alerts before deadline',
      'Counter-offer tracking with margin recalculation',
      'Follow-up reminders for no-response sellers',
    ],
    risk: 'Offers without tracking become guesses. Did you follow up after 48 hours? Did the counter-offer still hit your MAO? When did the offer expire? Without a system, you\'re relying on memory — and memory doesn\'t scale past 5 active offers.',
    crossLink: { href: '/features/guardrails', label: 'How Guardrails Protect Your Offers' },
  },
  {
    num: '04',
    title: 'Contracts',
    subtitle: 'Accepted deals moving toward closing',
    icon: FileCheck,
    tracked: [
      'Contract terms and price',
      'Contingency dates (inspection, financing, appraisal)',
      'Earnest money deposit status',
      'Title company and closing agent',
      'Scheduled closing date',
    ],
    automations: [
      'Contingency deadline countdown alerts',
      'Earnest money deposit reminders',
      'Closing timeline tracking with milestone notifications',
      'Qualia integration for title coordination (coming soon)',
    ],
    risk: 'This is where the most money is lost. Miss an inspection contingency date by one day and you lose your right to cancel. Miss a financing deadline and the seller can walk. Miss an extension fee and the contract terminates. Generic CRMs don\'t track these dates — FlipOps does.',
  },
  {
    num: '05',
    title: 'Buyers',
    subtitle: 'Assignment or double-close stage (wholesalers)',
    icon: Users,
    tracked: [
      'Buyer database with preferences and history',
      'Assignment fee and contract terms',
      'Buyer proof of funds verification',
      'Closing coordination between all parties',
      'Disposition method (assignment vs. double close)',
    ],
    automations: [
      'Buyer matching based on property profile and price range',
      'Assignment agreement generation',
      'Closing coordination alerts for all parties',
    ],
    risk: 'The deal is under contract but not done. Wholesalers who don\'t manage their buyer pipeline end up scrambling to find a buyer days before closing — or worse, failing to close and losing their earnest money and reputation.',
  },
];

/* ── Why linear pipeline matters ──────────────────────────────── */
const pipelineBenefits = [
  {
    icon: Workflow,
    title: 'Stages Enforce Discipline',
    desc: 'Every deal must pass through defined stages with required data at each gate. You can\'t submit an offer without underwriting. You can\'t move to contract without offer terms. The pipeline is the process — it prevents shortcuts that cost you money.',
  },
  {
    icon: ArrowRight,
    title: 'Data Flows Forward',
    desc: 'Property data entered at the lead stage carries through to underwriting, offers, contracts, and disposition. No re-entry. No copy-pasting between tools. The ARV you calculated in underwriting is the same ARV referenced in your offer and your buyer presentation.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Across the Funnel',
    desc: 'Where does your funnel break? If you generate 200 leads per month but only close 2 deals, you need to know WHERE the other 198 fell off. Was it underwriting (bad leads)? Offers (too low)? Contracts (missed deadlines)? Pipeline analytics answer these questions.',
  },
];

export default function DealPipelinePage() {
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
            <span className="text-foreground font-medium">Deal Pipeline</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
            glowColor="59, 130, 246"
          >
            Five-Stage Pipeline
          </SectionPill>

          <h1 className="glow-heading-blue text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Every Deal, From First Contact to Final Disposition
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            FlipOps tracks your deals through five stages — Leads, Underwriting, Offers, Contracts, Buyers — so nothing falls through the cracks.
          </p>

          {/* Pipeline stage mini-flow */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-2 sm:gap-3 rounded-2xl px-6 py-4 relative z-10 flex-wrap justify-center"
            style={cardStyle}
          >
            {stages.map((stage, i) => (
              <span key={stage.num} className="flex items-center gap-2 sm:gap-3">
                <span className="flex items-center gap-1.5">
                  <stage.icon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-foreground">{stage.title}</span>
                </span>
                {i < stages.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: The Problem ──────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            The Problem With How Investors Track Deals Today
          </h2>
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              Most investors track deals in spreadsheets, sticky notes, or disconnected CRMs that weren&apos;t built for real estate deal flow. The result: deals stall because nobody remembered to follow up, contracts miss deadlines because contingency dates weren&apos;t tracked, and money is left on the table because there&apos;s no system enforcing the process.
            </p>
            <p className="text-lg">
              The specific pain: <span className="text-foreground font-semibold">real estate deals aren&apos;t simple sales.</span> They have inspection contingencies, financing deadlines, title issues, extension fees, assignment windows, and closing timelines. A generic CRM tracks &ldquo;leads&rdquo; and &ldquo;deals&rdquo; — it doesn&apos;t track the specific milestones that kill real estate deals when they&apos;re missed.
            </p>

            {/* Pain point cards */}
            <div className="grid sm:grid-cols-3 gap-4 pt-4">
              {[
                { icon: CalendarClock, title: 'Missed Deadlines', desc: 'Inspection contingencies, financing deadlines, and extension fees — miss one by a day and the deal is dead or you lose leverage.' },
                { icon: FileWarning, title: 'No Process Enforcement', desc: 'Spreadsheets don\'t stop you from making an offer on a property you haven\'t underwritten. A pipeline does.' },
                { icon: Scale, title: 'No Funnel Visibility', desc: 'You can\'t improve what you can\'t measure. Without pipeline analytics, you\'re guessing at where deals die.' },
              ].map((item) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  viewport={{ once: true }}
                  className="rounded-xl p-5"
                  style={cardStyle}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                    <item.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: The Five Stages ──────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
              glowColor="59, 130, 246"
              staggerIndex={1}
            >
              <Workflow className="w-4 h-4" />
              Five Stages, One Pipeline
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              How Each Stage Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Each stage has a defined purpose, specific data requirements, built-in automations, and failure modes that FlipOps protects against.
            </p>
          </div>

          <div className="space-y-8">
            {stages.map((stage, i) => (
              <motion.div
                key={stage.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8"
                style={cardStyle}
              >
                {/* Stage header */}
                <div className="flex flex-col md:flex-row md:items-start gap-6 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <stage.icon className="w-7 h-7 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-blue-500 tracking-widest uppercase">Stage {stage.num}</span>
                    <h3 className="text-xl font-semibold mt-1 mb-1">{stage.title}</h3>
                    <p className="text-muted-foreground text-sm">{stage.subtitle}</p>
                  </div>
                  {stage.crossLink && (
                    <Link
                      href={stage.crossLink.href}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline shrink-0 mt-1"
                    >
                      {stage.crossLink.label}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {/* Stage detail grid */}
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Tracked */}
                  <div>
                    <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">What&apos;s Tracked</h4>
                    <ul className="space-y-1.5">
                      {stage.tracked.map((item) => (
                        <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Automations */}
                  <div>
                    <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">Automations</h4>
                    <ul className="space-y-1.5">
                      {stage.automations.map((item) => (
                        <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk */}
                  <div>
                    <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      What Goes Wrong Without It
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{stage.risk}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Why a Linear Pipeline Matters ─────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Why a Linear Pipeline Matters
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">
            Investors who treat deal flow as a structured process close more deals and lose less money than those who wing it.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {pipelineBenefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8 text-center"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
                  <b.icon className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Pipeline funnel example */}
          <div className="rounded-2xl p-8" style={cardStyle}>
            <h3 className="text-xl font-semibold mb-6">Pipeline Analytics: See Where Your Funnel Breaks</h3>
            <div className="space-y-3">
              {[
                { stage: 'Leads', count: 200, pct: 100, color: 'bg-blue-500' },
                { stage: 'Underwriting', count: 45, pct: 22.5, color: 'bg-blue-500' },
                { stage: 'Offers', count: 18, pct: 9, color: 'bg-blue-500' },
                { stage: 'Contracts', count: 5, pct: 2.5, color: 'bg-blue-500' },
                { stage: 'Closed', count: 3, pct: 1.5, color: 'bg-emerald-500' },
              ].map((row) => (
                <div key={row.stage} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-28 shrink-0">{row.stage}</span>
                  <div className="flex-1 h-7 rounded-lg bg-blue-500/5 overflow-hidden relative">
                    <div
                      className={`h-full ${row.color} rounded-lg transition-all duration-500`}
                      style={{ width: `${row.pct}%`, minWidth: row.pct > 0 ? '2rem' : 0 }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right shrink-0">{row.count}/mo</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-blue-500/5 border border-blue-500/10 px-5 py-4">
              <p className="text-sm text-foreground">
                <span className="font-semibold">This investor&apos;s bottleneck is Lead → Underwriting.</span>{' '}
                <span className="text-muted-foreground">
                  78% of leads never get evaluated. The fix might be better{' '}
                  <Link href="/features/distress-scoring" className="text-blue-500 hover:underline">distress scoring</Link>{' '}
                  to improve lead quality, or it might be a capacity problem. Either way — you can&apos;t fix what you can&apos;t see.
                </span>
              </p>
            </div>
          </div>

          {/* Additional pipeline benefits */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            {[
              {
                icon: ShieldCheck,
                title: 'Guardrail Integration',
                desc: 'Deals that violate your investment parameters get flagged before you commit capital.',
                link: { href: '/features/guardrails', label: 'Learn more' },
              },
              {
                icon: Fingerprint,
                title: 'Skip Trace on Demand',
                desc: 'Pull owner contact info directly from the lead stage — no platform switching.',
                link: { href: '/features/skip-tracing', label: 'Learn more' },
              },
              {
                icon: DollarSign,
                title: 'MAO at Every Stage',
                desc: 'Your Maximum Allowable Offer travels with the deal, recalculating as assumptions change.',
                link: { href: '/features/mao-calculator', label: 'Learn more' },
              },
              {
                icon: Handshake,
                title: 'Closing Coordination',
                desc: 'Title company assignments, earnest money tracking, and deadline alerts — all in one place.',
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                {item.link && (
                  <Link href={item.link.href} className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline mt-3">
                    {item.link.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Stop Losing Deals Between Tools</h2>
          <p className="text-muted-foreground mb-8">
            See how FlipOps manages every stage of your deal lifecycle — from first contact to final disposition.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-blue-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
