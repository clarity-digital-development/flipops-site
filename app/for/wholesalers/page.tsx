'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Search,
  Zap,
  UserSearch,
  Calculator,
  ClipboardList,
  FileCheck,
  ArrowRight,
  Target,
  Brain,
  TrendingUp,
  Lightbulb,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const painPoints = [
  {
    icon: Target,
    title: 'Your leads are weak',
    description:
      "You're only as good as your lead flow. If your leads are weak, no amount of cold calling will fix it. Bad data in means wasted dials out.",
  },
  {
    icon: TrendingUp,
    title: 'Your margins are thin',
    description:
      "A $5K\u201315K assignment fee doesn't leave room for wasted costs. Every bad skip trace, every missed follow-up, every deal you underbid chips away at your take-home.",
  },
  {
    icon: Zap,
    title: 'Speed is everything',
    description:
      'First to contact a motivated seller wins. If you\u2019re manually pulling lists, skip tracing one by one, and dialing from a spreadsheet, you\u2019re already behind.',
  },
];

const workflowSteps = [
  {
    icon: Search,
    step: '1',
    title: 'Find',
    description:
      'Distress scoring surfaces the most motivated sellers automatically. No more buying stale lists.',
    href: '/features/distress-scoring',
  },
  {
    icon: UserSearch,
    step: '2',
    title: 'Contact',
    description:
      'Automated skip tracing fires at 70+ distress threshold. Contact info is ready before you even open the lead.',
    href: '/features/skip-tracing',
  },
  {
    icon: Calculator,
    step: '3',
    title: 'Analyze',
    description:
      'MAO calculator gives you your number in seconds. No spreadsheet gymnastics, no guessing.',
    href: '/features/mao-calculator',
  },
  {
    icon: ClipboardList,
    step: '4',
    title: 'Offer',
    description:
      'Track all active offers in one place. See your offer-to-acceptance ratio and tighten your strategy.',
    href: '/features/deal-pipeline',
  },
  {
    icon: FileCheck,
    step: '5',
    title: 'Contract',
    description:
      'Manage contingencies, deadlines, and earnest money. Never miss an inspection window or extension date.',
    href: '/features/deal-pipeline',
  },
  {
    icon: RefreshCw,
    step: '6',
    title: 'Assign',
    description:
      'Market to your buyer database, track assignment fee, and monitor closing progress all in one view.',
    href: '/features/deal-pipeline',
  },
];

const behavioralBenefits = [
  {
    icon: Brain,
    title: 'High volume means more signal',
    description:
      'You evaluate 200 leads to make 30 offers to close 3 deals. That\u2019s 200 data points most platforms ignore.',
  },
  {
    icon: Target,
    title: 'The system learns from everything',
    description:
      'FlipOps learns from ALL 200 interactions \u2014 including the 170 you skipped. It learns what a waste of time looks like, not just what a winner looks like.',
  },
  {
    icon: TrendingUp,
    title: 'Less noise, more signal',
    description:
      'Your daily lead feed gets sharper over time. Fewer dead-end leads, more motivated sellers \u2014 personalized to your market and strategy.',
  },
];

const newWholesalerBenefits = [
  {
    icon: Compass,
    title: 'Structure from day one',
    description:
      'Pipeline stages, MAO calculator, and built-in guardrails give you a framework before you close your first deal.',
    href: '/features/guardrails',
  },
  {
    icon: Lightbulb,
    title: 'A system that teaches good habits',
    description:
      'FlipOps isn\u2019t just a tool \u2014 it\u2019s a system. It enforces the disciplines that separate wholesalers who scale from those who quit after 6 months.',
    href: null,
  },
  {
    icon: ShieldCheck,
    title: 'Guardrails prevent expensive mistakes',
    description:
      'Automated alerts when your exposure is too high, your assignment fee is too thin, or a deadline is approaching. The safety net you don\u2019t get from YouTube courses.',
    href: '/features/guardrails',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WholesalersPage() {
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
        {/* ── Section 1: Hero ── */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span>For Investors</span>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">Wholesalers</span>
            </nav>

            <div className="flex flex-col items-start">
              <SectionPill
                pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
                glowColor="59, 130, 246"
              >
                <RefreshCw className="w-4 h-4" />
                Built for Wholesalers
              </SectionPill>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mt-8 mb-6 max-w-4xl relative z-10 pb-1"
                style={isDarkMode ? {
                  backgroundImage: 'radial-gradient(ellipse 120% 200% at 10% -20%, rgb(59, 130, 246) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.45) 75%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                } : undefined}
              >
                Close More Wholesale Deals With Less Wasted Outreach
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl relative z-10"
              >
                FlipOps scores distressed properties, auto-traces motivated sellers, and manages your assignment pipeline &mdash; so you can focus on making offers, not hunting for leads.
              </motion.p>
            </div>
          </div>
        </section>

        {/* ── Section 2: The Wholesaler's Problem ── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
              className="text-center mb-14"
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                The Wholesaler&rsquo;s Problem
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Sound familiar? These are the realities that cost wholesalers deals every single week.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {painPoints.map((point, i) => {
                const Icon = point.icon;
                return (
                  <motion.div
                    key={point.title}
                    variants={fadeUp}
                    custom={i}
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
            </motion.div>
          </div>
        </section>

        {/* ── Section 3: How FlipOps Serves Wholesalers (Workflow) ── */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
              className="text-center mb-14"
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                How FlipOps Serves Wholesalers
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                From first lead to assignment close &mdash; every step of the wholesale workflow, handled.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {workflowSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div key={step.title} variants={fadeUp} custom={i}>
                    <Link href={step.href} className="group block h-full">
                      <div
                        className="rounded-2xl p-6 h-full flex flex-col transition-transform duration-200 hover:-translate-y-1"
                        style={cardStyle}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${isDarkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            {step.step}
                          </div>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                            <Icon className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{step.description}</p>
                        <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                          Learn more <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── Section 4: Why Behavioral Learning Benefits Wholesalers ── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
              className="text-center mb-14"
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Why Wholesalers Specifically Benefit From Behavioral Learning
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                High-volume strategies generate enormous data. FlipOps is the only platform that turns all of it &mdash; including your rejections &mdash; into better leads.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {behavioralBenefits.map((benefit, i) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={benefit.title}
                    variants={fadeUp}
                    custom={i}
                    className="rounded-2xl p-6"
                    style={cardStyle}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                      <Icon className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{benefit.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── Section 5: For New Wholesalers ── */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
              className="text-center mb-14"
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                New to Wholesaling?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                FlipOps isn&rsquo;t just a tool for experienced wholesalers. It&rsquo;s a system that gives new investors the structure, guardrails, and confidence to close their first deals.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {newWholesalerBenefits.map((benefit, i) => {
                const Icon = benefit.icon;
                const inner = (
                  <div
                    className="rounded-2xl p-6 h-full flex flex-col transition-transform duration-200 hover:-translate-y-1"
                    style={cardStyle}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                      <Icon className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">{benefit.description}</p>
                    {benefit.href && (
                      <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                        Learn more <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
                return (
                  <motion.div key={benefit.title} variants={fadeUp} custom={i}>
                    {benefit.href ? (
                      <Link href={benefit.href} className="group block h-full">{inner}</Link>
                    ) : (
                      <div className="h-full">{inner}</div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── Section 6: CTA ── */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              custom={0}
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                See FlipOps for Wholesalers in Action
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                Walk through the full wholesale workflow &mdash; from distress scoring to assignment close.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/demo">
                  <Button variant="outline" size="lg" className="text-base min-w-[160px]">View Demo</Button>
                </Link>
                <Link href="/reserve">
                  <Button size="lg" className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 text-base min-w-[160px]">
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
