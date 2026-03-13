'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  KanbanSquare,
  Calculator,
  Home,
  Shield,
  ArrowRight,
  Unplug,
  Link2,
  RefreshCw,
  Search,
  UserSearch,
  Hammer,
  AlertTriangle,
  Building2,
  Wrench,
  Users,
  DollarSign,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Lifecycle stages                                                    */
/* ------------------------------------------------------------------ */

type LifecycleStage = {
  label: string;
  tagline: string;
  accent: string;
  accentRgb: string;
  features: { href: string; title: string; description: string; icon: any }[];
};

const stages: LifecycleStage[] = [
  {
    label: 'Find',
    tagline: 'Surface motivated sellers before the competition.',
    accent: 'teal',
    accentRgb: '45, 212, 191',
    features: [
      {
        href: '/features/distress-scoring',
        title: 'Distress Scoring',
        description:
          'AI scores every property for 15+ distress signals — pre-foreclosure, tax liens, probate, vacancy, and more.',
        icon: TrendingUp,
      },
      {
        href: '/features/skip-tracing',
        title: 'Skip Tracing',
        description:
          'Find owner contact info instantly. Phone, email, and mailing addresses pulled from multiple data sources.',
        icon: UserSearch,
      },
    ],
  },
  {
    label: 'Analyze',
    tagline: 'Know your numbers before you make the call.',
    accent: 'blue',
    accentRgb: '59, 130, 246',
    features: [
      {
        href: '/features/mao-calculator',
        title: 'MAO Calculator',
        description:
          'Transparent waterfall breakdown of your maximum allowable offer with adjustable assumptions for every deal.',
        icon: Calculator,
      },
      {
        href: '/features/budget-tracking',
        title: 'Budget Tracking',
        description:
          'Line-item repair budgets that update in real time as invoices come in. No more surprise overruns.',
        icon: DollarSign,
      },
    ],
  },
  {
    label: 'Close',
    tagline: 'Move from offer to closing table without dropping the ball.',
    accent: 'purple',
    accentRgb: '168, 85, 247',
    features: [
      {
        href: '/features/deal-pipeline',
        title: 'Deal Pipeline',
        description:
          'Kanban-style pipeline from first contact to closing. Automate follow-ups, track statuses, never lose a lead.',
        icon: KanbanSquare,
      },
      {
        href: '/features/guardrails',
        title: 'Guardrails',
        description:
          'Automated alerts when budgets spike, deadlines slip, or margins shrink below your thresholds.',
        icon: Shield,
      },
      {
        href: '/features/margin-alerts',
        title: 'Margin Alerts',
        description:
          'Real-time notifications when deal economics change. Catch margin compression before it catches you.',
        icon: AlertTriangle,
      },
    ],
  },
  {
    label: 'Manage',
    tagline: 'Run your portfolio without leaving the platform.',
    accent: 'emerald',
    accentRgb: '52, 211, 153',
    features: [
      {
        href: '/features/property-management',
        title: 'Property Management',
        description:
          'Tenants, leases, maintenance requests, and rental income — all in one place for BRRRR investors.',
        icon: Home,
      },
      {
        href: '/features/rehab-tracking',
        title: 'Rehab Tracking',
        description:
          'Photo-documented progress, contractor schedules, and budget vs. actual tracking for every project.',
        icon: Hammer,
      },
      {
        href: '/features/rental-management',
        title: 'Rental Management',
        description:
          'Collect rent, track expenses, generate owner statements, and monitor vacancy across your portfolio.',
        icon: Building2,
      },
      {
        href: '/features/vendor-management',
        title: 'Vendor Management',
        description:
          'Rate contractors, track bids, and build your trusted vendor network with performance history.',
        icon: Wrench,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  "Why one platform" benefits                                         */
/* ------------------------------------------------------------------ */

const benefits = [
  {
    icon: RefreshCw,
    title: 'Data Continuity',
    description:
      'Your distress scoring improves when it knows which deals you actually closed — and which fell apart. Outcomes feed back into lead quality, so the system gets smarter with every deal.',
  },
  {
    icon: Unplug,
    title: 'No Manual Re-Entry',
    description:
      'Property data flows from lead scoring into underwriting, then into project management, then into your rental portfolio. Zero CSV exports. Zero copy-paste.',
  },
  {
    icon: Layers,
    title: 'Unified Financial Picture',
    description:
      'See acquisition cost, rehab spend, carrying costs, and rental income in one view. Know your true ROI without reconciling spreadsheets from five different tools.',
  },
];

/* ------------------------------------------------------------------ */
/*  Color maps                                                         */
/* ------------------------------------------------------------------ */

const accentText: Record<string, string> = {
  teal: 'text-teal-500',
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  emerald: 'text-emerald-500',
};

const accentTextDark: Record<string, string> = {
  teal: 'text-teal-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
};

const accentBorder: Record<string, string> = {
  teal: 'border-teal-500/20',
  blue: 'border-blue-500/20',
  purple: 'border-purple-500/20',
  emerald: 'border-emerald-500/20',
};

const accentBorderDark: Record<string, string> = {
  teal: 'border-teal-500/15',
  blue: 'border-blue-500/15',
  purple: 'border-purple-500/15',
  emerald: 'border-emerald-500/15',
};

const iconBgLight: Record<string, string> = {
  teal: 'bg-teal-50',
  blue: 'bg-blue-50',
  purple: 'bg-purple-50',
  emerald: 'bg-emerald-50',
};

const iconBgDark: Record<string, string> = {
  teal: 'bg-teal-500/15',
  blue: 'bg-blue-500/15',
  purple: 'bg-purple-500/15',
  emerald: 'bg-emerald-500/15',
};

const iconTextLight: Record<string, string> = {
  teal: 'text-teal-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  emerald: 'text-emerald-600',
};

const iconTextDark: Record<string, string> = {
  teal: 'text-teal-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
};

const stageNumBg: Record<string, string> = {
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  emerald: 'bg-emerald-500',
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function FeaturesPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    setIsDarkMode(root.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /* Card styles ---------------------------------------------------- */

  const cardStyle: React.CSSProperties = isDarkMode
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

  const benefitCardStyle: React.CSSProperties = isDarkMode
    ? {
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.05)',
      };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* -------------------------------------------------------- */}
        {/*  Hero                                                     */}
        {/* -------------------------------------------------------- */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">Features</span>
            </nav>

            <div className="flex flex-col items-center text-center">
              <SectionPill
                glowColor="45, 212, 191"
                pillClassName="bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/25"
              >
                <Sparkles className="w-4 h-4" />
                Full Lifecycle Platform
              </SectionPill>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-8 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight glow-heading-teal max-w-4xl"
              >
                Everything You Need.{' '}
                <span className="text-gray-900 dark:text-white">
                  Nothing You Don&apos;t.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="mt-6 text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl"
              >
                FlipOps covers every stage of the real estate investment
                lifecycle — from finding distressed properties to managing your
                portfolio.
              </motion.p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Lifecycle sections — horizontal bands per stage           */}
        {/* -------------------------------------------------------- */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="flex flex-col" style={{ gap: '5rem' }}>
              {stages.map((stage, stageIdx) => {
                const isFirst = stageIdx === 0;
                const primaryFeature = stage.features[0];
                const secondaryFeatures = stage.features.slice(1);
                const PrimaryIcon = primaryFeature.icon;

                const accentBorderTop: Record<string, string> = {
                  teal: 'border-teal-500',
                  blue: 'border-blue-500',
                  purple: 'border-purple-500',
                  emerald: 'border-emerald-500',
                };

                const accentLeftBorder: Record<string, string> = {
                  teal: 'border-l-teal-500/30',
                  blue: 'border-l-blue-500/30',
                  purple: 'border-l-purple-500/30',
                  emerald: 'border-l-emerald-500/30',
                };

                return (
                  <motion.div
                    key={stage.label}
                    custom={stageIdx}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-60px' }}
                    variants={fadeUp}
                  >
                    {/* Divider between stages */}
                    {!isFirst && (
                      <div className="border-t border-gray-200 dark:border-white/5 mb-12 -mt-8" />
                    )}

                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                      {/* Left column — 30% — Stage label */}
                      <div className={`lg:w-[30%] shrink-0 border-l-[3px] pl-6 ${accentLeftBorder[stage.accent]}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white ${stageNumBg[stage.accent]}`}
                          >
                            {String(stageIdx + 1).padStart(2, '0')}
                          </span>
                          <h2
                            className={`text-2xl lg:text-3xl font-bold tracking-tight ${
                              isDarkMode
                                ? accentTextDark[stage.accent]
                                : accentText[stage.accent]
                            }`}
                          >
                            {stage.label}
                          </h2>
                        </div>
                        <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                          {stage.tagline}
                        </p>
                      </div>

                      {/* Right column — 70% — Feature cards */}
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-40px' }}
                        className="lg:w-[70%] flex flex-col sm:flex-row gap-4"
                      >
                        {/* Primary card — larger */}
                        <motion.div variants={staggerItem} className={`${secondaryFeatures.length > 0 ? 'sm:w-[58%]' : 'w-full'}`}>
                          <Link
                            href={primaryFeature.href}
                            className={`group rounded-2xl p-6 flex flex-col h-full transition-transform duration-200 hover:-translate-y-1 border-t-[3px] ${accentBorderTop[stage.accent]} border border-t-0 ${
                              isDarkMode
                                ? accentBorderDark[stage.accent]
                                : accentBorder[stage.accent]
                            }`}
                            style={cardStyle}
                          >
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                                isDarkMode
                                  ? iconBgDark[stage.accent]
                                  : iconBgLight[stage.accent]
                              }`}
                            >
                              <PrimaryIcon
                                className={`w-6 h-6 ${
                                  isDarkMode
                                    ? iconTextDark[stage.accent]
                                    : iconTextLight[stage.accent]
                                }`}
                              />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {primaryFeature.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                              {primaryFeature.description}
                            </p>
                            <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                              Learn more
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </Link>
                        </motion.div>

                        {/* Secondary cards — smaller, stacked if multiple */}
                        {secondaryFeatures.length > 0 && (
                          <div className={`sm:w-[42%] flex flex-col gap-4`}>
                            {secondaryFeatures.map((feature) => {
                              const SecIcon = feature.icon;
                              return (
                                <motion.div key={feature.href} variants={staggerItem} className="flex-1">
                                  <Link
                                    href={feature.href}
                                    className={`group rounded-2xl p-5 flex flex-col h-full transition-transform duration-200 hover:-translate-y-1 border ${
                                      isDarkMode
                                        ? accentBorderDark[stage.accent]
                                        : accentBorder[stage.accent]
                                    }`}
                                    style={cardStyle}
                                  >
                                    <div
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                                        isDarkMode
                                          ? iconBgDark[stage.accent]
                                          : iconBgLight[stage.accent]
                                      }`}
                                    >
                                      <SecIcon
                                        className={`w-4 h-4 ${
                                          isDarkMode
                                            ? iconTextDark[stage.accent]
                                            : iconTextLight[stage.accent]
                                        }`}
                                      />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                                      {feature.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
                                      {feature.description}
                                    </p>
                                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                      Learn more
                                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                  </Link>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Why One Platform Matters                                  */}
        {/* -------------------------------------------------------- */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Why One Platform Matters
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Most investors juggle 6+ disconnected tools. That fragmentation
                costs time, money, and deals. Here&apos;s why a unified system
                changes everything.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {benefits.map((benefit, idx) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={benefit.title}
                    custom={idx}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    variants={fadeUp}
                    className="rounded-2xl p-6"
                    style={benefitCardStyle}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                        isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isDarkMode ? 'text-teal-400' : 'text-teal-600'
                        }`}
                      />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {benefit.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Final CTA                                                */}
        {/* -------------------------------------------------------- */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                Ready to see it in action?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                Walk through the full platform in under 5 minutes — or lock in
                early-access pricing before launch.
              </p>
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
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/25 text-base min-w-[160px]"
                  >
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
