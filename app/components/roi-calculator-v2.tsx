'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Calculator, Home, Clock, DollarSign, ChevronDown, Settings2 } from 'lucide-react';
import Link from 'next/link';

export function ROICalculatorV2() {
  const [dealsPerMonth, setDealsPerMonth] = useState(8);
  const [hoursPerDeal, setHoursPerDeal] = useState(4);
  const [hourlyRate, setHourlyRate] = useState(100);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [profitMargin, setProfitMargin] = useState(18);
  const [riskLevel, setRiskLevel] = useState(5);

  // Calculations
  const monthlyHoursSaved = dealsPerMonth * hoursPerDeal * 0.75;
  const annualTimeSavings = monthlyHoursSaved * 12 * hourlyRate;

  const avgDealValue = 100000;
  const avgProfit = avgDealValue * (profitMargin / 100);
  const riskMultiplier = riskLevel / 10;

  const profitProtected = riskMultiplier * 3 * avgProfit * 0.15;
  const disastersSaved = riskMultiplier * 3 * 22500;
  const dealsCaught = riskMultiplier * 6;
  const potentialProfit = dealsCaught * avgProfit;

  const totalMin = annualTimeSavings + (profitProtected * 0.8) + (potentialProfit * 0.8) + (disastersSaved * 0.67);
  const totalMax = annualTimeSavings + (profitProtected * 1.2) + (potentialProfit * 1.2) + (disastersSaved * 1.33);

  const flipOpsProAnnual = 2988;
  const roiMin = Math.round(totalMin / flipOpsProAnnual);
  const roiMax = Math.round(totalMax / flipOpsProAnnual);

  const categories = [
    { name: 'Time', value: annualTimeSavings, color: 'bg-blue-500' },
    { name: 'Protection', value: profitProtected + disastersSaved, color: 'bg-emerald-500' },
    { name: 'Deals', value: potentialProfit, color: 'bg-purple-500' },
  ];

  const totalValue = categories.reduce((sum, cat) => sum + cat.value, 0);

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${Math.round(value / 1000)}K`;
    }
    return `$${Math.round(value)}`;
  };

  const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section id="roi-calculator" className="py-16 lg:py-24 bg-gradient-to-br from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-800">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium mb-4 shadow-lg shadow-blue-500/25">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Calculate Your Real Savings
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
            Answer three quick questions to see your potential annual savings
          </p>
        </motion.div>

        {/* Calculator Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <Card className="border-2 border-gray-200 dark:border-zinc-700 overflow-hidden">
            {/* Questions Section */}
            <div className="p-6 lg:p-8 bg-white dark:bg-zinc-900 space-y-8">
              {/* Question 1: Deals */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Home className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      How many deals do you work per month?
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Include leads you analyze, even if you don't pursue them
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[dealsPerMonth]}
                    onValueChange={(value) => setDealsPerMonth(value[0])}
                    min={1}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <div className="w-16 text-right text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {dealsPerMonth}
                  </div>
                </div>
              </div>

              {/* Question 2: Hours */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      How many hours do you spend analyzing each deal?
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Comps, ARV, rehab estimates, underwriting, etc.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[hoursPerDeal]}
                    onValueChange={(value) => setHoursPerDeal(value[0])}
                    min={1}
                    max={10}
                    step={0.5}
                    className="flex-1"
                  />
                  <div className="w-16 text-right text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {hoursPerDeal}h
                  </div>
                </div>
              </div>

              {/* Question 3: Rate */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      What's your time worth per hour?
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      What could you earn doing higher-value work?
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[hourlyRate]}
                    onValueChange={(value) => setHourlyRate(value[0])}
                    min={25}
                    max={250}
                    step={5}
                    className="flex-1"
                  />
                  <div className="w-16 text-right text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    ${hourlyRate}
                  </div>
                </div>
              </div>

              {/* Advanced Toggle */}
              <div className="pt-2">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <Settings2 className="h-4 w-4" />
                  Fine-tune your estimate
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-6 space-y-6">
                        {/* Profit Margin */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Average profit margin per deal
                            </div>
                            <Slider
                              value={[profitMargin]}
                              onValueChange={(value) => setProfitMargin(value[0])}
                              min={5}
                              max={40}
                              step={1}
                            />
                          </div>
                          <div className="w-16 text-right text-lg font-semibold text-gray-700 dark:text-gray-300">
                            {profitMargin}%
                          </div>
                        </div>

                        {/* Risk Level */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              How often do deals go sideways?
                            </div>
                            <Slider
                              value={[riskLevel]}
                              onValueChange={(value) => setRiskLevel(value[0])}
                              min={0}
                              max={10}
                              step={1}
                            />
                          </div>
                          <div className="w-20 text-right text-lg font-semibold text-gray-700 dark:text-gray-300">
                            {riskLevel <= 2 ? 'Rarely' : riskLevel <= 5 ? 'Sometimes' : riskLevel <= 8 ? 'Often' : 'Always'}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Hero Result */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 lg:p-10 text-white text-center">
              <div className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-1">
                Your potential annual savings
              </div>
              <motion.div
                key={`${totalMin}-${totalMax}`}
                initial={{ scale: 0.95, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3"
              >
                {formatFullCurrency(Math.round(totalMin))} – {formatFullCurrency(Math.round(totalMax))}
              </motion.div>
              <div className="text-lg text-blue-100">
                That's a <span className="font-bold text-white">{roiMin}x – {roiMax}x return</span> on FlipOps Pro
              </div>
            </div>

            {/* Compact Breakdown + CTAs */}
            <div className="p-6 bg-gray-100 dark:bg-zinc-800">
              {/* Stacked Bar */}
              <div className="h-2 rounded-full overflow-hidden flex mb-3">
                {categories.map((cat) => {
                  const percentage = totalValue > 0 ? (cat.value / totalValue) * 100 : 33;
                  return (
                    <motion.div
                      key={cat.name}
                      className={cat.color}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  );
                })}
              </div>

              {/* Inline Legend */}
              <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-6">
                {categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                    <span>{cat.name} {formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25">
                  Try Live Demo
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Reserve Your Spot
                </Button>
              </div>
            </div>
          </Card>

          {/* Bottom Note */}
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-500">
            FlipOps Pro is ${Math.round(flipOpsProAnnual / 12)}/month. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
