'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionPill } from './section-pill';
import {
  Brain,
  MousePointerClick,
  TrendingUp,
  Eye,
  Target,
  ArrowRight,
  Home,
  DollarSign,
  MapPin,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from 'lucide-react';

const behavioralSignals = [
  'Price ranges you pursue',
  'Distress profiles you click',
  'Property types you skip',
  'Markets where you close',
  'Deal sizes you prefer',
  'Rehab levels you target',
  'Lead sources you favor',
  'Response time patterns',
  'Offer-to-close ratios',
  'Seasonal preferences',
  'Neighborhood demographics',
  'Days on market thresholds',
  'Equity percentages',
  'Motivation indicators',
  'Competition avoidance',
];

const steps = [
  {
    id: 'work',
    number: '01',
    title: 'You work deals',
    description: 'Just use the platform normally. Click leads, make offers, close deals. No extra work required.',
    icon: MousePointerClick,
    color: 'blue',
  },
  {
    id: 'watch',
    number: '02',
    title: 'The algorithm watches',
    description: 'FlipOps tracks 15+ behavioral signals behind the scenes — what you click, skip, pursue, and close.',
    icon: Eye,
    color: 'purple',
  },
  {
    id: 'adapt',
    number: '03',
    title: 'Your scores adapt',
    description: 'Next time properties come in, the ones matching your pattern surface higher. Scoring becomes personal.',
    icon: Target,
    color: 'emerald',
  },
];

// Simulated lead card for the demo
function LeadCard({
  address,
  city,
  price,
  score,
  isHighlighted,
  action,
  isDarkMode = false,
}: {
  address: string;
  city: string;
  price: number;
  score: number;
  isHighlighted?: boolean;
  action?: 'pursued' | 'skipped';
  isDarkMode?: boolean;
}) {
  const cardStyle = isDarkMode ? {
    background: isHighlighted
      ? 'linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.05) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
    border: 'none',
    boxShadow: [
      `0 0 0 1px ${isHighlighted ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
      'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
      '0 1px 3px rgba(0, 0, 0, 0.2)',
      '0 4px 12px rgba(0, 0, 0, 0.2)',
    ].join(', '),
  } : {
    background: isHighlighted
      ? 'linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)'
      : 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
    boxShadow: [
      `0 0 0 1px ${isHighlighted ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.06)'}`,
      'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.03)',
      '0 1px 2px rgba(0, 0, 0, 0.04)',
      '0 4px 12px rgba(0, 0, 0, 0.05)',
    ].join(', '),
  };

  return (
    <motion.div
      layout
      className="p-3 rounded-lg transition-all"
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isHighlighted ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-zinc-700'
          }`}>
            <Home className={`h-4 w-4 ${isHighlighted ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{address}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{city}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${
            score >= 85 ? 'text-emerald-600 dark:text-emerald-400' :
            score >= 70 ? 'text-blue-600 dark:text-blue-400' :
            'text-gray-500'
          }`}>
            {score}
          </div>
          <div className="text-[10px] text-gray-400 uppercase">Score</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">${price.toLocaleString()}</span>
        {action && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            action === 'pursued'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
          }`}>
            {action === 'pursued' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {action === 'pursued' ? 'Pursued' : 'Skipped'}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// Animated signal tracker
function SignalTracker() {
  const [visibleSignals, setVisibleSignals] = useState<number[]>([0, 1, 2, 3, 4]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleSignals(prev => {
        const next = prev.map(i => (i + 1) % behavioralSignals.length);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {visibleSignals.map((signalIndex, i) => (
          <motion.div
            key={`${signalIndex}-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 text-sm"
          >
            <div className={`w-2 h-2 rounded-full ${
              i === 0 ? 'bg-purple-500' :
              i === 1 ? 'bg-purple-400' :
              i === 2 ? 'bg-purple-300' :
              'bg-purple-200'
            }`} />
            <span className="text-gray-600 dark:text-gray-400">{behavioralSignals[signalIndex]}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Personalization comparison
function PersonalizationDemo({ isDarkMode = false }: { isDarkMode?: boolean }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Wholesaler */}
      <div
        className="rounded-xl overflow-hidden"
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          boxShadow: [
            '0 0 0 1px rgba(255, 255, 255, 0.06)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
            '0 2px 8px rgba(0, 0, 0, 0.25)',
            '0 8px 20px rgba(0, 0, 0, 0.2)',
          ].join(', '),
        } : {
          background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
          boxShadow: [
            '0 0 0 1px rgba(249, 115, 22, 0.12)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
            '0 1px 2px rgba(0, 0, 0, 0.04)',
            '0 4px 12px rgba(0, 0, 0, 0.06)',
            '0 12px 32px rgba(0, 0, 0, 0.04)',
          ].join(', '),
        }}
      >
        <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 border-b border-orange-500">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-bold text-white">JM</span>
            </div>
            <div>
              <div className="font-medium text-white text-sm">Jake M.</div>
              <div className="text-xs text-white/80">Wholesaler · Phoenix, AZ</div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Top Leads Today</div>
          <div className="space-y-2">
            <LeadCard address="4521 W Camelback" city="Phoenix, AZ" price={185000} score={94} isHighlighted isDarkMode={isDarkMode} />
            <LeadCard address="1892 N 32nd St" city="Phoenix, AZ" price={142000} score={91} isDarkMode={isDarkMode} />
            <LeadCard address="3301 E Indian School" city="Phoenix, AZ" price={168000} score={87} isDarkMode={isDarkMode} />
          </div>
          <div className="pt-3 text-xs text-gray-500 dark:text-gray-400 italic">
            High-velocity deals, motivated sellers, quick closes
          </div>
        </div>
      </div>

      {/* Flipper */}
      <div
        className="rounded-xl overflow-hidden"
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          boxShadow: [
            '0 0 0 1px rgba(255, 255, 255, 0.06)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
            '0 2px 8px rgba(0, 0, 0, 0.25)',
            '0 8px 20px rgba(0, 0, 0, 0.2)',
          ].join(', '),
        } : {
          background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
          boxShadow: [
            '0 0 0 1px rgba(59, 130, 246, 0.12)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
            '0 1px 2px rgba(0, 0, 0, 0.04)',
            '0 4px 12px rgba(0, 0, 0, 0.06)',
            '0 12px 32px rgba(0, 0, 0, 0.04)',
          ].join(', '),
        }}
      >
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 border-b border-blue-500">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-bold text-white">SR</span>
            </div>
            <div>
              <div className="font-medium text-white text-sm">Sarah R.</div>
              <div className="text-xs text-white/80">Flipper · Atlanta, GA</div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Top Leads Today</div>
          <div className="space-y-2">
            <LeadCard address="892 Ponce de Leon" city="Atlanta, GA" price={295000} score={96} isHighlighted isDarkMode={isDarkMode} />
            <LeadCard address="1456 Peachtree St" city="Atlanta, GA" price={342000} score={89} isDarkMode={isDarkMode} />
            <LeadCard address="2801 Buckhead Loop" city="Atlanta, GA" price={278000} score={85} isDarkMode={isDarkMode} />
          </div>
          <div className="pt-3 text-xs text-gray-500 dark:text-gray-400 italic">
            High ARV potential, cosmetic rehabs, emerging neighborhoods
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScoringEngine() {
  const [activeStep, setActiveStep] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <section id="scoring" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
            glowColor="45, 212, 191"
            staggerIndex={1}
          >
            <Brain className="h-4 w-4" />
            Behavioral Learning
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-teal">
            A Scoring Engine That Learns<br className="hidden sm:block" /> How You Invest
          </h2>
          <p className="relative z-10 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Every investor has a strategy. FlipOps learns yours.
          </p>
        </motion.div>

        {/* Three-Step Flow */}
        <div className="max-w-5xl mx-auto mb-16">
          {/* Step Cards */}
          <div className="grid md:grid-cols-3 gap-6 relative">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = activeStep === i;
              const colorClasses = {
                blue: {
                  icon: 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white',
                  number: 'text-blue-600 dark:text-blue-400',
                  darkAccent: '59, 130, 246',
                  gradientTo: '99, 102, 241',
                },
                purple: {
                  icon: 'bg-gradient-to-br from-purple-500 to-pink-500 text-white',
                  number: 'text-purple-600 dark:text-purple-400',
                  darkAccent: '168, 85, 247',
                  gradientTo: '236, 72, 153',
                },
                emerald: {
                  icon: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white',
                  number: 'text-emerald-600 dark:text-emerald-400',
                  darkAccent: '16, 185, 129',
                  gradientTo: '20, 184, 166',
                },
              }[step.color];

              const darkCardStyle = isDarkMode ? {
                background: `linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)`,
                border: 'none',
                boxShadow: [
                  `0 0 0 1px rgba(${colorClasses.darkAccent}, ${isActive ? '0.35' : '0.15'})`,
                  'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                  '0 2px 4px rgba(0, 0, 0, 0.25)',
                  '0 8px 20px rgba(0, 0, 0, 0.35)',
                  '0 16px 40px rgba(0, 0, 0, 0.25)',
                  ...(isActive ? [`0 0 20px rgba(${colorClasses.darkAccent}, 0.12)`] : []),
                ].join(', '),
              } : undefined;

              const lightActive = !isDarkMode && isActive;

              const lightCardStyle = !isDarkMode ? {
                background: '#ffffff',
                boxShadow: isActive
                  ? [
                      `0 0 0 2px rgba(${colorClasses.darkAccent}, 0.5)`,
                      `0 0 12px rgba(${colorClasses.darkAccent}, 0.15)`,
                      '0 2px 8px rgba(0,0,0,0.04)',
                      '0 4px 12px rgba(0,0,0,0.04)',
                    ].join(', ')
                  : [
                      `0 0 0 1px rgba(${colorClasses.darkAccent}, 0.12)`,
                      '0 2px 8px rgba(0,0,0,0.04)',
                      '0 4px 12px rgba(0,0,0,0.04)',
                    ].join(', '),
              } : undefined;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  onClick={() => setActiveStep(i)}
                  className="relative z-10 rounded-xl cursor-pointer p-6"
                  style={isDarkMode ? darkCardStyle : lightCardStyle}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses.icon}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-bold ${colorClasses.number} mb-1`}>{step.number}</div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Active Step Demo */}
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            {activeStep === 0 && (
              <div
                className="rounded-xl p-6"
                style={isDarkMode ? {
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                  border: 'none',
                  boxShadow: [
                    '0 0 0 1px rgba(255, 255, 255, 0.08)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                    '0 2px 4px rgba(0, 0, 0, 0.25)',
                    '0 8px 20px rgba(0, 0, 0, 0.35)',
                    '0 16px 40px rgba(0, 0, 0, 0.25)',
                  ].join(', '),
                } : {
                  background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
                  boxShadow: [
                    '0 0 0 1px rgba(0, 0, 0, 0.06)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                    '0 1px 2px rgba(0, 0, 0, 0.04)',
                    '0 4px 12px rgba(0, 0, 0, 0.06)',
                    '0 12px 32px rgba(0, 0, 0, 0.04)',
                  ].join(', '),
                }}
              >
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">Your daily lead activity:</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <LeadCard address="1234 Oak St" city="Phoenix, AZ" price={165000} score={82} action="pursued" isDarkMode={isDarkMode} />
                  <LeadCard address="892 Pine Ave" city="Phoenix, AZ" price={425000} score={71} action="skipped" isDarkMode={isDarkMode} />
                  <LeadCard address="456 Maple Dr" city="Phoenix, AZ" price={189000} score={78} action="pursued" isDarkMode={isDarkMode} />
                  <LeadCard address="2101 Cedar Ln" city="Scottsdale, AZ" price={520000} score={65} action="skipped" isDarkMode={isDarkMode} />
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <div
                className="rounded-xl p-6"
                style={isDarkMode ? {
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                  border: 'none',
                  boxShadow: [
                    '0 0 0 1px rgba(168, 85, 247, 0.15)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                    '0 2px 4px rgba(0, 0, 0, 0.25)',
                    '0 8px 20px rgba(0, 0, 0, 0.35)',
                    '0 16px 40px rgba(0, 0, 0, 0.25)',
                  ].join(', '),
                } : {
                  background: 'linear-gradient(180deg, #f3e8ff 0%, #faf5ff 100%)',
                  boxShadow: [
                    '0 0 0 1px rgba(168, 85, 247, 0.12)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                    '0 1px 2px rgba(0, 0, 0, 0.04)',
                    '0 4px 12px rgba(0, 0, 0, 0.06)',
                    '0 12px 32px rgba(0, 0, 0, 0.04)',
                  ].join(', '),
                }}
              >
                <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-4">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium">Tracking 15+ behavioral signals...</span>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <SignalTracker />
                  <SignalTracker />
                  <SignalTracker />
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div
                className="rounded-xl p-6"
                style={isDarkMode ? {
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                  border: 'none',
                  boxShadow: [
                    '0 0 0 1px rgba(16, 185, 129, 0.15)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                    '0 2px 4px rgba(0, 0, 0, 0.25)',
                    '0 8px 20px rgba(0, 0, 0, 0.35)',
                    '0 16px 40px rgba(0, 0, 0, 0.25)',
                  ].join(', '),
                } : {
                  background: 'linear-gradient(180deg, #d1fae5 0%, #ecfdf5 100%)',
                  boxShadow: [
                    '0 0 0 1px rgba(16, 185, 129, 0.12)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                    '0 1px 2px rgba(0, 0, 0, 0.04)',
                    '0 4px 12px rgba(0, 0, 0, 0.06)',
                    '0 12px 32px rgba(0, 0, 0, 0.04)',
                  ].join(', '),
                }}
              >
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-4">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Personalized scoring in action</span>
                </div>
                <PersonalizationDemo isDarkMode={isDarkMode} />
              </div>
            )}
          </motion.div>
        </div>

        {/* Key Insight Callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-6 text-center shadow-xl shadow-primary/20">
            <p className="text-lg text-white/90 mb-2">
              A wholesaler in Phoenix and a flipper in Atlanta get different top leads —
            </p>
            <p className="text-xl font-bold text-white">
              because they should.
            </p>
            <p className="text-sm text-white/70 mt-4">
              One-size-fits-all scoring is broken. Two investors with completely different strategies shouldn&apos;t see the same rankings.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
