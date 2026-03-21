'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { InteractiveScoreDemo } from './interactive-score-demo';
import { Search, GitBranch, Handshake } from 'lucide-react';
import { TrustBar } from './trust-bar';

const microProofs = [
  { value: 'Find', label: 'distressed properties', icon: Search },
  { value: 'Manage', label: 'your pipeline', icon: GitBranch },
  { value: 'Close', label: 'more deals', icon: Handshake },
];

export function HeroV2() {
  return (
    <section
      className="relative pt-16 pb-0 lg:pt-8 lg:pb-0 overflow-x-clip bg-[#f4f4f6] dark:bg-black flex flex-col hero-mobile-vh"
    >
      {/* Bottom gradient fade into next section */}
      <div className="hidden dark:block absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent via-black/50 to-black z-10 pointer-events-none" />
      <div className="dark:hidden absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-white z-10 pointer-events-none" />

      {/* Hero content — flex-1 pushes trust bar to bottom */}
      <div className="container mx-auto px-6 lg:px-4 pb-8 flex-1 flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-start">
          {/* Left Column: Messaging */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Headline */}
            <h1 className="relative z-10 font-bold mb-4 text-center lg:text-left hero-headline">
              <span className="text-gray-900 dark:text-white glow-heading-teal">Your Unfair Advantage</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                in Real Estate Investing.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="relative z-10 text-gray-600 dark:text-gray-300 mb-8 lg:mb-10 leading-relaxed text-center lg:text-left mx-auto lg:mx-0 max-w-xs lg:max-w-none hero-subheadline">
              Other tools stop at acquisition.
              <br className="lg:hidden" />
              {' '}We take you to close.
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-row justify-center lg:justify-start gap-3 lg:gap-4 mb-10"
            >
              <Link href="/demo">
                <Button variant="outline" className="text-lg px-8 h-14">
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve">
                <Button className="text-lg px-8 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25">
                  Reserve Your Spot
                </Button>
              </Link>
            </motion.div>

            {/* Micro-proof badges (desktop only) */}
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

          {/* Right Column: Interactive Score Demo (hidden on mobile) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.08 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <InteractiveScoreDemo />
          </motion.div>
        </div>
      </div>

      {/* Trust bar pinned to bottom of hero viewport on mobile */}
      <div className="relative z-10 mt-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <TrustBar />
      </div>
    </section>
  );
}
