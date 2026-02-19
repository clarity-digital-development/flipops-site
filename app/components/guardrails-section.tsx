'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SectionPill } from './section-pill';
import {
  AlertTriangle,
  Shield,
  Clock,
  Bell,
  Calculator,
} from 'lucide-react';

// Guardrail card data
const guardrailCards = [
  {
    id: 'budget',
    headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    headerBorder: 'border-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-white',
    title: 'Budget Alert',
    titleColor: 'text-white',
    statValue: '12+',
    statLabel: 'cost categories tracked per deal',
  },
  {
    id: 'deadline',
    headerBg: 'bg-gradient-to-r from-rose-500 to-pink-500',
    headerBorder: 'border-rose-500',
    icon: Bell,
    iconColor: 'text-white',
    title: 'Deadline Warning',
    titleColor: 'text-white',
    statValue: 'Automated',
    statLabel: 'skip tracing & milestone alerts',
  },
  {
    id: 'mao',
    headerBg: 'bg-gradient-to-r from-orange-500 to-red-500',
    headerBorder: 'border-orange-500',
    icon: Calculator,
    iconColor: 'text-white',
    title: 'Margin Alert',
    titleColor: 'text-white',
    statValue: '15+',
    statLabel: 'distress signals analyzed per property',
  },
];

// Budget Alert Content
function BudgetAlertContent({ isDarkMode = false }: { isDarkMode?: boolean }) {
  return (
    <div className="p-4 space-y-3 flex-1">
      <div className="text-xs text-gray-500 dark:text-white/80 font-medium">1842 Main St</div>
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900 dark:text-white">Electrical</span>
        <span className="text-amber-600 dark:text-amber-400 font-bold">+12%</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-white/30">Budgeted</div>
          <div className="font-medium text-gray-700 dark:text-white/70">$8,500</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-white/30">Actual</div>
          <div className="font-medium text-amber-600">$9,520</div>
        </div>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={isDarkMode ? {
          background: 'rgba(255,255,255,0.04)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
        } : { background: '#f3f4f6' }}
      >
        <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500" style={{ width: '100%' }} />
      </div>
    </div>
  );
}

// Deadline Warning Content
function DeadlineContent({ isDarkMode = false }: { isDarkMode?: boolean }) {
  return (
    <div className="p-4 space-y-3 flex-1">
      <div className="text-xs text-gray-500 dark:text-white/80 font-medium">892 Oak Ave</div>
      <div className="font-medium text-gray-900 dark:text-white">Inspection Contingency</div>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-rose-500" />
        <span className="text-rose-600 dark:text-rose-400 font-bold">5 days remaining</span>
      </div>
      <div
        className={isDarkMode ? 'rounded px-3 py-2 text-sm' : 'bg-rose-100 rounded px-3 py-2 text-sm'}
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(244,63,94,0.12) 0%, rgba(244,63,94,0.06) 100%)',
          boxShadow: '0 0 0 1px rgba(244,63,94,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        } : {}}
      >
        <span className="text-gray-600 dark:text-white/40">At risk: </span>
        <span className="text-rose-600 dark:text-rose-400 font-medium">$8K extension fee</span>
      </div>
    </div>
  );
}

// MAO Risk Content
function MAOContent({ isDarkMode = false }: { isDarkMode?: boolean }) {
  return (
    <div className="p-4 space-y-3 flex-1">
      <div className="text-xs text-gray-500 dark:text-white/80 font-medium">2210 Pine Blvd</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 dark:text-white/30">ARV</div>
          <div className="font-medium text-gray-700 dark:text-white/70">$385,000</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-white/30">Your MAO</div>
          <div className="font-medium text-emerald-600">$241,000</div>
        </div>
      </div>
      <div
        className={isDarkMode ? 'flex items-center justify-between rounded px-3 py-2' : 'flex items-center justify-between bg-orange-100 rounded px-3 py-2'}
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.06) 100%)',
          boxShadow: '0 0 0 1px rgba(249,115,22,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        } : {}}
      >
        <div>
          <div className="text-xs text-gray-500 dark:text-white/30">Offer Price</div>
          <div className="font-medium text-orange-600">$255,000</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-white/30">Margin</div>
          <div className="font-bold text-orange-600">13%</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
        <AlertTriangle className="h-4 w-4" />
        <span>Below 15% target margin</span>
      </div>
    </div>
  );
}

export function GuardrailsSection() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <section id="guardrails" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Section Header with Personal Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25"
            glowColor="249, 115, 22"
            staggerIndex={3}
          >
            <Shield className="h-4 w-4" />
            Built-In Protection
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-orange">
            Guardrails That Watch Your Back
          </h2>
          <p className="relative z-10 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every alert exists because I&apos;ve personally lost money to the problem it solves.
          </p>
        </motion.div>

        {/* Three Connected Alert Cards */}
        <div
          className="grid md:grid-cols-3 gap-0 max-w-5xl mx-auto rounded-xl overflow-hidden"
          style={isDarkMode ? {
            background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
            boxShadow: [
              '0 0 0 1px rgba(255, 255, 255, 0.08)',
              'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
              '0 2px 4px rgba(0, 0, 0, 0.25)',
              '0 8px 20px rgba(0, 0, 0, 0.35)',
              '0 16px 40px rgba(0, 0, 0, 0.25)',
            ].join(', '),
          } : {
            background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
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
          {guardrailCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col"
                style={i < 2 ? (isDarkMode ? {
                  borderRight: '1px solid rgba(0,0,0,0.4)',
                  boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.04)',
                } : {
                  borderRight: '1px solid rgba(0, 0, 0, 0.06)',
                  boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.5)',
                }) : {}}
              >
                {/* Alert Header */}
                <div
                  className={`${card.headerBg} px-4 py-2 flex items-center gap-2`}
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.15)' }}
                >
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                  <span className={`text-sm font-medium ${card.titleColor}`}>{card.title}</span>
                </div>

                {/* Alert Content */}
                {card.id === 'budget' && <BudgetAlertContent isDarkMode={isDarkMode} />}
                {card.id === 'deadline' && <DeadlineContent isDarkMode={isDarkMode} />}
                {card.id === 'mao' && <MAOContent isDarkMode={isDarkMode} />}

                {/* Stats Footer */}
                <div
                  className="mt-auto px-4 py-3"
                  style={isDarkMode ? {
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 100%)',
                    borderTop: '1px solid rgba(0,0,0,0.5)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  } : {
                    background: '#f9fafb',
                    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{card.statValue}</span>
                    <span className="text-gray-600 dark:text-white/40">{card.statLabel}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
