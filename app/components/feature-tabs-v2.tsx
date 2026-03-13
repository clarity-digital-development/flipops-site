'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  TrendingUp,
  Calculator,
  Kanban,
  PieChart,
  X,
  Check,
  Home,
  AlertTriangle,
  Clock,
  DollarSign,
  Layers,
  Search,
  FileSignature,
  Hammer,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { SectionPill } from './section-pill';

const tabs = [
  {
    id: 'find',
    number: '01',
    label: 'Find',
    icon: Search,
  },
  {
    id: 'analyze',
    number: '02',
    label: 'Analyze',
    icon: Calculator,
  },
  {
    id: 'close',
    number: '03',
    label: 'Close',
    icon: FileSignature,
  },
  {
    id: 'manage',
    number: '04',
    label: 'Manage',
    icon: Hammer,
  },
];

// Lead Scoring Demo Data
const mockLeads = [
  {
    address: '1547 Maple Ave',
    score: 75,
    status: 'Hot',
    signals: [
      { signal: 'Pre-Foreclosure', points: 25, color: 'text-rose-600' },
      { signal: 'Vacant Property', points: 15, color: 'text-orange-600' },
      { signal: 'Tax Delinquent', points: 15, color: 'text-amber-600' },
      { signal: 'High Equity', points: 10, color: 'text-emerald-600' },
      { signal: 'Aged Listing', points: 10, color: 'text-blue-600' },
    ],
  },
  {
    address: '892 Pine Street',
    score: 52,
    status: 'Warm',
    signals: [
      { signal: 'Pre-Foreclosure', points: 25, color: 'text-rose-600' },
      { signal: 'High Equity', points: 10, color: 'text-emerald-600' },
      { signal: 'Aged Listing', points: 10, color: 'text-blue-600' },
      { signal: 'Code Violations', points: 7, color: 'text-orange-600' },
    ],
  },
  {
    address: '2210 Oak Blvd',
    score: 38,
    status: 'Cold',
    signals: [
      { signal: 'Vacant Property', points: 15, color: 'text-orange-600' },
      { signal: 'Tax Delinquent', points: 15, color: 'text-amber-600' },
      { signal: 'Aged Listing', points: 8, color: 'text-blue-600' },
    ],
  },
];

// MAO Calculator Demo
function MAOCalculatorDemo({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const [profitMargin, setProfitMargin] = useState(15);
  const [holdingMonths, setHoldingMonths] = useState(6);
  const [repairsBuffer, setRepairsBuffer] = useState(10);

  const arv = 425000;
  const baseRepairs = 65000;
  const repairs = baseRepairs * (1 + repairsBuffer / 100);
  const realtorComm = arv * 0.06;
  const buyerClosing = arv * 0.02;
  const sellerClosing = arv * 0.03;
  const holdingCosts = holdingMonths * 3000;
  const profitTarget = arv * (profitMargin / 100);
  const mao = arv - repairs - realtorComm - buyerClosing - sellerClosing - holdingCosts - profitTarget;

  const isRisky = profitMargin < 12 || holdingMonths > 8;

  return (
    <div
      className={`rounded-xl p-4 space-y-3 ${isDarkMode ? '' : 'bg-white border border-gray-200'}`}
      style={isDarkMode ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255, 255, 255, 0.06)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
          '0 2px 8px rgba(0, 0, 0, 0.25)',
          '0 8px 20px rgba(0, 0, 0, 0.2)',
        ].join(', '),
      } : {}}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600 dark:text-white/50">MAO Waterfall</span>
        {isRisky && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-sm">
            <AlertTriangle className="h-3 w-3" />
            Risk Alert
          </span>
        )}
      </div>

      {/* Waterfall */}
      <div className="space-y-1 text-sm font-mono">
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
          <span>ARV</span>
          <span>${arv.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>- Repairs ({repairsBuffer}% buffer)</span>
          <span>-${Math.round(repairs).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>- Realtor (6%)</span>
          <span>-${Math.round(realtorComm).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>- Closing Costs</span>
          <span>-${Math.round(buyerClosing + sellerClosing).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>- Holding ({holdingMonths}mo)</span>
          <span>-${holdingCosts.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>- Profit Target ({profitMargin}%)</span>
          <span>-${Math.round(profitTarget).toLocaleString()}</span>
        </div>
        <div
          className={isDarkMode ? 'pt-1 mt-2' : 'border-t border-gray-200 pt-1 mt-2'}
          style={isDarkMode ? {
            borderTop: '1px solid rgba(0,0,0,0.4)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          } : {}}
        >
          <div className="flex justify-between font-bold text-blue-600 dark:text-blue-400">
            <span>MAX OFFER</span>
            <motion.span
              key={mao}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              ${Math.round(mao).toLocaleString()}
            </motion.span>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div
        className={`pt-2 space-y-3 ${isDarkMode ? '' : 'border-t border-gray-200'}`}
        style={isDarkMode ? {
          borderTop: '1px solid rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        } : {}}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-white/30 w-24">Profit: {profitMargin}%</span>
          <Slider
            value={[profitMargin]}
            onValueChange={(v) => setProfitMargin(v[0])}
            min={10}
            max={25}
            step={1}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-white/30 w-24">Hold: {holdingMonths}mo</span>
          <Slider
            value={[holdingMonths]}
            onValueChange={(v) => setHoldingMonths(v[0])}
            min={3}
            max={12}
            step={1}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}

// Urgency Kanban Demo
function UrgencyKanbanDemo({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const cards = [
    {
      address: '1547 Maple Ave',
      urgency: 'urgent',
      label: '3 days to close',
      burn: 127.5,
      budget: '-3%',
      budgetStatus: 'under',
    },
    {
      address: '892 Pine St',
      urgency: 'soon',
      label: 'Appraisal due in 5 days',
      burn: 95.0,
      budget: '+2%',
      budgetStatus: 'over',
    },
  ];

  return (
    <div
      className={`rounded-xl p-4 space-y-3 ${isDarkMode ? '' : 'bg-white border border-gray-200'}`}
      style={isDarkMode ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255, 255, 255, 0.06)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
          '0 2px 8px rgba(0, 0, 0, 0.25)',
          '0 8px 20px rgba(0, 0, 0, 0.2)',
        ].join(', '),
      } : {}}
    >
      <div className="text-sm font-semibold text-gray-600 dark:text-white/50">Active Contracts</div>
      <div className="space-y-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.address}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={isDarkMode ? 'rounded-lg p-3' : 'bg-gray-50 rounded-lg p-3'}
            style={isDarkMode ? {
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
              boxShadow: [
                '0 0 0 1px rgba(255, 255, 255, 0.04)',
                'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                'inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
                '0 1px 3px rgba(0, 0, 0, 0.15)',
              ].join(', '),
            } : {}}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-400 dark:text-teal-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white/90">{card.address}</span>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  card.urgency === 'urgent'
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                }`}
              >
                {card.urgency === 'urgent' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                )}
                {card.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-white/30">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${card.burn}/day burn
              </span>
              <span
                className={`flex items-center gap-1 ${
                  card.budgetStatus === 'under' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                Budget: {card.budget}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ROI Gauge Demo
function ROIGaugeDemo({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const [scenario, setScenario] = useState<'base' | 'overrun'>('base');

  const base = { purchase: 280000, repairs: 65000, holding: 18000, arv: 525000, roi: 28 };
  const overrun = { purchase: 280000, repairs: 78000, holding: 21000, arv: 525000, roi: 19 };
  const data = scenario === 'base' ? base : overrun;

  const totalInvest = data.purchase + data.repairs + data.holding;
  const commissions = data.arv * 0.06;
  const closing = data.arv * 0.04;
  const netProfit = data.arv - commissions - closing - totalInvest;

  const roiColor = data.roi >= 20 ? 'text-emerald-500' : data.roi >= 15 ? 'text-amber-500' : 'text-rose-500';
  const roiBarColor = data.roi >= 20 ? 'bg-emerald-500' : data.roi >= 15 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div
      className={`rounded-xl p-4 space-y-3 ${isDarkMode ? '' : 'bg-white border border-gray-200'}`}
      style={isDarkMode ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255, 255, 255, 0.06)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
          '0 2px 8px rgba(0, 0, 0, 0.25)',
          '0 8px 20px rgba(0, 0, 0, 0.2)',
        ].join(', '),
      } : {}}
    >
      {/* Scenario Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScenario('base')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            scenario === 'base'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
              : isDarkMode
              ? 'text-white/40'
              : 'bg-gray-200 text-gray-600'
          }`}
          style={scenario !== 'base' && isDarkMode ? {
            background: 'rgba(255,255,255,0.04)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          } : {}}
        >
          Base Case
        </button>
        <button
          onClick={() => setScenario('overrun')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            scenario === 'overrun'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
              : isDarkMode
              ? 'text-white/40'
              : 'bg-gray-200 text-gray-600'
          }`}
          style={scenario !== 'overrun' && isDarkMode ? {
            background: 'rgba(255,255,255,0.04)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
          } : {}}
        >
          Repairs +20%
        </button>
      </div>

      {/* ROI Gauge */}
      <div className="text-center py-2">
        <motion.div
          key={data.roi}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className={`text-4xl font-bold ${roiColor}`}
        >
          {data.roi}%
        </motion.div>
        <div className="text-xs text-gray-500 dark:text-white/30">ROI</div>
        <div
          className="mt-2 h-2 rounded-full overflow-hidden"
          style={isDarkMode ? {
            background: 'rgba(255,255,255,0.04)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
          } : { background: '#e5e7eb' }}
        >
          <motion.div
            className={roiBarColor}
            initial={{ width: 0 }}
            animate={{ width: `${(data.roi / 40) * 100}%` }}
            transition={{ duration: 0.5 }}
            style={{ height: '100%' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-white/20 mt-1">
          <span>0%</span>
          <span>40%</span>
        </div>
      </div>

      {/* Profit Summary */}
      <div
        className={`text-sm space-y-1 pt-3 ${isDarkMode ? '' : 'border-t border-gray-200'}`}
        style={isDarkMode ? {
          borderTop: '1px solid rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        } : {}}
      >
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>Total Investment</span>
          <span>${totalInvest.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-white/40">
          <span>ARV</span>
          <span>${data.arv.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
          <span>Net Profit</span>
          <span>${Math.round(netProfit).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Lead Scoring Demo
function LeadScoringDemo({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(0);

  return (
    <div
      className={`rounded-xl overflow-hidden ${isDarkMode ? '' : 'bg-white border border-gray-200'}`}
      style={isDarkMode ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255, 255, 255, 0.06)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
          '0 2px 8px rgba(0, 0, 0, 0.25)',
          '0 8px 20px rgba(0, 0, 0, 0.2)',
        ].join(', '),
      } : {}}
    >
      {/* Header */}
      <div
        className={isDarkMode ? 'px-4 py-2' : 'bg-gray-50 px-4 py-2 border-b border-gray-200'}
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.2)',
        } : {}}
      >
        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-white/35 uppercase tracking-wider">
          <span>PROPERTY</span>
          <span>SCORE</span>
        </div>
      </div>

      {/* Rows */}
      <div>
        {mockLeads.map((lead, i) => (
          <div
            key={lead.address}
            className={`px-4 py-3 cursor-pointer transition-colors ${
              hoveredIndex === i ? 'bg-blue-100 dark:bg-white/[0.02]' : 'hover:bg-gray-100 dark:hover:bg-white/[0.02]'
            }`}
            style={i < mockLeads.length - 1 ? (isDarkMode ? {
              borderBottom: '1px solid rgba(0,0,0,0.4)',
              boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)',
            } : { borderBottom: '1px solid #f3f4f6' }) : undefined}
            onMouseEnter={() => setHoveredIndex(i)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-400 dark:text-teal-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white/90">{lead.address}</span>
              </div>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                  lead.score >= 70
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-700 dark:bg-emerald-500/[0.08] dark:border-emerald-500/40 dark:text-emerald-400'
                    : lead.score >= 50
                    ? 'bg-amber-100 border-amber-500 text-amber-700 dark:bg-amber-500/[0.08] dark:border-amber-500/40 dark:text-amber-400'
                    : 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-500/[0.08] dark:border-orange-500/40 dark:text-orange-400'
                }`}
              >
                {lead.score}
              </div>
            </div>

            {/* Score Breakdown */}
            <AnimatePresence>
              {hoveredIndex === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-white/[0.05]">
                    <div className="text-xs font-semibold text-blue-600 dark:text-white/50 mb-2 uppercase tracking-wider">
                      DISTRESS SCORE BREAKDOWN
                    </div>
                    <div className={`grid gap-1 ${lead.signals.length <= 3 ? 'grid-cols-3' : lead.signals.length === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
                      {lead.signals.map((item, j) => (
                        <motion.div
                          key={item.signal}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: j * 0.05 }}
                          className={isDarkMode ? 'rounded p-2 text-center' : 'bg-gray-50 rounded p-2 text-center'}
                          style={isDarkMode ? {
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          } : {}}
                        >
                          <div className={`font-bold text-sm ${item.color}`}>+{item.points}</div>
                          <div className="text-xs text-gray-500 dark:text-white/30 truncate">{item.signal}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className={isDarkMode ? 'px-4 py-2' : 'bg-gray-50 px-4 py-2 border-t border-gray-200'}
        style={isDarkMode ? {
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 100%)',
          borderTop: '1px solid rgba(0,0,0,0.5)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        } : {}}
      >
        <span className="text-xs text-gray-500 dark:text-white/30">
          <span className="font-semibold text-gray-900 dark:text-white/80">Scored 50 leads</span> in 0.3 seconds
        </span>
      </div>
    </div>
  );
}

// Competitor Comparison Component
interface ComparisonProps {
  others: string[];
  flipops: { title: string; description: string }[];
  ctaText: string;
}

function CompetitorComparison({ others, flipops, ctaText }: ComparisonProps) {
  return (
    <div className="space-y-6">
      {/* What Others Do */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </div>
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Other Platforms</span>
        </div>
        <ul className="space-y-2 pl-8">
          {others.map((item, i) => (
            <li key={i} className="text-sm text-gray-500 dark:text-gray-400">
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* What FlipOps Does */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <Check className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">FlipOps Intelligence</span>
        </div>
        <ul className="space-y-4 pl-8">
          {flipops.map((item, i) => (
            <li key={i}>
              <div className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/sign-in?demo=true">
        <Button variant="outline" className="mt-4">
          {ctaText}
        </Button>
      </Link>
    </div>
  );
}

export function FeatureTabsV2() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('find');

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Shared 3D styles for both modes
  const cardStyle = isDarkMode ? {
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
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
    border: 'none',
    boxShadow: [
      '0 0 0 1px rgba(0, 0, 0, 0.06)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
      '0 1px 2px rgba(0, 0, 0, 0.04)',
      '0 4px 12px rgba(0, 0, 0, 0.06)',
      '0 12px 32px rgba(0, 0, 0, 0.04)',
    ].join(', '),
  };

  return (
    <section id="features" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12 relative"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
            glowColor="59, 130, 246"
            staggerIndex={0}
          >
            <Layers className="h-4 w-4" />
            The Full Lifecycle
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-blue">
            One Platform. Every Stage.
          </h2>
          <p className="relative z-10 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            From distressed property discovery to deal close to property management — no tool gaps, no data silos.
          </p>
        </motion.div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
          <TabsList
            className="grid w-full grid-cols-4 mb-8"
            style={isDarkMode ? {
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 40%, rgba(255,255,255,0.01) 100%)',
              border: 'none',
              boxShadow: [
                '0 0 0 1px rgba(255, 255, 255, 0.06)',
                'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                '0 2px 4px rgba(0, 0, 0, 0.2)',
                '0 4px 12px rgba(0, 0, 0, 0.25)',
              ].join(', '),
            } : {
              background: '#ffffff',
              border: 'none',
              boxShadow: [
                '0 0 0 1px rgba(0, 0, 0, 0.06)',
                'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                '0 1px 2px rgba(0, 0, 0, 0.04)',
                '0 4px 12px rgba(0, 0, 0, 0.06)',
              ].join(', '),
            }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isTabActive = activeTab === tab.id;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2"
                  style={isTabActive && !isDarkMode ? {
                    border: '1.5px solid transparent',
                    background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, #3b82f6, #8b5cf6) border-box',
                    boxShadow: '0 1px 3px rgba(59, 130, 246, 0.15)',
                  } : undefined}
                >
                  <span className="text-xs font-mono text-gray-400 dark:text-white/30 sr-only sm:not-sr-only">{tab.number}</span>
                  <Icon className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab 1: Find */}
          <TabsContent value="find">
            <Card className="p-6 lg:p-8" style={cardStyle}>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Distress Scoring & Lead Discovery
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Score 157M+ properties across 15+ distress signals. Auto-trigger skip tracing at threshold scores.
                  </p>
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">0-100 Distress Score</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pre-foreclosure, liens, vacancy, tax delinquency — weighted and combined instantly</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Automated Skip Tracing</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Properties scoring 70+ auto-enrich with owner contact info — no manual steps</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Behavioral Learning</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Scores adapt to your investing style over time — your top leads are different from everyone else's</div>
                      </div>
                    </li>
                  </ul>
                  <Link href="/features/distress-scoring" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <LeadScoringDemo isDarkMode={isDarkMode} />
              </div>
            </Card>
          </TabsContent>

          {/* Tab 2: Analyze */}
          <TabsContent value="analyze">
            <Card className="p-6 lg:p-8" style={cardStyle}>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Underwriting & Deal Analysis
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    MAO calculator, comps analysis, and margin alerts — so you never overpay.
                  </p>
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Interactive MAO Waterfall</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Drag sliders to model profit margin, holding time, and repairs buffer in real time</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Comps & ARV Analysis</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Pull comparable sales, adjust for condition, and get a defensible after-repair value</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Risk Alerts</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">"15% profit margin is below safe threshold" — warnings before you make an offer</div>
                      </div>
                    </li>
                  </ul>
                  <Link href="/features/mao-calculator" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <MAOCalculatorDemo isDarkMode={isDarkMode} />
              </div>
            </Card>
          </TabsContent>

          {/* Tab 3: Close */}
          <TabsContent value="close">
            <Card className="p-6 lg:p-8" style={cardStyle}>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Deal Pipeline & Closing
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    From lead to offer to contract to close — with urgency tracking at every stage.
                  </p>
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Visual Deal Pipeline</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Leads, Offers, Contracts, Buyers — every deal tracked with status and timeline</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Urgency-Based Alerts</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Color-coded deadlines with daily burn rate calculations — know the cost of every delay</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Title & Closing Integration</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Qualia integration coming soon — manage title and closing without leaving FlipOps</div>
                      </div>
                    </li>
                  </ul>
                  <Link href="/features/deal-pipeline" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <UrgencyKanbanDemo isDarkMode={isDarkMode} />
              </div>
            </Card>
          </TabsContent>

          {/* Tab 4: Manage */}
          <TabsContent value="manage">
            <Card className="p-6 lg:p-8" style={cardStyle}>
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Rehab, Rental & Vendor Management
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    Post-close capability that no competitor offers alongside lead gen and CRM.
                  </p>
                  <ul className="space-y-4 mb-6">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Renovation Tracking</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Budget categories, vendor assignments, change orders — with alerts when costs exceed 10% variance</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Rental Management</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Tenants, leases, maintenance tickets, cash flow tracking — for BRRRR investors who hold</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Vendor Network</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Browse platform vendors or add your own. Track reliability, ratings, and assign to projects</div>
                      </div>
                    </li>
                  </ul>
                  <Link href="/features/property-management" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                    Learn more <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <ROIGaugeDemo isDarkMode={isDarkMode} />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
