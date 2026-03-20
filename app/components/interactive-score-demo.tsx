'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Home, TrendingUp, MousePointer } from 'lucide-react';

interface DistressSignal {
  name: string;
  points: number;
  color: string;
}

const mockLeads = [
  {
    address: '1547 Maple Ave',
    city: 'Jacksonville, FL',
    score: 75,
    signals: [
      { name: 'Pre-Foreclosure', points: 25, color: 'text-rose-600 dark:text-rose-400' },
      { name: 'Vacant Property', points: 15, color: 'text-orange-600 dark:text-orange-400' },
      { name: 'Tax Delinquent', points: 15, color: 'text-amber-600 dark:text-amber-400' },
      { name: 'High Equity', points: 10, color: 'text-emerald-600 dark:text-emerald-400' },
      { name: 'Aged Listing', points: 10, color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
  {
    address: '892 Pine Street',
    city: 'Tampa, FL',
    score: 52,
    signals: [
      { name: 'Pre-Foreclosure', points: 25, color: 'text-rose-600 dark:text-rose-400' },
      { name: 'High Equity', points: 10, color: 'text-emerald-600 dark:text-emerald-400' },
      { name: 'Aged Listing', points: 10, color: 'text-blue-600 dark:text-blue-400' },
      { name: 'Code Violations', points: 7, color: 'text-orange-600 dark:text-orange-400' },
    ],
  },
  {
    address: '2210 Oak Boulevard',
    city: 'Orlando, FL',
    score: 38,
    signals: [
      { name: 'Vacant Property', points: 15, color: 'text-orange-600 dark:text-orange-400' },
      { name: 'Tax Delinquent', points: 15, color: 'text-amber-600 dark:text-amber-400' },
      { name: 'Aged Listing', points: 8, color: 'text-blue-600 dark:text-blue-400' },
    ],
  },
];

export function InteractiveScoreDemo() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showPrompt, setShowPrompt] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dark mode detection
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Auto-cycle through leads every 4 seconds if user hasn't interacted
  useEffect(() => {
    if (hasInteracted) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % mockLeads.length;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [hasInteracted]);

  const handleLeadHover = (index: number) => {
    setActiveIndex(index);
    setHasInteracted(true);
    setShowPrompt(false);
  };

  const handleLeadLeave = () => {
    if (hasInteracted) {
      setActiveIndex(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-orange-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Hot Lead';
    if (score >= 50) return 'Warm Lead';
    return 'Cold Lead';
  };

  return (
    <div className="relative">
      {/* Instructional Prompt */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute -top-12 left-0 right-0 flex items-center justify-center z-20"
          >
            <div className="bg-gradient-to-r from-primary to-accent text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-primary/25">
              <MousePointer className="inline-block h-4 w-4 mr-2 animate-pulse" />
              Hover over any lead to see score breakdown
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mock Leads Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.02) 100%)',
          boxShadow: [
            '0 0 0 1px rgba(255, 255, 255, 0.08)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.10)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
            '0 2px 4px rgba(0, 0, 0, 0.3)',
            '0 8px 24px rgba(0, 0, 0, 0.45)',
            '0 20px 50px rgba(0, 0, 0, 0.35)',
          ].join(', '),
        } : {
          background: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: [
            '0 1px 2px rgba(0, 0, 0, 0.04)',
            '0 4px 12px rgba(0, 0, 0, 0.06)',
            '0 12px 32px rgba(0, 0, 0, 0.04)',
            'inset 0 -1px 0 rgba(0, 0, 0, 0.03)',
          ].join(', '),
        }}
      >
        {/* Table Header */}
        <div
          className="px-3 sm:px-6 py-3"
          style={isDarkMode ? {
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            borderBottom: '1px solid rgba(0,0,0,0.4)',
            boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.2)',
          } : {
            background: '#f9fafb',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            color: 'rgba(0, 0, 0, 0.45)',
          }}
        >
          <div className="flex items-center gap-2 sm:gap-4 text-[11px] font-semibold uppercase tracking-[0.15em]">
            <div className="flex-1 dark:text-white/35">Property</div>
            <div className="w-10 sm:w-12 text-center dark:text-white/35">Score</div>
            <div className="hidden sm:block flex-1 dark:text-white/35">Status</div>
          </div>
        </div>

        {/* Table Rows */}
        <div>
          {mockLeads.map((lead, index) => (
            <motion.div
              key={lead.address}
              className={`px-3 sm:px-6 py-3 sm:py-[18px] cursor-help transition-colors duration-200 relative ${
                activeIndex === index
                  ? 'bg-blue-50/60 dark:bg-white/[0.02]'
                  : 'hover:bg-gray-50/60 dark:hover:bg-white/[0.02]'
              }`}
              style={
                index < mockLeads.length - 1
                  ? isDarkMode
                    ? {
                        borderBottom: '1px solid rgba(0,0,0,0.4)',
                        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)',
                      }
                    : { borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }
                  : undefined
              }
              onMouseEnter={() => handleLeadHover(index)}
              onMouseLeave={handleLeadLeave}
            >
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Property Address */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.06] flex items-center justify-center shrink-0">
                    <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white/90 text-xs sm:text-sm truncate">
                      {lead.address}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-white/30">
                      {lead.city}
                    </div>
                  </div>
                </div>

                {/* Score Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl border font-mono font-bold text-base sm:text-lg ${
                        lead.score >= 70
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-500/[0.08] dark:border-emerald-500/40 dark:text-emerald-400'
                          : lead.score >= 50
                          ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-500/[0.08] dark:border-amber-500/40 dark:text-amber-400'
                          : 'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-500/[0.08] dark:border-orange-500/40 dark:text-orange-400'
                      }`}
                    >
                      {lead.score}
                    </div>
                    {activeIndex === index && (
                      <motion.div
                        className={`absolute inset-0 rounded-xl border ${
                          lead.score >= 70
                            ? 'border-emerald-500/60'
                            : lead.score >= 50
                            ? 'border-amber-500/60'
                            : 'border-orange-500/60'
                        }`}
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.3, opacity: 0 }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="hidden sm:block">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      lead.score >= 70
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/[0.06] dark:text-emerald-400 dark:border-emerald-500/25'
                        : lead.score >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/[0.06] dark:text-amber-400 dark:border-amber-500/25'
                        : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/[0.06] dark:text-orange-400 dark:border-orange-500/25'
                    }`}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {getScoreLabel(lead.score)}
                  </span>
                </div>
              </div>

              {/* Score Breakdown - Expandable Row */}
              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] font-semibold text-blue-600 dark:text-white/50 uppercase tracking-[0.12em]">
                          Distress Score Breakdown
                        </div>
                        <div className="text-xs text-gray-500 dark:text-white/30">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            Analyzed in 0.3s
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                        {lead.signals.map((signal, i) => (
                          <motion.div
                            key={signal.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.05 }}
                            className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] rounded-lg p-3 text-center"
                          >
                            <div className={`font-mono font-bold text-lg ${signal.color}`}>
                              +{signal.points}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-white/30 mt-1">
                              {signal.name}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Table Footer */}
        <div
          className="px-3 sm:px-6 py-3"
          style={isDarkMode ? {
            background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 100%)',
            borderTop: '1px solid rgba(0,0,0,0.5)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          } : {
            background: '#f9fafb',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <div className="text-xs text-gray-500 dark:text-white/30">
            <span className="font-bold text-gray-900 dark:text-white/80">Scored 50 leads</span> in 0.3 seconds
          </div>
        </div>
      </div>

      {/* Bottom Explanation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-4 text-center"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Unlike PropStream's raw data or REsimpli's manual tags,{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            FlipOps shows you WHY each lead is hot
          </span>
        </p>
      </motion.div>
    </div>
  );
}
