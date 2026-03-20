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
    <section className="relative lg:min-h-0 pt-20 pb-0 lg:pt-32 lg:pb-0 overflow-x-clip bg-[#f4f4f6] dark:bg-black flex flex-col" style={{ minHeight: 'calc(100svh - 4rem)' }}>
      {/* Bottom gradient fade into next section */}
      <div className="hidden dark:block absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-black/50 to-black z-10 pointer-events-none" />
      <div className="dark:hidden absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white z-10 pointer-events-none" />

      <div className="container mx-auto px-4 pb-8 lg:pb-32 flex-1 flex flex-col justify-center lg:block">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
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
              className="mb-6 sm:mb-6 flex justify-center lg:justify-start"
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
            <h1 className="relative z-10 text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 text-center lg:text-left" style={{ lineHeight: 1.1 }}>
              <span className="text-gray-900 dark:text-white glow-heading-teal">Your Unfair Advantage</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                in Real Estate Investing.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="relative z-10 text-xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed text-center lg:text-left">
              Other tools stop at acquisition. We take you to close.
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-row justify-center lg:justify-start gap-4 mb-10"
            >
              <Link href="/demo">
                <Button variant="outline" className="text-lg px-8 h-14 lg:text-base lg:px-4 lg:h-10">
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve">
                <Button className="text-lg px-8 h-14 lg:text-base lg:px-4 lg:h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25">
                  Reserve Your Spot
                </Button>
              </Link>
            </motion.div>

            {/* Micro-proof badges (absorbed from KPI stats section) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="hidden lg:flex flex-wrap gap-6 justify-center lg:justify-start"
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

          {/* Right Column: Interactive Score Demo (hidden on mobile — shown in feature tabs) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <InteractiveScoreDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
