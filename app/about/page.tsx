'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, Brain, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Differentiator cards                                               */
/* ------------------------------------------------------------------ */

const differentiators = [
  {
    icon: Layers,
    title: 'Full Lifecycle',
    description:
      'Not just pre-close or post-close. FlipOps bridges both sides of the investment lifecycle — from finding distressed properties to managing cash-flowing rentals.',
    color: 'emerald',
  },
  {
    icon: Brain,
    title: 'AI That Learns',
    description:
      'The scoring engine adapts to your strategy. Every deal you pursue, every lead you skip — your scores get smarter over time.',
    color: 'blue',
  },
  {
    icon: ShieldCheck,
    title: 'Built for Discipline',
    description:
      'Financial guardrails that protect your margins automatically. Budget alerts, deadline warnings, and margin protection before problems become losses.',
    color: 'amber',
  },
];

const iconBgDark: Record<string, string> = {
  emerald: 'bg-emerald-500/15',
  blue: 'bg-blue-500/15',
  amber: 'bg-amber-500/15',
};

const iconBgLight: Record<string, string> = {
  emerald: 'bg-emerald-50',
  blue: 'bg-blue-50',
  amber: 'bg-amber-50',
};

const iconTextDark: Record<string, string> = {
  emerald: 'text-emerald-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
};

const iconTextLight: Record<string, string> = {
  emerald: 'text-emerald-600',
  blue: 'text-blue-600',
  amber: 'text-amber-600',
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const check = () =>
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  const cardStyle: React.CSSProperties = isDarkMode
    ? {
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow:
          '0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
      };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* Hero */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">About</span>
            </nav>

            <div className="flex justify-center mb-6">
              <SectionPill
                pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
                glowColor="16, 185, 129"
                staggerIndex={0}
              >
                Our Story
              </SectionPill>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 max-w-4xl mx-auto text-center glow-heading-emerald">
              Built by an Investor, for Investors
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center">
              One platform to replace the patchwork of tools every real estate
              investor cobbles together.
            </p>
          </div>
        </section>

        {/* The Story */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="rounded-2xl p-8 lg:p-12" style={cardStyle}>
              <div className="space-y-6 text-base lg:text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                <p>
                  FlipOps was born from frustration. As an active real estate
                  investor, I was juggling 6+ disconnected tools — one for
                  leads, another for skip tracing, a CRM that didn&apos;t
                  understand real estate, spreadsheets for renovation budgets,
                  and yet another app for rental tracking.
                </p>
                <p>
                  The data never connected. Leads fell through the cracks. I
                  couldn&apos;t see my true margins until closing day. And every
                  new tool meant another monthly subscription and another login.
                </p>
                <p className="text-gray-900 dark:text-white font-medium">
                  So I built the platform I wished existed: one system that
                  handles the entire investment lifecycle — from finding
                  distressed properties to managing cash-flowing rentals.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What Makes FlipOps Different */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
                What Makes FlipOps Different
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Not another point solution. A complete operating system for real
                estate investors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {differentiators.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl p-6"
                    style={cardStyle}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                        isDarkMode
                          ? iconBgDark[item.color]
                          : iconBgLight[item.color]
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isDarkMode
                            ? iconTextDark[item.color]
                            : iconTextLight[item.color]
                        }`}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* The Vision */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
              The Vision
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
              We&apos;re building the Real Estate Investment Operating System —
              the single platform that replaces the patchwork of tools investors
              cobble together today. One login. One bill. One source of truth
              for every deal, every dollar, every decision.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Join Us
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Be part of the first wave of investors replacing their tool stack
              with one intelligent platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/demo">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base min-w-[160px]"
                >
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 text-base min-w-[160px]"
                >
                  Reserve Your Spot
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
