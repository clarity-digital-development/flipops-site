'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { InteractiveScoreDemo } from './interactive-score-demo';
import { SectionPill } from './section-pill';
import { Zap, Database, Activity, Cpu } from 'lucide-react';

const microProofs = [
  { value: '157M+', label: 'properties analyzed', icon: Database },
  { value: '15+', label: 'distress signals', icon: Activity },
  { value: 'Real-time', label: 'scoring', icon: Cpu },
];

export function HeroV2() {
  return (
    <section className="relative pt-24 pb-0 lg:pt-32 lg:pb-0 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
      {/* Bottom gradient fade into next section */}
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
            {/* Eyebrow */}
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
                Real Estate Investment Operating System
              </SectionPill>
            </motion.div>

            {/* Headline */}
            <h1 className="relative z-10 text-5xl lg:text-7xl font-bold mb-6">
              <span className="text-gray-900 dark:text-white glow-heading-teal">Find Distressed Properties</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Before Anyone Else.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="relative z-10 text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              FlipOps scores every property in America for distress signals, auto-contacts motivated sellers, and manages your deal from first touch to final disposition.{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                One platform. Every deal.
              </span>
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <Link href="/demo">
                <Button size="lg" variant="outline" className="text-base">
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve">
                <Button size="lg" className="text-base bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25">
                  Reserve Your Spot
                </Button>
              </Link>
            </motion.div>

            {/* Micro-proof badges (absorbed from KPI stats section) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap gap-6"
            >
              {microProofs.map((proof, index) => {
                const Icon = proof.icon;
                return (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{proof.value}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{proof.label}</div>
                    </div>
                  </div>
                );
              })}
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
