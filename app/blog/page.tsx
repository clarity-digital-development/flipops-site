'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Blog post placeholder data                                         */
/* ------------------------------------------------------------------ */

interface BlogPost {
  title: string;
  teaser: string;
  category: string;
  date: string;
}

const featuredPost: BlogPost = {
  title: 'How AI Distress Scoring Is Changing Real Estate Investing',
  teaser:
    'Traditional lead lists are static. AI-powered scoring is dynamic, personalized, and gets smarter with every deal you work.',
  category: 'Technology',
  date: 'March 2026',
};

const posts: BlogPost[] = [
  {
    title: 'The True Cost of Tool Sprawl for Real Estate Investors',
    teaser:
      'Six subscriptions. Six logins. Zero integration. Here\'s what fragmentation actually costs your business.',
    category: 'Strategy',
    date: 'March 2026',
  },
  {
    title: 'MAO Calculator: How to Never Overpay for a Property Again',
    teaser:
      'A step-by-step guide to the Maximum Allowable Offer formula and how to adjust it for your market.',
    category: 'Guides',
    date: 'March 2026',
  },
  {
    title: 'BRRRR Strategy: Why Most Platforms Only Cover Half the Lifecycle',
    teaser:
      'Buy, rehab, rent, refinance, repeat. Most tools stop at the rehab. Here\'s why the full lifecycle matters.',
    category: 'Strategy',
    date: 'March 2026',
  },
  {
    title: '5 Distress Signals That Predict Motivated Sellers',
    teaser:
      'Not all distress signals are equal. These five indicators consistently surface the best off-market deals.',
    category: 'Data',
    date: 'March 2026',
  },
  {
    title: 'Financial Guardrails: The Automation Your Portfolio Needs',
    teaser:
      'How automated budget alerts, deadline tracking, and margin protection keep your deals profitable.',
    category: 'Product',
    date: 'March 2026',
  },
];

/* ------------------------------------------------------------------ */
/*  Category color map                                                 */
/* ------------------------------------------------------------------ */

const categoryColors: Record<string, { bg: string; text: string }> = {
  Technology: {
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
  },
  Strategy: {
    bg: 'bg-purple-100 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-400',
  },
  Guides: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  Data: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
  },
  Product: {
    bg: 'bg-teal-100 dark:bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-400',
  },
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function BlogPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [email, setEmail] = useState('');

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

  const getCategoryStyle = (category: string) =>
    categoryColors[category] || {
      bg: 'bg-gray-100 dark:bg-gray-500/15',
      text: 'text-gray-700 dark:text-gray-400',
    };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* -------------------------------------------------------- */}
        {/*  Hero                                                     */}
        {/* -------------------------------------------------------- */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">Blog</span>
            </nav>

            <div className="flex flex-col items-start">
              <SectionPill
                glowColor="16, 185, 129"
                pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Investor Insights
              </SectionPill>

              <h1
                className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mt-8 mb-6 max-w-4xl relative z-10 pb-1"
                style={isDarkMode ? {
                  backgroundImage: 'radial-gradient(ellipse 120% 200% at 10% -20%, rgb(16, 185, 129) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.45) 75%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                } : undefined}
              >
                The FlipOps Blog
              </h1>
              <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
                Strategies, guides, and insights for real estate investors.
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Featured article                                         */}
        {/* -------------------------------------------------------- */}
        <section className="pb-12">
          <div className="container mx-auto px-4 max-w-6xl">
            <div
              className="rounded-2xl p-8 lg:p-10 relative overflow-hidden transition-transform duration-200 hover:-translate-y-1"
              style={cardStyle}
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
                <div className="w-full lg:w-96 rounded-xl shrink-0 overflow-hidden relative bg-gray-950 border border-white/10 p-3.5 flex flex-col gap-1.5">
                  {/* Mini header */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Distress Scoring</span>
                    <span className="text-[10px] text-emerald-400 font-medium">Live</span>
                  </div>
                  {/* Property rows */}
                  {[
                    { addr: '1847 Elm St', score: 89, signals: ['Pre-FC', 'Vacant'] },
                    { addr: '3921 Oak Ave', score: 75, signals: ['Liens', 'Out-of-State'] },
                    { addr: '562 Pine Dr', score: 54, signals: ['Inherited'] },
                    { addr: '8103 Maple Ln', score: 31, signals: ['High Equity'] },
                  ].map((row) => (
                    <div
                      key={row.addr}
                      className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 border border-white/[0.06]"
                    >
                      {/* Score circle */}
                      <div className="relative w-7 h-7 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15" fill="none"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${row.score * 0.94} 100`}
                            stroke={row.score >= 65 ? '#10b981' : row.score >= 50 ? '#f59e0b' : row.score >= 35 ? '#f97316' : '#ef4444'}
                          />
                        </svg>
                      </div>
                      {/* Address + signals */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-white truncate">{row.addr}</div>
                        <div className="flex gap-1 mt-0.5">
                          {row.signals.map((s) => (
                            <span
                              key={s}
                              className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-gray-300 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* Score number */}
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${
                        row.score >= 65 ? 'text-emerald-400' : row.score >= 50 ? 'text-amber-400' : row.score >= 35 ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {row.score}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        getCategoryStyle(featuredPost.category).bg
                      } ${getCategoryStyle(featuredPost.category).text}`}
                    >
                      {featuredPost.category}
                    </span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      Coming Soon
                    </span>
                  </div>

                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {featuredPost.teaser}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                    <Clock className="w-4 h-4" />
                    {featuredPost.date}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Article grid                                             */}
        {/* -------------------------------------------------------- */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <div
                  key={post.title}
                  className="rounded-2xl p-6 flex flex-col transition-transform duration-200 hover:-translate-y-1"
                  style={cardStyle}
                >
                  {/* Category + Coming Soon */}
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        getCategoryStyle(post.category).bg
                      } ${getCategoryStyle(post.category).text}`}
                    >
                      {post.category}
                    </span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      Coming Soon
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                    {post.teaser}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {post.date}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-400 dark:text-gray-500">
                      Read article
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Newsletter signup                                        */}
        {/* -------------------------------------------------------- */}
        <section className="py-20 lg:py-28 border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Get investor insights delivered weekly.
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Join our newsletter for strategies, market analysis, and product
              updates. No spam, unsubscribe anytime.
            </p>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 w-full sm:w-auto h-11 px-4 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 text-sm h-11 px-6"
              >
                Subscribe
              </Button>
            </form>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  CTA                                                      */}
        {/* -------------------------------------------------------- */}
        <section className="py-20 lg:py-28 border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Explore the Platform
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              See how FlipOps replaces your entire tool stack with one
              integrated platform built for real estate investors.
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
