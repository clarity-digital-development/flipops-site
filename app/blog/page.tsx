'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, ArrowRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Blog post data                                                      */
/* ------------------------------------------------------------------ */

interface BlogPost {
  title: string;
  teaser: string;
  category: string;
  date: string;
  slug?: string;
  published?: boolean;
  tags?: string[];
}

const featuredPost: BlogPost = {
  title: 'How AI Distress Scoring Is Changing Real Estate Investing',
  teaser:
    'Traditional lead lists are static. AI-powered scoring is dynamic, personalized, and gets smarter with every deal you work.',
  category: 'Technology',
  date: 'March 2026',
  slug: 'ai-distress-scoring-changing-real-estate-investing',
  published: true,
  tags: ['Lead Scoring', 'Distress Data', 'AI'],
};

const posts: BlogPost[] = [
  {
    title: 'How FlipOps Sources Leads and Keeps You DNC Compliant at Every Step',
    teaser:
      'Every cold call to a DNC-registered number can cost up to $43,792. Here\'s how FlipOps scrubs against the registry at the skip trace level so you never dial a number you shouldn\'t.',
    category: 'Guides',
    date: 'March 2026',
    slug: 'dnc-compliance-skip-tracing-flipops',
    published: true,
    tags: ['Skip Tracing', 'TCPA Compliance', 'Lead Quality'],
  },
  {
    title: 'The True Cost of Tool Sprawl for Real Estate Investors',
    teaser:
      "Six subscriptions. Six logins. Zero integration. Here's what fragmentation actually costs your business.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'true-cost-of-tool-sprawl-real-estate-investors',
    published: true,
    tags: ['Software Stack', 'Operations', 'Wholesaling'],
  },
  {
    title: 'MAO Calculator: How to Never Overpay for a Property Again',
    teaser:
      'A step-by-step guide to the Maximum Allowable Offer formula and how to adjust it for your market.',
    category: 'Guides',
    date: 'March 2026',
    slug: 'mao-calculator-never-overpay-property',
    published: true,
    tags: ['Deal Analysis', 'Fix & Flip', 'Wholesaling'],
  },
  {
    title: 'BRRRR Strategy: Why Most Platforms Only Cover Half the Lifecycle',
    teaser:
      "Buy, rehab, rent, refinance, repeat. Most tools stop at the rehab. Here's why the full lifecycle matters.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'brrrr-strategy-platforms-cover-half-lifecycle',
    published: true,
    tags: ['BRRRR', 'Rental', 'Fix & Flip'],
  },
  {
    title: '5 Distress Signals That Predict Motivated Sellers',
    teaser:
      'Not all distress signals are equal. These five indicators consistently surface the best off-market deals.',
    category: 'Data',
    date: 'March 2026',
    slug: 'distress-signals-predict-motivated-sellers',
    published: true,
    tags: ['Distress Data', 'Motivated Sellers', 'Lead Scoring'],
  },
  {
    title: 'Financial Guardrails: The Automation Your Portfolio Needs',
    teaser:
      'How automated budget alerts, deadline tracking, and margin protection keep your deals profitable.',
    category: 'Product',
    date: 'March 2026',
    slug: 'financial-guardrails-automation-portfolio',
    published: true,
    tags: ['Operations', 'Fix & Flip', 'Deal Analysis'],
  },
  {
    title: "How to Pick a Real Estate Market for Flipping: The Data-Driven Checklist Most Investors Skip",
    teaser:
      "Most investors flip houses in whatever city they happen to live in. Here's the data checklist that separates profitable market selection from expensive guesswork.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'how-to-pick-real-estate-market-flipping',
    published: true,
    tags: ['Fix & Flip', 'Market Analysis', 'Acquisition'],
  },
  {
    title: 'How to Build a Skip Tracing Workflow That Actually Converts',
    teaser:
      "Most investors skip trace in bulk and spray dials at a list. Here's how to build a workflow that turns raw property data into closed deals.",
    category: 'Guides',
    date: 'March 2026',
    slug: 'skip-tracing-workflow-that-converts',
    published: true,
    tags: ['Skip Tracing', 'Lead Generation', 'Operations'],
  },
  {
    title: 'From Lead to Close: The All-in-One CRM Real Estate Investors Actually Need',
    teaser:
      "Most CRMs cover one or two stages of the deal lifecycle. Here's what a platform built for the full pipeline actually looks like.",
    category: 'Product',
    date: 'March 2026',
    slug: 'lead-to-close-all-in-one-crm',
    published: true,
    tags: ['CRM', 'Software Stack', 'Operations'],
  },
  {
    title: 'How to Pick Your Next Acquisition Market: A Data-Driven Framework',
    teaser:
      "Gut instinct and guru advice aren't market analysis. Here's a repeatable framework using data that actually predicts deal flow.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'how-to-pick-your-next-acquisition-market',
    published: true,
    tags: ['Market Analysis', 'Acquisition', 'Deal Analysis'],
  },
  {
    title: 'Best Real Estate Wholesaling Software in 2026: An Honest Comparison',
    teaser:
      "We break down PropStream, REsimpli, DealMachine, BatchLeads, and FlipOps side by side — what each does well, where each falls short, and which fits your operation.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'best-real-estate-wholesaling-software-comparison',
    published: true,
    tags: ['Software Stack', 'Wholesaling', 'Fix & Flip'],
  },
  {
    title: 'How to Analyze a Real Estate Deal: The No-Guesswork Guide for First-Time Investors',
    teaser:
      "Learn how to analyze a real estate deal from scratch — ARV, repair estimates, the 70% rule, and the exact numbers you need before making an offer.",
    category: 'Guides',
    date: 'March 2026',
    slug: 'how-to-analyze-a-real-estate-deal',
    published: true,
    tags: ['Deal Analysis', 'Beginners', 'Fix & Flip'],
  },
  {
    title: 'How Many Subscriptions Does It Take to Close a Deal? Why Your Software Stack Is Bleeding Profit',
    teaser:
      "Most real estate investors are paying for 5–8 separate tools that don't talk to each other. Here's how stack bloat kills deal velocity.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'real-estate-investor-software-stack-tool-consolidation',
    published: true,
    tags: ['Software Stack', 'Operations', 'Wholesaling'],
  },
  {
    title: "Why 80% of Your Motivated Seller Leads Never Convert (And How to Fix Your List)",
    teaser:
      "Most 'motivated seller leads' aren't motivated at all. Here's the scoring framework that separates real distress from demographic noise.",
    category: 'Data',
    date: 'March 2026',
    slug: 'why-your-motivated-seller-list-isnt-converting',
    published: true,
    tags: ['Motivated Sellers', 'Lead Scoring', 'Distress Data'],
  },
  {
    title: 'What 43% DOA Leads Cost You (And How Distress Scoring Fixes It)',
    teaser:
      "Nearly half of purchased real estate leads are dead on arrival. Here's what that costs per deal — in dollars, hours, and missed contracts.",
    category: 'Data',
    date: 'March 2026',
    slug: 'what-doa-leads-cost-you-distress-scoring',
    published: true,
    tags: ['Lead Scoring', 'Distress Data', 'Wholesaling'],
  },
  {
    title: "Why We're Building FlipOps: The Problem With Real Estate Investing Software",
    teaser:
      "Real estate investors juggle 4–6 disconnected tools to run their deal flow. Here's the real cost of that fragmentation — in money, time, and missed deals.",
    category: 'Product',
    date: 'March 2026',
    slug: 'why-were-building-flipops',
    published: true,
    tags: ['Software Stack', 'Operations', 'Wholesaling'],
  },
  {
    title: 'How to Build a Real Estate Buyers List That Actually Closes Deals',
    teaser:
      "Most wholesalers build buyers lists full of tire-kickers. Here's how to build a list of verified closers — sourced from public records, segmented by strategy, and maintained so it doesn't decay.",
    category: 'Strategy',
    date: 'March 2026',
    slug: 'how-to-build-a-buyers-list-real-estate',
    published: true,
    tags: ['Wholesaling', 'Acquisition', 'Fix & Flip'],
  },
  {
    title: "What Is Wholesaling Real Estate? The Complete Beginner's Guide",
    teaser:
      "Wholesaling requires no bank loans, no renovations, and no property ownership. Here's exactly how it works, what it costs to start, and what separates the operators who make money from those who don't.",
    category: 'Guides',
    date: 'March 2026',
    slug: 'what-is-wholesaling-real-estate',
    published: true,
    tags: ['Wholesaling', 'Beginners', 'Deal Analysis'],
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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

  // Derive sorted unique tags from all posts (including featured)
  const allTags = Array.from(
    new Set([...(featuredPost.tags || []), ...posts.flatMap((p) => p.tags || [])])
  ).sort();

  // Filter grid posts by selected tag
  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags?.includes(selectedTag))
    : posts;

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
                    {featuredPost.published ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                        Published
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {featuredPost.published && featuredPost.slug ? (
                    <Link href={`/blog/${featuredPost.slug}`}>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {featuredPost.title}
                      </h2>
                    </Link>
                  ) : (
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                      {featuredPost.title}
                    </h2>
                  )}
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {featuredPost.teaser}
                  </p>

                  {/* Tags */}
                  {featuredPost.tags && featuredPost.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {featuredPost.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                            selectedTag === tag
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                      <Clock className="w-4 h-4" />
                      {featuredPost.date}
                    </div>
                    {featuredPost.published && featuredPost.slug && (
                      <Link
                        href={`/blog/${featuredPost.slug}`}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        Read article
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Tag filter bar                                           */}
        {/* -------------------------------------------------------- */}
        <section className="pb-8">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Filter by topic
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  !selectedTag
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {selectedTag && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Showing {filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'} tagged{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">#{selectedTag}</span>
              </p>
            )}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  Article grid                                             */}
        {/* -------------------------------------------------------- */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-6xl">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                No articles found for <span className="font-medium">#{selectedTag}</span>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPosts.map((post) => {
                  const cardContent = (
                    <>
                      {/* Category + Status */}
                      <div className="flex items-center gap-2 mb-4">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            getCategoryStyle(post.category).bg
                          } ${getCategoryStyle(post.category).text}`}
                        >
                          {post.category}
                        </span>
                        {post.published ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
                            Published
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            Coming Soon
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {post.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-1">
                        {post.teaser}
                      </p>

                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                selectedTag === tag
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {post.date}
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${post.published ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                          Read article
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </>
                  );

                  return post.published && post.slug ? (
                    <Link
                      key={post.title}
                      href={`/blog/${post.slug}`}
                      className="rounded-2xl p-6 flex flex-col transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
                      style={cardStyle}
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <div
                      key={post.title}
                      className="rounded-2xl p-6 flex flex-col transition-transform duration-200 hover:-translate-y-1"
                      style={cardStyle}
                    >
                      {cardContent}
                    </div>
                  );
                })}
              </div>
            )}
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
