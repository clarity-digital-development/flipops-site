'use client';

import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { TrendingUp, DollarSign, Calendar, AlertTriangle, Shield, Bell, Calculator } from 'lucide-react';

const caseStudies = [
  {
    id: 'project-a',
    title: 'Downtown Flip',
    investor: 'Marcus Rodriguez',
    property: '1842 Main St, Jacksonville',
    stats: {
      budgetOverrun: { before: 23, after: 3 },
      interestBurn: { before: 850, after: 425 },
      daysOnMarket: { before: 47, after: 28 },
      roi: { before: 18, after: 31 }
    },
    guardrails: [
      { icon: AlertTriangle, label: 'Budget variance alert', description: 'Flagged electrical costs at 12% over before contractor finished' },
      { icon: Bell, label: 'Urgency badge', description: 'Inspection deadline warning 5 days out prevented $8K extension fee' },
      { icon: Calculator, label: 'MAO guardrail', description: 'Risk alert showed 13% margin - negotiated $12K lower purchase' },
    ],
    testimonial: 'The algorithmic alerts caught a $15k budget issue before it became a $40k disaster. I\'ve never had this level of visibility into my deals.',
    dollarsSaved: 40000,
  },
  {
    id: 'project-b',
    title: 'Suburban Rehab',
    investor: 'Sarah Chen',
    property: '892 Oak Ave, Tampa',
    stats: {
      budgetOverrun: { before: 18, after: 2 },
      interestBurn: { before: 720, after: 380 },
      daysOnMarket: { before: 52, after: 31 },
      roi: { before: 22, after: 34 }
    },
    guardrails: [
      { icon: Bell, label: 'Daily burn tracker', description: 'Showed $127/day cost of delays - accelerated permit process' },
      { icon: AlertTriangle, label: 'Milestone urgency', description: 'Red badge on appraisal deadline kept deal on schedule' },
      { icon: Calculator, label: 'ROI gauge', description: 'Real-time profit tracking showed where to cut costs' },
    ],
    testimonial: 'FlipOps doesn\'t just track tasks - it tells me exactly how much money I\'m losing every day I delay. That visibility changed how I run projects.',
    dollarsSaved: 28000,
  }
];

export function CaseStudies() {
  return (
    <section id="case-study" className="py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-4">
            <Shield className="h-4 w-4" />
            Guardrails in Action
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Real Results, Real Guardrails
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See which FlipOps alerts and guardrails protected these actual flips.
          </p>
        </motion.div>

        <Tabs defaultValue="project-a" className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2">
            {caseStudies.map((study) => (
              <TabsTrigger key={study.id} value={study.id}>
                {study.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {caseStudies.map((study) => (
            <TabsContent key={study.id} value={study.id}>
              {/* Property Info + Savings Highlight */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 mb-6 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">{study.property}</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{study.investor}</div>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    ${study.dollarsSaved.toLocaleString()} protected
                  </span>
                </div>
              </div>

              {/* Guardrails That Fired */}
              <Card className="p-6 mb-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4">
                  Guardrails That Fired
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {study.guardrails.map((guardrail, i) => {
                    const Icon = guardrail.icon;
                    return (
                      <motion.div
                        key={guardrail.label}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                        viewport={{ once: true }}
                        className="flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{guardrail.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{guardrail.description}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>

              {/* Before/After Stats Grid */}
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Budget Control
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Budget Overrun %</span>
                        <span className="text-sm font-medium">
                          <span className="text-rose-500">{study.stats.budgetOverrun.before}%</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-emerald-500">{study.stats.budgetOverrun.after}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-500 to-emerald-500"
                          initial={{ width: '0%' }}
                          whileInView={{ width: `${100 - study.stats.budgetOverrun.after * 2}%` }}
                          transition={{ duration: 1 }}
                          viewport={{ once: true }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Math.round((study.stats.budgetOverrun.before - study.stats.budgetOverrun.after) / study.stats.budgetOverrun.before * 100)}% reduction in budget surprises
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Holding Cost Reduction
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Daily Interest Burn</span>
                        <span className="text-sm font-medium">
                          <span className="text-rose-500">${study.stats.interestBurn.before}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-emerald-500">${study.stats.interestBurn.after}</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-500 to-emerald-500"
                          initial={{ width: '0%' }}
                          whileInView={{ width: `${100 - (study.stats.interestBurn.after / study.stats.interestBurn.before) * 100}%` }}
                          transition={{ duration: 1 }}
                          viewport={{ once: true }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Saved ${Math.round((study.stats.interestBurn.before - study.stats.interestBurn.after) * 30)}/month in carrying costs
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-accent" />
                    Time to Sale
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Days on Market</span>
                        <span className="text-sm font-medium">
                          <span className="text-rose-500">{study.stats.daysOnMarket.before}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-emerald-500">{study.stats.daysOnMarket.after} days</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-500 to-emerald-500"
                          initial={{ width: '0%' }}
                          whileInView={{ width: `${100 - (study.stats.daysOnMarket.after / study.stats.daysOnMarket.before) * 100}%` }}
                          transition={{ duration: 1 }}
                          viewport={{ once: true }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {study.stats.daysOnMarket.before - study.stats.daysOnMarket.after} fewer days of carrying costs
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    ROI Improvement
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Return on Investment</span>
                        <span className="text-sm font-medium">
                          <span className="text-amber-500">{study.stats.roi.before}%</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-emerald-500">{study.stats.roi.after}%</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                          initial={{ width: '0%' }}
                          whileInView={{ width: `${(study.stats.roi.after / 50) * 100}%` }}
                          transition={{ duration: 1 }}
                          viewport={{ once: true }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      +{study.stats.roi.after - study.stats.roi.before}% ROI improvement
                    </div>
                  </div>
                </Card>
              </div>

              {/* Testimonial */}
              <Card className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-0">
                <p className="text-lg italic text-center text-gray-700 dark:text-gray-300">
                  &ldquo;{study.testimonial}&rdquo;
                </p>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  — <span className="font-medium text-gray-900 dark:text-white">{study.investor}</span>
                </p>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}