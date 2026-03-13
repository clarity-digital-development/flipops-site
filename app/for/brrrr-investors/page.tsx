'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, type Variants } from 'framer-motion';
import {
  Building2,
  Unplug,
  Search,
  Wrench,
  Users,
  FileText,
  Repeat,
  ArrowRight,
  Layers,
  BrainCircuit,
  DollarSign,
  BarChart3,
  GraduationCap,
  TrendingUp,
  Home,
  Calculator,
  FolderOpen,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

function AnimateOnScroll({
  children,
  className,
  custom = 0,
}: {
  children: React.ReactNode;
  className?: string;
  custom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={fadeUp}
      custom={custom}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const problemCards = [
  {
    icon: Layers,
    title: 'Spans the Entire Lifecycle',
    description:
      'BRRRR (Buy, Rehab, Rent, Refinance, Repeat) is the most complex strategy in real estate investing. It spans acquisition, renovation, property management, and portfolio finance. No other strategy touches every phase.',
  },
  {
    icon: Unplug,
    title: 'Maximum Data Fragmentation',
    description:
      'Acquisition data lives in one system, rehab costs in another, rental income in a third, and refinance docs in a fourth. Getting true cash-on-cash return means manually aggregating from 4+ places.',
  },
  {
    icon: BrainCircuit,
    title: 'Tool Overload',
    description:
      'You need tools for finding deals, managing rehab budgets, tracking tenants, and monitoring portfolio financials. Most investors cobble together 4-6 separate platforms that never talk to each other.',
  },
];

const lifecycle = [
  {
    step: 'Buy',
    icon: Search,
    color: 'blue',
    description:
      'Distress scoring finds undervalued properties. The MAO calculator includes rental yield analysis alongside flip margins. Behavioral learning adapts to your rental-focused criteria over time.',
    features: [
      { label: 'Distress Scoring', href: '/features/distress-scoring' },
      { label: 'MAO Calculator', href: '/features/mao-calculator' },
    ],
  },
  {
    step: 'Rehab',
    icon: Wrench,
    color: 'amber',
    description:
      'Full renovation management: trade-by-trade scope, budget gauges, vendor bids, change order controls, and timeline milestones. Track every dollar and every deadline.',
    features: [
      { label: 'Rehab Tracking', href: '/features/rehab-tracking' },
      { label: 'Budget Tracking', href: '/features/budget-tracking' },
      { label: 'Vendor Management', href: '/features/vendor-management' },
    ],
  },
  {
    step: 'Rent',
    icon: Users,
    color: 'emerald',
    description:
      'Transition from rehab to rental mode seamlessly. Lease terms, tenant info, rent tracking, and maintenance tickets. The property retains ALL acquisition and rehab data throughout.',
    features: [
      { label: 'Rental Management', href: '/features/rental-management' },
    ],
  },
  {
    step: 'Refinance',
    icon: FileText,
    color: 'purple',
    description:
      'All documentation in one place: purchase price, rehab costs, rental income history, property photos, and current valuation. Makes assembling a refinance package straightforward.',
    features: [],
  },
  {
    step: 'Repeat',
    icon: Repeat,
    color: 'teal',
    description:
      'Capital from refinance flows into the next deal. Portfolio-level metrics show total properties, aggregate cash flow, average cash-on-cash return, and total equity at a glance.',
    features: [
      { label: 'Financial Guardrails', href: '/features/guardrails' },
    ],
  },
];

const stepColors: Record<
  string,
  {
    bgDark: string;
    bgLight: string;
    textDark: string;
    textLight: string;
    badgeDark: string;
    badgeLight: string;
    linkDark: string;
    linkLight: string;
  }
> = {
  blue: {
    bgDark: 'bg-blue-500/15',
    bgLight: 'bg-blue-50',
    textDark: 'text-blue-400',
    textLight: 'text-blue-600',
    badgeDark: 'bg-blue-500/20 text-blue-300',
    badgeLight: 'bg-blue-100 text-blue-700',
    linkDark: 'text-blue-400',
    linkLight: 'text-blue-600',
  },
  amber: {
    bgDark: 'bg-amber-500/15',
    bgLight: 'bg-amber-50',
    textDark: 'text-amber-400',
    textLight: 'text-amber-600',
    badgeDark: 'bg-amber-500/20 text-amber-300',
    badgeLight: 'bg-amber-100 text-amber-700',
    linkDark: 'text-amber-400',
    linkLight: 'text-amber-600',
  },
  emerald: {
    bgDark: 'bg-emerald-500/15',
    bgLight: 'bg-emerald-50',
    textDark: 'text-emerald-400',
    textLight: 'text-emerald-600',
    badgeDark: 'bg-emerald-500/20 text-emerald-300',
    badgeLight: 'bg-emerald-100 text-emerald-700',
    linkDark: 'text-emerald-400',
    linkLight: 'text-emerald-600',
  },
  purple: {
    bgDark: 'bg-purple-500/15',
    bgLight: 'bg-purple-50',
    textDark: 'text-purple-400',
    textLight: 'text-purple-600',
    badgeDark: 'bg-purple-500/20 text-purple-300',
    badgeLight: 'bg-purple-100 text-purple-700',
    linkDark: 'text-purple-400',
    linkLight: 'text-purple-600',
  },
  teal: {
    bgDark: 'bg-teal-500/15',
    bgLight: 'bg-teal-50',
    textDark: 'text-teal-400',
    textLight: 'text-teal-600',
    badgeDark: 'bg-teal-500/20 text-teal-300',
    badgeLight: 'bg-teal-100 text-teal-700',
    linkDark: 'text-teal-400',
    linkLight: 'text-teal-600',
  },
};

const whyFullLifecycle = [
  {
    icon: DollarSign,
    title: 'You Suffer Most from Tool Fragmentation',
    description:
      'Wholesalers only need pre-close tools. Flippers don\'t hold rentals. But BRRRR operators need acquisition, rehab management, property management, AND portfolio finance. You\'re the ones paying for the most subscriptions and doing the most manual data entry.',
  },
  {
    icon: FolderOpen,
    title: 'Every Phase Depends on the Last',
    description:
      'Your rehab budget determines your refinance position. Your purchase price determines your cash-on-cash return. Your rental income determines when to refinance. Data has to flow through the entire lifecycle or you\'re flying blind.',
  },
  {
    icon: PieChart,
    title: 'FlipOps Was Designed for Your Workflow',
    description:
      'We didn\'t bolt on rental management as an afterthought. The entire platform was designed around full-lifecycle data continuity, so every metric updates automatically as your deal moves from stage to stage.',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function BRRRRInvestorsPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  const cardStyle = isDarkMode
    ? {
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
      };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* ============================================================ */}
        {/*  Section 1 — Hero                                            */}
        {/* ============================================================ */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span>For Investors</span>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">
                BRRRR Investors
              </span>
            </nav>

            <div className="flex flex-col items-start">
              <SectionPill
                pillClassName="bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25"
                glowColor="16, 185, 129"
              >
                <Building2 className="w-4 h-4" />
                Built for BRRRR
              </SectionPill>

              <motion.h1
                className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mt-8 mb-6 max-w-4xl relative z-10 pb-1"
                style={isDarkMode ? {
                  backgroundImage: 'radial-gradient(ellipse 120% 200% at 10% -20%, rgb(16, 185, 129) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.45) 75%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                } : undefined}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              >
                From Distressed Property to Cash-Flowing Rental&nbsp;&mdash; One
                Platform
              </motion.h1>
              <motion.p
                className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl relative z-10"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.15,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                FlipOps is the only platform that manages the entire BRRRR
                lifecycle &mdash; acquisition, rehab, rental management,
                refinance packaging, and portfolio analytics &mdash; with
                complete data continuity across every stage.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section 2 — The BRRRR Problem                               */}
        {/* ============================================================ */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <AnimateOnScroll>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 text-center">
                The BRRRR Problem
              </h2>
            </AnimateOnScroll>
            <AnimateOnScroll custom={1}>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center mb-14">
                BRRRR is the most powerful wealth-building strategy in real
                estate &mdash; and the hardest to execute with existing tools.
                No platform was built to support the full cycle. Until now.
              </p>
            </AnimateOnScroll>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {problemCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <AnimateOnScroll key={card.title} custom={i + 2}>
                    <div className="rounded-2xl p-6 h-full" style={cardStyle}>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-red-500/15' : 'bg-red-50'}`}
                      >
                        <Icon
                          className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}
                        />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </AnimateOnScroll>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section 3 — Full Cycle: How FlipOps Serves BRRRR Operators  */}
        {/* ============================================================ */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-6xl">
            <AnimateOnScroll>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 text-center">
                How FlipOps Serves BRRRR Operators
              </h2>
            </AnimateOnScroll>
            <AnimateOnScroll custom={1}>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto text-center mb-14">
                Five phases. One platform. Complete data continuity.
              </p>
            </AnimateOnScroll>

            <div className="space-y-6">
              {lifecycle.map((phase, i) => {
                const Icon = phase.icon;
                const colors = stepColors[phase.color];
                return (
                  <AnimateOnScroll key={phase.step} custom={i}>
                    <div
                      className="rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative"
                      style={cardStyle}
                    >
                      {/* Left: step badge + icon */}
                      <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-3 lg:min-w-[140px]">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${isDarkMode ? colors.badgeDark : colors.badgeLight}`}
                        >
                          Step {i + 1}
                        </span>
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDarkMode ? colors.bgDark : colors.bgLight}`}
                        >
                          <Icon
                            className={`w-6 h-6 ${isDarkMode ? colors.textDark : colors.textLight}`}
                          />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white lg:mt-1">
                          {phase.step}
                        </h3>
                      </div>

                      {/* Right: description + feature links */}
                      <div className="flex-1">
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                          {phase.description}
                        </p>
                        {phase.features.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-3">
                            {phase.features.map((f) => (
                              <Link
                                key={f.label}
                                href={f.href}
                                className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${isDarkMode ? colors.linkDark : colors.linkLight} hover:underline`}
                              >
                                {f.label}
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Connector line (desktop only) */}
                      {i < lifecycle.length - 1 && (
                        <div className="hidden lg:block absolute -bottom-6 left-[70px] w-px h-6 bg-gray-200 dark:bg-white/10" />
                      )}
                    </div>
                  </AnimateOnScroll>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section 4 — Why BRRRR Operators Need Full-Lifecycle Software */}
        {/* ============================================================ */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <AnimateOnScroll>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 text-center">
                Why BRRRR Operators Need Full-Lifecycle Software
              </h2>
            </AnimateOnScroll>
            <AnimateOnScroll custom={1}>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center mb-14">
                Every other investor type can get by with pre-close tools.
                Wholesalers don&apos;t rehab. Flippers don&apos;t hold rentals.
                BRRRR operators need <em>everything</em>.
              </p>
            </AnimateOnScroll>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {whyFullLifecycle.map((card, i) => {
                const Icon = card.icon;
                return (
                  <AnimateOnScroll key={card.title} custom={i + 2}>
                    <div className="rounded-2xl p-6 h-full" style={cardStyle}>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}
                      >
                        <Icon
                          className={`w-6 h-6 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                        />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </AnimateOnScroll>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section 5 — For New BRRRR Investors                         */}
        {/* ============================================================ */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-4xl">
            <AnimateOnScroll>
              <div className="rounded-2xl p-8 lg:p-12" style={cardStyle}>
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}
                  >
                    <GraduationCap
                      className={`w-7 h-7 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                      New to BRRRR?
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                      BRRRR has the highest learning curve of any real estate
                      investing strategy. You need to understand deal analysis,
                      renovation management, landlording, refinance timing, and
                      portfolio finance &mdash; and each stage has to be
                      executed well for the strategy to work.
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      FlipOps structures the entire process so each stage flows
                      naturally into the next. Built-in guardrails protect you
                      from common mistakes, and the platform&apos;s data
                      continuity means you always know exactly where you stand
                      &mdash; financially and operationally.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href="/features/guardrails"
                        className={`inline-flex items-center gap-1.5 text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} hover:underline`}
                      >
                        Financial Guardrails
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href="/features/mao-calculator"
                        className={`inline-flex items-center gap-1.5 text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} hover:underline`}
                      >
                        MAO Calculator
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href="/features/rehab-tracking"
                        className={`inline-flex items-center gap-1.5 text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} hover:underline`}
                      >
                        Rehab Tracking
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Section 6 — CTA                                             */}
        {/* ============================================================ */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <AnimateOnScroll>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                See FlipOps for BRRRR Investors in Action
              </h2>
            </AnimateOnScroll>
            <AnimateOnScroll custom={1}>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                Walk through the full BRRRR lifecycle &mdash; from distress
                scoring to rental portfolio management.
              </p>
            </AnimateOnScroll>
            <AnimateOnScroll custom={2}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/demo">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-base min-w-[160px]"
                  >
                    View Demo
                  </Button>
                </Link>
                <Link href="/reserve">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 text-base min-w-[160px]"
                  >
                    Reserve Your Spot
                  </Button>
                </Link>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
