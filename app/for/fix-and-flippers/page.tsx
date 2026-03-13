'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Hammer,
  DollarSign,
  TrendingDown,
  Clock,
  Calculator,
  Shield,
  Wrench,
  ArrowRight,
  Search,
  FileText,
  Camera,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Target,
  Users,
  Lightbulb,
  BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const problemPoints = [
  {
    icon: DollarSign,
    title: 'Profit Is Made at Purchase',
    description:
      'You lock in a 25% margin at acquisition — but that number is only as good as your ARV and repair estimates. One miscalculation and the deal is underwater before you swing a hammer.',
  },
  {
    icon: TrendingDown,
    title: 'Lost During Renovation',
    description:
      'Foundation issues, contractor delays, holding cost overruns. That 25% margin quietly becomes 10% — or worse. By the time you notice, it\'s too late to course-correct.',
  },
  {
    icon: Clock,
    title: 'Too Many Moving Parts',
    description:
      'Multiple timelines, contractors, budgets, and draws running simultaneously. Spreadsheets break. Texts get lost. You need tools that help you EXECUTE deals profitably — not just find them.',
  },
];

const workflowSteps = [
  {
    number: '01',
    icon: Search,
    title: 'Find',
    description:
      'Distress scoring with behavioral learning tuned to flip criteria. Property condition signals — code violations, vacancy, deferred maintenance — are weighted higher because condition drives your renovation budget.',
    href: '/features/distress-scoring',
    linkText: 'How distress scoring works',
  },
  {
    number: '02',
    icon: Calculator,
    title: 'Analyze',
    description:
      'MAO calculator with detailed repair estimation across 12+ categories. Comp-driven ARV, transparent waterfall breakdown, and adjustable assumptions so you know your max offer before you bid.',
    href: '/features/mao-calculator',
    linkText: 'See the MAO calculator',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Offer & Contract',
    description:
      'Pipeline management with margin tracking from day one. Every deal shows projected profit, cost basis, and margin percentage — updated in real time as variables change.',
    href: null,
    linkText: null,
  },
  {
    number: '04',
    icon: Wrench,
    title: 'Renovate',
    description:
      'Budget tracking, vendor assignment, timeline management, and photo documentation. Real-time budget-to-actual comparison with alerts when line items exceed estimates.',
    href: '/features/rehab-tracking',
    linkText: 'Explore rehab tracking',
  },
  {
    number: '05',
    icon: BarChart3,
    title: 'Sell or Hold',
    description:
      'Track listing status, days on market, and sale price vs. projected ARV. Final P&L calculated automatically — know your actual return, not just your guess.',
    href: null,
    linkText: null,
  },
];

const guardrailReasons = [
  {
    icon: AlertTriangle,
    title: 'Rehab Variables',
    description: 'Scope changes, hidden damage, material cost swings — renovation budgets have more unknowns than any other deal type.',
  },
  {
    icon: Users,
    title: 'Contractor Reliability',
    description: 'No-shows, slow work, poor quality. Every day of delay adds holding costs. You need visibility into who delivers and who doesn\'t.',
  },
  {
    icon: DollarSign,
    title: 'Material Costs',
    description: 'Lumber, fixtures, appliances — prices shift. A budget set 60 days ago may be 15% off by the time you\'re ordering.',
  },
  {
    icon: Clock,
    title: 'Timeline Risk',
    description: 'Every month of holding costs eats into your margin. A 4-month flip that takes 7 months can turn a win into a loss.',
  },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FixAndFlippersPage() {
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
        {/* ───────────────────── Section 1: Hero ───────────────────── */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span>For Investors</span>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">Fix-and-Flippers</span>
            </nav>

            <motion.div
              className="flex flex-col items-start"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionPill
                pillClassName="bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25"
                glowColor="245, 158, 11"
              >
                <Hammer className="w-4 h-4" />
                Built for Flippers
              </SectionPill>

              <h1
                className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mt-8 mb-6 max-w-4xl relative z-10 pb-1"
                style={isDarkMode ? {
                  backgroundImage: 'radial-gradient(ellipse 120% 200% at 10% -20%, rgb(249, 115, 22) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.45) 75%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                } : undefined}
              >
                Protect Your Margins on Every Flip — From Acquisition to Sale
              </h1>
              <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl relative z-10">
                FlipOps gives flippers the confidence to bid smart, renovate on budget, and close profitably. Accurate underwriting, renovation tracking, and margin protection at every stage.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ──────────── Section 2: The Flipper's Problem ──────────── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                The Flipper&apos;s Problem
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Profit is made at purchase, but lost during renovation. Every flipper knows the math — the hard part is keeping that math honest through closing.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {problemPoints.map((point, i) => {
                const Icon = point.icon;
                return (
                  <motion.div
                    key={point.title}
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="rounded-2xl p-6"
                    style={cardStyle}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-red-500/15' : 'bg-red-50'}`}>
                      <Icon className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{point.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{point.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ──────── Section 3: How FlipOps Serves Flippers ──────── */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                How FlipOps Serves Flippers
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                A complete workflow from deal sourcing to final P&amp;L. Every step tracks margin so you never lose sight of profitability.
              </p>
            </motion.div>

            <div className="space-y-6">
              {workflowSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="rounded-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start"
                    style={cardStyle}
                  >
                    {/* Step number + icon */}
                    <div className="flex items-center gap-4 lg:min-w-[180px] shrink-0">
                      <span className={`text-3xl font-bold tabular-nums ${isDarkMode ? 'text-amber-400/30' : 'text-amber-500/25'}`}>
                        {step.number}
                      </span>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
                        <Icon className={`w-6 h-6 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white lg:hidden">{step.title}</h3>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 hidden lg:block">{step.title}</h3>
                      <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400 leading-relaxed">{step.description}</p>
                      {step.href && (
                        <Link href={step.href} className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                          {step.linkText} <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 4: Why Flippers Need Guardrails More Than Anyone ── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="text-center mb-6">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Why Flippers Need Guardrails More Than Anyone
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-14">
                Flippers are the most exposed to margin erosion. More moving parts means more places for profit to leak. FlipOps&apos; guardrail system was designed with flippers in mind.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {guardrailReasons.map((reason, i) => {
                const Icon = reason.icon;
                return (
                  <motion.div
                    key={reason.title}
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="rounded-2xl p-6 flex gap-5"
                    style={cardStyle}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
                      <Icon className={`w-6 h-6 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{reason.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{reason.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.4 }} className="text-center">
              <Link href="/features/guardrails" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                Learn how guardrails protect your margins <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ──────────── Section 5: For New Flippers ──────────── */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-4xl">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5 }}
              className="rounded-2xl p-8 lg:p-12"
              style={cardStyle}
            >
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
                  <Lightbulb className={`w-7 h-7 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <div>
                  <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                    Planning Your First Flip?
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                    Your first flip is the most important one to get right. FlipOps gives you structure from day one: a pipeline that enforces discipline, MAO analysis before you make an offer, renovation tracking for every dollar, and projected profit updates in real time. You don&apos;t need experience — you need a system that keeps you honest.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { text: 'Structured deal pipeline', href: null },
                      { text: 'MAO before you offer', href: '/features/mao-calculator' },
                      { text: 'Track every renovation dollar', href: '/features/budget-tracking' },
                      { text: 'Real-time margin alerts', href: '/features/margin-alerts' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-center gap-2.5">
                        <CheckCircle2 className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                        {item.href ? (
                          <Link href={item.href} className="text-sm text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                            {item.text}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.text}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ───────────────────── Section 6: CTA ───────────────────── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                See FlipOps for Flippers in Action
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                Walk through the full flipper workflow — from distress scoring and underwriting to renovation tracking and final P&amp;L.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/demo">
                  <Button variant="outline" size="lg" className="text-base min-w-[160px]">View Demo</Button>
                </Link>
                <Link href="/reserve">
                  <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/25 text-base min-w-[160px]">
                    Reserve Your Spot
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
