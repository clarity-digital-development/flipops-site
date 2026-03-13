'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionPill } from './section-pill';
import { AlertTriangle, Check, X, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Slider } from '@/components/ui/slider';

const inputs = [
  { id: 'data', label: 'Property data tools', placeholder: 'PropStream, BatchLeads, etc.', defaultValue: 99 },
  { id: 'crm', label: 'CRM & pipeline tools', placeholder: 'REsimpli, FreedomSoft, etc.', defaultValue: 199 },
  { id: 'project', label: 'Project management', placeholder: 'Buildertrend, spreadsheets, etc.', defaultValue: 75 },
  { id: 'skip', label: 'Skip tracing', placeholder: 'BatchSkipTracing, etc.', defaultValue: 50 },
];

export function SavingsCalculator() {
  const [values, setValues] = useState<Record<string, number>>({
    data: 99,
    crm: 199,
    project: 75,
    skip: 50,
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const totalMonthly = Object.values(values).reduce((sum, v) => sum + v, 0);
  const flipOpsMonthly = 149;
  const monthlySavings = Math.max(0, totalMonthly - flipOpsMonthly);
  const annualSavings = monthlySavings * 12;

  const cardStyle = isDarkMode ? {
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
  };

  return (
    <section id="savings" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-rose-500 to-pink-500 shadow-lg shadow-rose-500/25"
            glowColor="244, 63, 94"
            staggerIndex={2}
          >
            <AlertTriangle className="h-4 w-4" />
            The Hidden Cost of Fragmentation
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-rose">
            Calculate Your Real Savings
          </h2>
          <p className="relative z-10 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            How much are you spending on disconnected tools each month?
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Inputs */}
            <div className="rounded-xl p-6 space-y-6" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <X className="h-5 w-5 text-rose-500" />
                <h3 className="font-bold text-gray-900 dark:text-white">Your Current Stack</h3>
              </div>

              {inputs.map((input) => (
                <div key={input.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {input.label}
                    </label>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      ${values[input.id]}/mo
                    </span>
                  </div>
                  <Slider
                    value={[values[input.id]]}
                    onValueChange={(v) => setValues({ ...values, [input.id]: v[0] })}
                    min={0}
                    max={300}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500">{input.placeholder}</p>
                </div>
              ))}

              <div
                className="pt-4 flex items-center justify-between"
                style={isDarkMode ? {
                  borderTop: '1px solid rgba(0,0,0,0.4)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                } : { borderTop: '1px solid #e5e7eb' }}
              >
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total monthly</span>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">${totalMonthly}/mo</span>
              </div>
            </div>

            {/* Right: Results */}
            <div className="rounded-xl overflow-hidden flex flex-col" style={cardStyle}>
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Check className="h-5 w-5" />
                  With FlipOps
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">You could save</div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={monthlySavings}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${monthlySavings.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">per month</div>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 w-full">
                  <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    That's <span className="text-2xl font-bold">${annualSavings.toLocaleString()}</span>/year back in your pocket
                  </div>
                </div>

                <div className="mt-6 space-y-2 text-left w-full">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    One platform — everything connected
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    Starting at $149/month
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    No per-tool contracts or usage caps
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
            Want a more detailed breakdown?{' '}
            <Link href="/tools/savings-calculator" className="text-primary hover:underline font-medium">
              Try the full calculator
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
