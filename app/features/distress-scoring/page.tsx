'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  Eye,
  Target,
  AlertTriangle,
  Gavel,
  FileWarning,
  Home,
  MapPin,
  ScrollText,
  TrendingUp,
  Clock,
  Scale,
  XCircle,
  UserX,
  Zap,
  ChevronRight,
  Database,
  ShieldCheck,
  BarChart3,
  Search,
  Filter,
  Tag,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XOctagon,
  Users,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Lock,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Distress signal tier data ───────────────────────────────── */
const tier1Signals = [
  { name: 'Pre-Foreclosure Filing', desc: 'Foreclosure starts up 26% YoY — active financial pressure with a legal timeline', icon: AlertTriangle, pts: 25 },
  { name: 'Tax Delinquency', desc: 'Recency and amount matter. $200 owed is different from $20,000 owed.', icon: FileWarning, pts: 20 },
  { name: 'Vacant + Code Violations', desc: 'Municipal pressure plus financial burden — compounding signals', icon: Home, pts: 15 },
  { name: 'Probate / Inherited', desc: 'Widely considered the highest-ROI niche. Heirs often motivated to sell quickly.', icon: ScrollText, pts: 15 },
];

const tier2Signals = [
  { name: 'Divorce Filing', desc: 'Life disruption creates urgency. Both parties often motivated to liquidate.', icon: Scale },
  { name: 'Failed / Expired Listing', desc: 'Seller is frustrated. More willing to negotiate below market.', icon: XCircle },
  { name: 'Liens (HOA, Mechanics, Tax)', desc: 'Financial obligations attached to the property. Pressure builds over time.', icon: FileWarning },
  { name: 'Absentee Owner (15+ Years)', desc: 'Tired landlord. Long ownership without refinance signals potential exit.', icon: UserX },
];

const tier3Signals = [
  { name: 'High Equity Alone', desc: 'Valuable filter, but alone doesn\'t indicate motivation', icon: TrendingUp },
  { name: 'Absentee Ownership Alone', desc: 'Common among snowbirds and investors — needs stacking', icon: MapPin },
  { name: 'Out-of-State Owner Alone', desc: 'Could be a vacation home, rental, or inheritance', icon: MapPin },
];

/* ── How it works steps ──────────────────────────────────────── */
const howItWorks = [
  {
    num: '01',
    title: 'You Work Deals',
    desc: 'Every lead you pursue, skip, or close teaches the algorithm your preferences. It sees what you click, what you ignore, what you make offers on.',
    icon: Target,
  },
  {
    num: '02',
    title: 'The Algorithm Watches',
    desc: '15+ behavioral signals tracked: price ranges, distress profiles, property types, markets, deal sizes, rehab levels, and how you respond to each.',
    icon: Eye,
  },
  {
    num: '03',
    title: 'Your Scores Adapt',
    desc: 'Over time, your lead scores become personalized to YOUR strategy. Two investors in the same market see different top leads — because they should.',
    icon: Brain,
  },
];

/* ── Approach comparison data ────────────────────────────────── */
const approaches = [
  {
    approach: 'Raw Data Filtering',
    how: 'You get a database. You set filters. You get a list.',
    limitation: 'No intelligence layer. A tax-delinquent property with $200 owed looks the same as one with $20,000 owed. You\'re the filter.',
  },
  {
    approach: 'Manual Lead Tagging',
    how: 'You review leads and manually mark them hot / warm / cold.',
    limitation: 'Subjective. Time-consuming. Your "gut feel" doesn\'t scale. And it doesn\'t learn.',
  },
  {
    approach: 'Static Lead Scoring',
    how: 'A platform assigns a score based on fixed rules.',
    limitation: 'Same score for everyone. Doesn\'t adapt to your strategy. Doesn\'t incorporate deal outcomes.',
  },
  {
    approach: 'AI-Assisted Prospecting',
    how: 'AI identifies likely sellers based on aggregate patterns.',
    limitation: 'Better than static scoring, but still one-size-fits-all. Doesn\'t personalize per user.',
  },
  {
    approach: 'FlipOps Distress Scoring',
    how: 'Weighted multi-signal scoring + per-user behavioral learning + outcome feedback loop.',
    limitation: 'Requires time on the platform to personalize. Baseline scoring works immediately; behavioral learning improves over weeks of use.',
    highlight: true,
  },
];

export default function DistressScoringPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const cardStyle = isDarkMode
    ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
      };

  const tableHeaderStyle = isDarkMode
    ? { background: 'rgba(168, 85, 247, 0.1)', borderBottom: '1px solid rgba(168, 85, 247, 0.2)' }
    : { background: 'rgba(168, 85, 247, 0.05)', borderBottom: '1px solid rgba(168, 85, 247, 0.15)' };

  const tableRowStyle = isDarkMode
    ? { borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }
    : { borderBottom: '1px solid rgba(0, 0, 0, 0.06)' };

  const highlightRowStyle = isDarkMode
    ? { background: 'rgba(168, 85, 247, 0.08)', borderBottom: '1px solid rgba(168, 85, 247, 0.15)' }
    : { background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(168, 85, 247, 0.1)' };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />

      {/* ── Section 1: Hero ─────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Distress Scoring</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25"
            glowColor="168, 85, 247"
          >
            Behavioral Learning
          </SectionPill>

          <h1 className="glow-heading-purple text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Know Which Properties Are Distressed Before They Hit Any List
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            FlipOps analyzes 15+ distress signals across 157M+ properties and assigns every one a score from 0 to 100. The higher the score, the more likely the owner is motivated to sell.
          </p>

          {/* Hero stat callout */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 relative z-10"
            style={cardStyle}
          >
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-purple-500">1.5%</p>
              <p className="text-sm text-muted-foreground">of investor leads become closed deals</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-purple-500">42.8%</p>
              <p className="text-sm text-muted-foreground">of leads are dead on arrival</p>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div className="text-left hidden sm:block">
              <p className="text-xs text-muted-foreground/70 mt-1">Source: REsimpli 2024 platform data</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: The Problem ──────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            The Problem With How Leads Work Today
          </h2>
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              Most platforms give you raw property data and let you filter by basic criteria — pre-foreclosure, tax delinquent, vacant, high equity. You get a list. You have no idea which leads on that list are actually likely to sell.
            </p>
            <p className="text-lg">
              Some platforms let you manually tag leads as &ldquo;hot&rdquo; or &ldquo;cold&rdquo; — but that&apos;s gut feel, not data. You&apos;re guessing. And guessing doesn&apos;t scale.
            </p>
            <p className="text-lg">
              The result: investors report that roughly <span className="text-foreground font-semibold">43% of their leads are dead on arrival</span>. They&apos;re spending money on skip tracing, direct mail, and cold calls on properties where the owner has zero motivation to sell.
            </p>

            {/* Problem stats grid */}
            <div className="grid sm:grid-cols-3 gap-4 pt-4">
              {[
                { stat: '$410–$470', label: 'Cost per lead', sub: 'Organic to paid range', source: 'Promodo 2025' },
                { stat: '1 in 66', label: 'Leads that close', sub: 'Lead-to-deal conversion', source: 'REsimpli 2024' },
                { stat: '$14,200/yr', label: 'Avg marketing spend', sub: 'Annual investor average', source: 'Luxury Presence 2024' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-5" style={cardStyle}>
                  <p className="text-2xl font-bold text-purple-500">{item.stat}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2">{item.source}</p>
                </div>
              ))}
            </div>

            <p className="text-lg pt-2">
              The fundamental problem: <span className="text-foreground font-semibold">raw data without intelligence is just noise.</span> Knowing a property is tax delinquent doesn&apos;t tell you whether the owner is 6 months behind or 6 years behind. Knowing it&apos;s vacant doesn&apos;t tell you whether it&apos;s a snowbird&apos;s second home or an abandoned property headed for auction.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: How FlipOps Distress Scoring Works ─────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            How FlipOps Distress Scoring Works
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            Investors respect specifics, not hand-waving. Here&apos;s exactly what happens under the hood.
          </p>

          {/* The 0-100 scale explainer */}
          <div className="rounded-2xl p-8 mb-12" style={cardStyle}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">The 0–100 Scale</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Every property in the database gets a composite distress score. <span className="text-foreground font-medium">0</span> = no distress signals detected. <span className="text-foreground font-medium">100</span> = maximum distress across multiple categories. The score isn&apos;t a simple count of flags — it&apos;s a weighted composite where different signals carry different weight based on their historical correlation with seller motivation.
                </p>
              </div>
            </div>

            {/* Score scale visual */}
            <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent opacity-30" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
              <span>0 — No distress</span>
              <span>35 — Moderate</span>
              <span>70+ — Auto skip trace</span>
              <span>100 — Maximum</span>
            </div>
          </div>

          {/* Signal Tier System */}
          <h3 className="text-2xl font-bold tracking-tight mb-8">Distress Signal Hierarchy</h3>

          {/* Tier 1 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-semibold">
                Tier 1 — Highest Motivation
              </span>
              <span className="text-xs text-muted-foreground">Compounding financial pressure</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {tier1Signals.map((s) => (
                <div key={s.name} className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{s.name}</h4>
                      <span className="text-xs text-purple-500 font-semibold">{s.pts} pts</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 2 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-sm font-semibold">
                Tier 2 — Strong Motivation
              </span>
              <span className="text-xs text-muted-foreground">Life disruption + financial strain</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {tier2Signals.map((s) => (
                <div key={s.name} className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{s.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tier 3 */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-sm font-semibold">
                Tier 3 — Moderate Motivation
              </span>
              <span className="text-xs text-muted-foreground">Single indicator, needs stacking</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {tier3Signals.map((s) => (
                <div key={s.name} className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <s.icon className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{s.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-signal stacking + 70 threshold */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Multi-Signal Stacking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The real power is when multiple signals stack. A property that&apos;s tax delinquent AND vacant AND has code violations scores dramatically higher than one with only one flag. Stacked signals indicate compounding pressure on the owner, which increases motivation. Industry practitioners report <span className="text-foreground font-medium">3–5x improvement in conversion efficiency</span> when targeting properties with 3+ stacked distress indicators vs. single-signal lists.
              </p>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">The 70+ Threshold</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When a property crosses a score of 70, FlipOps automatically triggers <Link href="/features/skip-tracing" className="text-purple-500 hover:underline">skip tracing</Link> to pull owner contact information. Below that threshold, the cost of skip tracing doesn&apos;t justify the conversion probability. Above 70, the lead is statistically worth pursuing. This threshold is adjustable per user.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Behavioral Learning ──────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25"
              glowColor="168, 85, 247"
              staggerIndex={1}
            >
              <Brain className="w-4 h-4" />
              Why Your Scores Get Smarter Over Time
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              Behavioral Learning: No Competitor Has This
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Every investor has a strategy, whether they&apos;ve articulated it or not. A wholesaler in Phoenix targeting low-value properties operates completely differently from a BRRRR operator in Jacksonville targeting high-equity rentals. A one-size-fits-all scoring system treats both the same. FlipOps doesn&apos;t.
            </p>
          </div>

          {/* How it works - 3 step cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {howItWorks.map((step) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: parseInt(step.num) * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8 text-center"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-7 h-7 text-purple-500" />
                </div>
                <span className="text-xs font-semibold text-purple-500 tracking-widest uppercase">{step.num}</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Personalization examples */}
          <div className="rounded-2xl p-8" style={cardStyle}>
            <h3 className="text-xl font-semibold mb-6">How Personalization Changes Your Feed</h3>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Jake - Wholesaler */}
              <div className="rounded-xl border border-purple-500/20 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-500">JM</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Jake M.</p>
                    <p className="text-xs text-muted-foreground">Wholesaler &middot; Phoenix, AZ</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Pursues: pre-foreclosures under $200K, high-volume, fast turnaround</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-purple-500/5">
                    <span>3284 W Camelback Rd — Pre-FC, Tax Lien</span>
                    <span className="font-bold text-purple-500">92</span>
                  </div>
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-purple-500/5">
                    <span>1847 N 32nd St — Vacant, Code Violations</span>
                    <span className="font-bold text-purple-500">87</span>
                  </div>
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-purple-500/5">
                    <span>5621 E McDowell — Pre-FC, Absentee</span>
                    <span className="font-bold text-purple-500">84</span>
                  </div>
                </div>
              </div>

              {/* Sarah - Flipper */}
              <div className="rounded-xl border border-emerald-500/20 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-emerald-500">SR</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Sarah R.</p>
                    <p className="text-xs text-muted-foreground">Flipper &middot; Atlanta, GA</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Pursues: high-equity inherited properties, $250K–$400K range, cosmetic rehabs</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-emerald-500/5">
                    <span>892 Peachtree Ln — Probate, High Equity</span>
                    <span className="font-bold text-emerald-500">94</span>
                  </div>
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-emerald-500/5">
                    <span>2140 Buckhead Dr — Inherited, 20yr Owner</span>
                    <span className="font-bold text-emerald-500">89</span>
                  </div>
                  <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-emerald-500/5">
                    <span>445 Midtown Ave — Expired, Divorce</span>
                    <span className="font-bold text-emerald-500">81</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 px-5 py-4">
              <p className="text-sm text-foreground">
                <span className="font-semibold">Same platform. Completely different top leads.</span>{' '}
                <span className="text-muted-foreground">A wholesaler in Phoenix and a flipper in Atlanta get different top leads — because they should. Static scoring systems rank every property the same way for every user.</span>
              </p>
            </div>
          </div>

          {/* Behavioral learning deep dive */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <RefreshCw className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">The Feedback Loop</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you close a deal, that outcome data feeds back into the model. FlipOps now knows which score ranges, signal combinations, and property profiles actually convert into profitable deals for YOU. This is data no disconnected tool stack can ever produce — because tools that only see part of the pipeline can never correlate lead characteristics with deal outcomes.
              </p>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                <Lock className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Privacy and Data</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your behavioral data trains YOUR model. Other users&apos; data contributes to the aggregate scoring algorithm (making the baseline smarter for everyone), but your specific pattern is yours alone. No investor sees another investor&apos;s behavioral model or lead preferences.
              </p>
            </div>
          </div>

          {/* Supporting stat */}
          <div className="flex items-center justify-center gap-8 mt-10 text-center">
            <div>
              <p className="text-2xl font-bold text-purple-500">66%</p>
              <p className="text-xs text-muted-foreground">of deals close on follow-up, not first contact</p>
              <p className="text-[10px] text-muted-foreground/60">FreedomSoft CRM data</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="text-2xl font-bold text-purple-500">73%</p>
              <p className="text-xs text-muted-foreground">of top brokerages investing in AI scoring</p>
              <p className="text-[10px] text-muted-foreground/60">ULI Emerging Trends 2025</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="text-2xl font-bold text-purple-500">77%</p>
              <p className="text-xs text-muted-foreground">more ROI from scored lead gen</p>
              <p className="text-[10px] text-muted-foreground/60">Marketing automation research</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Approach Comparison Table ─────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            How This Is Different From Other Approaches
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
            Not all lead scoring is created equal. Here&apos;s how the major approaches compare.
          </p>

          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th className="text-left px-5 py-4 font-semibold text-foreground">Approach</th>
                    <th className="text-left px-5 py-4 font-semibold text-foreground">How It Works</th>
                    <th className="text-left px-5 py-4 font-semibold text-foreground">The Limitation</th>
                  </tr>
                </thead>
                <tbody>
                  {approaches.map((row) => (
                    <tr key={row.approach} style={row.highlight ? highlightRowStyle : tableRowStyle}>
                      <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">
                        {row.highlight && <Sparkles className="w-3.5 h-3.5 text-purple-500 inline mr-1.5 -mt-0.5" />}
                        {row.approach}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{row.how}</td>
                      <td className="px-5 py-4 text-muted-foreground">{row.limitation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: What This Means For Your Deals ─────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            What This Means For Your Deals
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Scoring isn&apos;t a feature — it&apos;s a compounding asset. The longer you use it, the smarter it gets.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: DollarSign,
                title: 'Lower Skip Trace Costs',
                desc: 'Only trace leads above the threshold. Stop paying to trace contacts you\'ll never call.',
                color: 'emerald',
              },
              {
                icon: Clock,
                title: 'Less Wasted Time',
                desc: 'You\'re calling owners with actual motivation — not working through a random list hoping someone picks up.',
                color: 'blue',
              },
              {
                icon: TrendingUp,
                title: 'Higher Conversion',
                desc: 'The system surfaces leads that match YOUR proven pattern. Your close rate improves because the leads improve.',
                color: 'purple',
              },
              {
                icon: RefreshCw,
                title: 'Compounds Over Time',
                desc: 'The platform gets smarter specifically for you. It\'s an asset that improves with every deal you work.',
                color: 'amber',
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className={`w-10 h-10 rounded-lg bg-${item.color}-500/10 flex items-center justify-center mb-4`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Market opportunity callout */}
          <div className="rounded-2xl p-6 mt-10" style={cardStyle}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold">The Market Is Moving</h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">367,460</p>
                <p className="text-sm text-muted-foreground">U.S. foreclosure filings in 2025</p>
                <p className="text-[10px] text-muted-foreground/60">Up 14% YoY — ATTOM Year-End 2025</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">+26%</p>
                <p className="text-sm text-muted-foreground">Foreclosure starts Jan 2026 vs Jan 2025</p>
                <p className="text-[10px] text-muted-foreground/60">ATTOM Jan 2026</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">2%</p>
                <p className="text-sm text-muted-foreground">Distressed sales as share of all sales</p>
                <p className="text-[10px] text-muted-foreground/60">NAR 2026 (vs ~18% during Great Recession)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Powered by CoreLogic ────────────────────────────────── */}
      <section className="py-16 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Powered by CoreLogic</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Real-time scoring across 157M+ properties in all 50 states. Powered by CoreLogic&apos;s comprehensive property database — the same data source used by lenders, appraisers, and government agencies.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> 157M+ Properties</span>
            <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /> All 50 States</span>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Real-Time</span>
          </div>
        </div>
      </section>

      {/* ── Section 7: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Scoring in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps scores distressed properties and adapts to your investment strategy over time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-purple-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
