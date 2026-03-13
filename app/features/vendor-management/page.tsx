'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  Star,
  Wrench,
  BarChart3,
  Award,
  DollarSign,
  ChevronRight,
  Tag,
  ArrowRight,
  ClipboardList,
  FileText,
  TrendingUp,
  CheckCircle2,
  Layers,
  Hammer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Feature cards data ─────────────────────────────────────── */
const features = [
  {
    icon: Users,
    title: 'Centralized Vendor Database',
    desc: 'All your contractors, inspectors, title companies, and service providers in one place. No more digging through phone contacts, spreadsheets, or text threads to find the guy who did that plumbing job last year.',
  },
  {
    icon: Star,
    title: 'Performance Scoring Over Time',
    desc: 'Every vendor gets scored across three dimensions: on-time completion rate, budget accuracy, and quality (measured by redone or warranty work). Scores update automatically as you close projects.',
  },
  {
    icon: Tag,
    title: 'Specialty Tagging',
    desc: 'Tag vendors by trade (electrician, plumber, GC, inspector, title company) and by market or service area. When you expand to a new market, you can see which of your vendors also operate there.',
  },
  {
    icon: BarChart3,
    title: 'Vendor Comparison',
    desc: 'When you need a contractor for a job, see all vendors who do that trade — ranked by past performance. Compare on-time rates, average budget variance, and quality scores side by side.',
  },
  {
    icon: ClipboardList,
    title: 'Assignment Tracking',
    desc: 'When assigning a vendor to a project, their full performance history on your past projects is visible right there. No guessing, no calling references — you already have the data.',
  },
  {
    icon: DollarSign,
    title: 'Payment Tracking',
    desc: 'Track payment status across every vendor: paid, outstanding, and invoiced. See total spend per vendor, per project, and per trade category. Know exactly where your rehab dollars are going.',
  },
];

/* ── Why it compounds data ──────────────────────────────────── */
const compoundReasons = [
  {
    icon: TrendingUp,
    title: 'After 10 flips, you have a curated network',
    desc: 'Every project teaches you which contractors deliver and which don\'t. After 10 deals, you have a performance-tested vendor network that most investors spend years assembling informally.',
  },
  {
    icon: Award,
    title: 'That database is a business asset',
    desc: 'A reliable contractor network is one of the most valuable assets in a flipping business. It\'s the difference between a 3-week kitchen reno and a 3-month nightmare. FlipOps makes it measurable.',
  },
  {
    icon: Layers,
    title: 'Make it institutional knowledge',
    desc: 'Right now, your vendor knowledge lives in your phone contacts and your head. If you hire, scale, or partner — that knowledge doesn\'t transfer. FlipOps makes it institutional, searchable, and permanent.',
  },
];

export default function VendorManagementPage() {
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
            <span className="text-foreground font-medium">Vendor Management</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
            glowColor="59, 130, 246"
          >
            Vendor Network
          </SectionPill>

          <h1 className="glow-heading-blue text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Your Contractor Network Is One of Your Most Valuable Assets
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            FlipOps tracks vendor performance across every project — so you always know who delivers on time, on budget, and at quality.
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
              <p className="text-3xl sm:text-4xl font-bold text-blue-500">3x</p>
              <p className="text-sm text-muted-foreground">faster rehab timelines</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-blue-500">100%</p>
              <p className="text-sm text-muted-foreground">vendor history tracked</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Why Vendor Management Compounds ──────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            Why Vendor Management Compounds
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            Your vendor network gets more valuable with every project you close. FlipOps makes sure none of that knowledge gets lost.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {compoundReasons.map((reason, i) => (
              <motion.div
                key={reason.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8 text-center"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
                  <reason.icon className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold mt-2 mb-3">{reason.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{reason.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Features ─────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <SectionPill
            pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
            glowColor="59, 130, 246"
            staggerIndex={1}
          >
            <Wrench className="w-4 h-4" />
            What You Get
          </SectionPill>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mt-6 mb-4 relative z-10">
            Everything You Need to Manage Your Vendor Network
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14 relative z-10">
            From a centralized database to performance scoring and payment tracking — every tool to build and maintain a reliable contractor network.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Integration with Rehab ───────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl p-8" style={cardStyle}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Hammer className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">
                  Integrated with Rehab Tracking
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  When you assign a vendor to a renovation category, their full performance data is right there — on-time rate, budget accuracy, quality score, and every past project they&apos;ve worked on with you.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-blue-500/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">Better Contractor Decisions</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Stop guessing which contractor to hire. See who performed best on similar jobs across your portfolio. Data-driven decisions replace gut feel.
                </p>
              </div>
              <div className="rounded-xl border border-blue-500/20 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold">Performance Improves Over Time</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every project adds more data. After a few deals, you know exactly who to call for every trade in every market — and who to avoid.
                </p>
              </div>
            </div>

            <Link
              href="/features/rehab-tracking"
              className="inline-flex items-center gap-2 text-blue-500 hover:underline text-sm font-medium"
            >
              Learn about Rehab Tracking <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 5: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Vendor Management in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps helps you build a reliable, data-driven contractor network that improves with every deal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-blue-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
