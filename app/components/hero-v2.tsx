'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { InteractiveScoreDemo } from './interactive-score-demo';
import { SectionPill } from './section-pill';
import { TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react';

const differentiators = [
  {
    icon: TrendingUp,
    text: 'Algorithmic distress scoring',
    subtext: 'not manual tags',
  },
  {
    icon: BarChart3,
    text: 'Real-time MAO calculation',
    subtext: 'not static calculators',
  },
  {
    icon: Shield,
    text: 'Automated guardrails',
    subtext: 'not task lists',
  },
];

export function HeroV2() {
  const openDemo = () => {
    // Navigate to demo account or open demo video
    window.location.href = '/sign-in?demo=true';
  };

  return (
    <section className="relative pt-24 pb-0 lg:pt-32 lg:pb-0 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
      {/* Bottom gradient fade into KPI section */}
      <div className="hidden dark:block absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-black/50 to-black z-10 pointer-events-none" />
      <div className="dark:hidden absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white z-10 pointer-events-none" />

      <div className="container mx-auto px-4 pb-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Messaging */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Category Tag */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <SectionPill
                pillClassName="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
                glowColor="45, 212, 191"
                staggerIndex={0}
              >
                <Zap className="h-4 w-4" />
                Decision Intelligence Platform for Real Estate
              </SectionPill>
            </motion.div>

            {/* Headline */}
            <h1 className="relative z-10 text-5xl lg:text-7xl font-bold mb-6">
              <span className="text-gray-900 dark:text-white glow-heading-teal">Stop Guessing.</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Start Knowing.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="relative z-10 text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              FlipOps uses{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                algorithmic intelligence
              </span>{' '}
              to score every lead, protect every budget, and prevent every costly delay.
            </p>

            {/* Differentiators */}
            <ul className="space-y-4 mb-8">
              {differentiators.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/20">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {item.text}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400"> ({item.subtext})</span>
                    </div>
                  </motion.li>
                );
              })}
            </ul>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button size="lg" onClick={openDemo} className="text-base bg-gradient-to-r from-primary to-accent hover:brightness-110 shadow-lg shadow-primary/25">
                Explore Live Demo
              </Button>
              <Link href="/reserve">
                <Button size="lg" variant="outline" className="text-base">
                  Reserve Your Spot
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column: Interactive Score Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative"
          >
            <InteractiveScoreDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
