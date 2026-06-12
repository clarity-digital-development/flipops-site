'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain,
  KanbanSquare,
  Calculator,
  Wrench,
  Home,
  ArrowRight,
  Play,
  Mail,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Demo walkthrough items                                             */
/* ------------------------------------------------------------------ */

const demoItems = [
  {
    icon: Brain,
    title: 'AI distress scoring in action',
    description:
      'Watch leads get scored in real time across 15+ distress signals. See how the algorithm adapts to your investing strategy.',
    color: 'teal',
  },
  {
    icon: KanbanSquare,
    title: 'Deal pipeline walkthrough',
    description:
      'Follow a lead from first contact to closing table. Automated outreach, status tracking, and nothing falls through the cracks.',
    color: 'blue',
  },
  {
    icon: Calculator,
    title: 'MAO calculator demo',
    description:
      'Transparent underwriting with a full waterfall breakdown. Adjustable assumptions, instant recalculation.',
    color: 'emerald',
  },
  {
    icon: Wrench,
    title: 'Renovation tracking',
    description:
      'Budget gauges, vendor management, change order approvals, and automated guardrails that protect your margins.',
    color: 'amber',
  },
  {
    icon: Home,
    title: 'Property management',
    description:
      'Tenant tracking, lease management, rental income, and maintenance workflows — all inside the same platform.',
    color: 'purple',
  },
];

const iconBgDark: Record<string, string> = {
  teal: 'bg-teal-500/15',
  blue: 'bg-blue-500/15',
  emerald: 'bg-emerald-500/15',
  amber: 'bg-amber-500/15',
  purple: 'bg-purple-500/15',
};

const iconBgLight: Record<string, string> = {
  teal: 'bg-teal-50',
  blue: 'bg-blue-50',
  emerald: 'bg-emerald-50',
  amber: 'bg-amber-50',
  purple: 'bg-purple-50',
};

const iconTextDark: Record<string, string> = {
  teal: 'text-teal-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
};

const iconTextLight: Record<string, string> = {
  teal: 'text-teal-600',
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function DemoPage() {
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
              <span className="text-gray-900 dark:text-white">Demo</span>
            </nav>

            <div className="flex justify-center mb-6">
              <SectionPill
                pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
                glowColor="59, 130, 246"
                staggerIndex={0}
              >
                See It In Action
              </SectionPill>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 max-w-4xl mx-auto text-center glow-heading-blue">
              See How FlipOps Works
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center">
              Walk through the full platform — from lead scoring to property
              management. Built on self-scraped Florida public records.
            </p>
          </div>
        </section>

        {/* Two-column: What You'll See + Demo Access */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: What You'll See */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                  What You&apos;ll See
                </h2>
                <div className="space-y-4">
                  {demoItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-xl p-5 flex items-start gap-4"
                        style={cardStyle}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            isDarkMode
                              ? iconBgDark[item.color]
                              : iconBgLight[item.color]
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${
                              isDarkMode
                                ? iconTextDark[item.color]
                                : iconTextLight[item.color]
                            }`}
                          />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Demo access */}
              <div className="flex flex-col gap-6">
                {/* Self-guided demo card */}
                <div className="rounded-2xl p-8" style={cardStyle}>
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                      isDarkMode ? 'bg-blue-500/15' : 'bg-blue-50'
                    }`}
                  >
                    <Play
                      className={`w-7 h-7 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Self-Guided Demo
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Explore the full platform at your own pace. Click through
                    real workflows with sample data — no signup required.
                  </p>
                  <Link href="/app">
                    <Button
                      size="lg"
                      className="w-full text-base bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
                    >
                      Launch Self-Guided Demo
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>

                {/* Live walkthrough card */}
                <div className="rounded-2xl p-8" style={cardStyle}>
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                      isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'
                    }`}
                  >
                    <Clock
                      className={`w-7 h-7 ${
                        isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                      }`}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Schedule a Live Walkthrough
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Prefer a personal tour? We&apos;ll walk you through the
                    platform, answer questions, and show you how FlipOps fits
                    your investing strategy.
                  </p>
                  <a href="mailto:demo@flipops.io">
                    <Button variant="outline" size="lg" className="w-full text-base">
                      <Mail className="w-4 h-4 mr-2" />
                      Schedule Walkthrough
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials placeholder */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              What Investors Are Saying
            </h2>
            <div className="rounded-2xl p-10 mt-8" style={cardStyle}>
              <p className="text-gray-500 dark:text-gray-400 text-lg italic">
                Coming soon — we&apos;re onboarding our first cohort of
                investors.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Lock in early-access pricing and be first in line when we launch.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/reserve">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 text-base min-w-[200px]"
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
