'use client';

import { motion } from 'framer-motion';
import {
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

const toolComparison = [
  {
    category: 'Data & Leads',
    current: { name: 'PropStream', cost: 99, pain: 'Export to spreadsheet, re-import elsewhere' },
    flipops: 'Unified lead intake & scoring',
  },
  {
    category: 'Skip Tracing',
    current: { name: 'BatchLeads', cost: 99, pain: 'Another login, another dashboard' },
    flipops: 'Built-in skip tracing',
  },
  {
    category: 'CRM',
    current: { name: 'REsimpli', cost: 99, pain: "Doesn't know your rehab budget" },
    flipops: 'Deal-aware CRM with ROI tracking',
  },
  {
    category: 'Contracts',
    current: { name: 'PandaDoc', cost: 30, pain: 'Manual data entry from CRM' },
    flipops: 'Contract management, auto-populated',
  },
  {
    category: 'Project Tracking',
    current: { name: 'smrtPhone', cost: 75, pain: 'Separate from your deal data' },
    flipops: 'Renovation tracking with budget alerts',
  },
  {
    category: 'Rental Portfolio',
    current: { name: 'Spreadsheet', cost: 0, pain: 'Breaks when you scale' },
    flipops: 'Portfolio dashboard with lease tracking',
  },
];

export function ToolConsolidation() {
  const totalMonthlyCost = toolComparison.reduce((sum, row) => sum + row.current.cost, 0);
  const totalLogins = toolComparison.length;
  const annualSavings = totalMonthlyCost * 12;

  return (
    <section className="py-16 lg:py-24 bg-gray-50 dark:bg-zinc-900/50 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
            <AlertTriangle className="h-4 w-4" />
            The Hidden Cost of Fragmentation
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            The All-in-One They Promised.<br className="hidden sm:block" /> Actually Built.
          </h2>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden shadow-lg">
            {/* Table Header */}
            <div className="grid grid-cols-2 border-b border-gray-200 dark:border-zinc-700">
              <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/30 border-r border-gray-200 dark:border-zinc-700">
                <h3 className="font-bold text-gray-900 dark:text-white">Your Current Stack</h3>
                <p className="text-sm text-rose-600 dark:text-rose-400">{totalLogins} logins, nothing connected</p>
              </div>
              <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950/30">
                <h3 className="font-bold text-gray-900 dark:text-white">With FlipOps</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">One platform, everything connected</p>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-gray-200 dark:divide-zinc-700">
              {toolComparison.map((row, i) => (
                <motion.div
                  key={row.category}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className="grid grid-cols-2"
                >
                  {/* Current Tool */}
                  <div className="px-6 py-4 border-r border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <X className="h-4 w-4 text-rose-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 dark:text-white text-sm">{row.current.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">{row.current.pain}</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${row.current.cost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                        {row.current.cost > 0 ? `$${row.current.cost}/mo` : 'Free*'}
                      </span>
                    </div>
                  </div>

                  {/* FlipOps */}
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{row.flipops}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 border-t-2 border-gray-300 dark:border-zinc-600">
              <div className="px-6 py-5 border-r border-gray-200 dark:border-zinc-700 bg-rose-50 dark:bg-rose-950/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      ${totalMonthlyCost}+<span className="text-sm font-normal">/mo</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{totalLogins} separate logins</div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">FlipOps</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      All-in-one
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Everything connected</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings Callout */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-t border-gray-200 dark:border-zinc-700">
              <div className="flex items-center justify-center gap-3">
                <span className="text-gray-600 dark:text-gray-400">Annual savings potential:</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">${annualSavings.toLocaleString()}+</span>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400"
          >
            *Free tools cost you time and sanity. And that&apos;s before counting Salesforce, Mailchimp, QuickBooks, REIsift...
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
