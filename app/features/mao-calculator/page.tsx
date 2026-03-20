'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  TrendingUp,
  Wrench,
  DollarSign,
  Clock,
  Target,
  ShieldAlert,
  Calculator,
  ArrowRight,
  BarChart3,
  Hammer,
  Home,
  Zap,
  Link2,
  Brain,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const howItWorksSteps = [
  {
    title: 'Comp-Driven ARV',
    desc: 'ARV pulls from live comparable sales data — not guesses, not Zestimates. Select which comps to include, weight by similarity, and fine-tune with a manual adjustment slider.',
    icon: BarChart3,
  },
  {
    title: 'Repair Estimation Across 12+ Categories',
    desc: 'Roof, kitchen, HVAC, flooring, electrical, plumbing, and more. Each line item is adjustable with local cost benchmarking so your numbers reflect your market, not a national average.',
    icon: Hammer,
  },
  {
    title: 'Holding Cost Calculation',
    desc: 'Property taxes, insurance, utilities, loan payments — multiplied by your projected hold timeline. FlipOps calculates the true monthly carrying cost so nothing hides in the margins.',
    icon: Clock,
  },
  {
    title: 'Target Margin Enforcement',
    desc: 'Set your minimum acceptable profit percentage. FlipOps won\'t let you fudge the numbers — the MAO adjusts automatically to protect your margin, not your ego.',
    icon: Target,
  },
];

const whyBuiltCards = [
  {
    title: 'Connected to Your Pipeline',
    desc: 'MAO follows the deal forward through every stage — acquisition, rehab, disposition. It\'s not a standalone spreadsheet that gets stale the moment you close it.',
    icon: Link2,
    link: { href: '/features/deal-pipeline', label: 'See Deal Pipeline' },
  },
  {
    title: 'Margin Alerts & Guardrails',
    desc: 'If you offer above MAO, FlipOps triggers a guardrail alert. You can still proceed — but you\'ll do it with eyes open, not by accident.',
    icon: ShieldAlert,
    link: { href: '/features/guardrails', label: 'See Guardrails' },
  },
  {
    title: 'Prevents "Deal Amnesia"',
    desc: 'Investors calculate MAO, then emotionally talk themselves into a higher number. FlipOps keeps the original math visible so the number you calculated is the number you stick to.',
    icon: Brain,
  },
];

export default function MAOCalculatorPage() {
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

      {/* ── Section 1: Hero ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">MAO Calculator</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
            glowColor="16, 185, 129"
          >
            Smart Underwriting
          </SectionPill>

          <h1 className="glow-heading-emerald text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Never Overpay for a Property Again
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            FlipOps calculates your Maximum Allowable Offer in real-time, factoring in ARV, repair costs, holding costs, and your target margin — so every offer protects your profit.
          </p>
        </div>
      </section>

      {/* ── Section 2: What MAO Is & Why It Matters ────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-bold tracking-tight mb-4">What MAO Is & Why It Matters</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              MAO is the single most important number in any real estate deal. Get it wrong and you either
              overpay (lose money) or underbid (lose the deal). Most investors calculate it on a calculator
              or spreadsheet with disconnected inputs — and hope they didn&apos;t miss anything.
            </p>
          </motion.div>

          {/* Formula card */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={1}
            className="rounded-2xl p-8 sm:p-10 max-w-2xl mx-auto"
            style={cardStyle}
          >
            <p className="text-xs font-bold tracking-widest uppercase text-emerald-500 mb-5">The MAO Formula</p>
            <div className="space-y-3">
              {[
                { icon: TrendingUp, label: 'After-Repair Value (ARV)', op: null },
                { icon: Target, label: 'Target Margin %', op: '×  (1 −' , suffix: ')' },
                { icon: Wrench, label: 'Repair Costs', op: '−' },
                { icon: Clock, label: 'Holding Costs', op: '−' },
                { icon: DollarSign, label: 'Closing Costs', op: '−' },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    i === 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                  }`}>
                    <item.icon className={`w-4 h-4 ${i === 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                  </div>
                  <span className="text-sm font-mono text-muted-foreground w-5 text-center shrink-0">
                    {item.op ?? ''}
                  </span>
                  <span className="text-sm font-semibold">{item.label}{item.suffix ?? ''}</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 mt-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15">
                  <Calculator className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-sm font-mono text-muted-foreground w-5 text-center shrink-0">=</span>
                <span className="text-sm font-bold text-emerald-500">Maximum Allowable Offer</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 3: How FlipOps' MAO Calculator Works ──────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-bold tracking-tight mb-4">How FlipOps&apos; MAO Calculator Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every input is connected to live data. No copy-pasting between tabs, no guessing at costs.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {howItWorksSteps.map((step, i) => (
              <motion.div
                key={step.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl p-8 flex items-start gap-5"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <step.icon className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Why We Built It This Way ───────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-bold tracking-tight mb-4">Why We Built It This Way</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A standalone calculator is a snapshot. FlipOps makes MAO a living number that protects you through the entire deal lifecycle.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {whyBuiltCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl p-8 text-center flex flex-col"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
                  <card.icon className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">{card.desc}</p>
                {card.link && (
                  <Link
                    href={card.link.href}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors mt-5"
                  >
                    {card.link.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Interactive MAO Calculator ─────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            custom={0}
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <Calculator className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Try the Free MAO Calculator</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
              Plug in your own numbers and see the waterfall breakdown instantly. No signup required — just the math.
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 hover:opacity-90">
              <Link href="/tools/mao-calculator" className="inline-flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Open MAO Calculator
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Section 6: CTA ────────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Stop Guessing. Start Underwriting.</h2>
          <p className="text-muted-foreground mb-8">
            See the full MAO waterfall connected to live comps, repair estimates, and margin protection — on a real deal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
