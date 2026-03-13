'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  TrendingDown,
  DollarSign,
  CalendarClock,
  BarChart3,
  ShieldAlert,
  Eye,
  ArrowRight,
  Gauge,
  Target,
  Ban,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true, margin: '-60px' },
};

const staggerChild = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
};

export default function GuardrailsPage() {
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

  const scenarioCardStyle = isDarkMode
    ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.04), 0 2px 8px rgba(0, 0, 0, 0.2)',
      }
    : {
        background: 'linear-gradient(180deg, #fefefe 0%, #f8f8fa 100%)',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(0, 0, 0, 0.04)',
      };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />

      {/* ── Section 1: Hero ──────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Guardrails</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25"
            glowColor="244, 63, 94"
          >
            Financial Protection
          </SectionPill>

          <h1 className="glow-heading-rose text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Every Alert Exists Because We&apos;ve Lost Money Without It
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            FlipOps has built-in financial guardrails that watch your deals for budget overruns, missed deadlines, and margin erosion — before they cost you money.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-4 rounded-2xl px-6 py-4 mt-10 relative z-10"
            style={cardStyle}
          >
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-rose-500">3</p>
              <p className="text-sm text-muted-foreground">guardrail types</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-rose-500">24/7</p>
              <p className="text-sm text-muted-foreground">always watching</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-rose-500">ON</p>
              <p className="text-sm text-muted-foreground">by default</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Why Guardrails Exist ──────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tight text-center mb-6">Why Guardrails Exist</h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14 text-lg leading-relaxed">
              These aren&apos;t theoretical features designed in a vacuum. Every guardrail exists because of a real deal that went wrong.
            </p>
          </motion.div>

          {/* Personal story */}
          <motion.div {...fadeUp} className="rounded-2xl p-8 sm:p-10 mb-12" style={cardStyle}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-500 uppercase tracking-widest mb-1">From the Founder</p>
                <p className="text-lg font-semibold">Tanner built these because he&apos;s an active investor</p>
              </div>
            </div>
            <blockquote className="border-l-2 border-rose-500/30 pl-6 text-muted-foreground leading-relaxed space-y-4">
              <p>
                &ldquo;I built this feature because I lost money on a deal where renovation costs crept past budget line by line — no single invoice was alarming, but by the time I looked at the total, I&apos;d blown through my margin. I never wanted that to happen again.&rdquo;
              </p>
              <p>
                &ldquo;On another deal, I missed an inspection contingency deadline by two days. That mistake cost me an $8,000 extension fee that wiped out a third of my profit. There was no reason for that to happen — I just forgot.&rdquo;
              </p>
            </blockquote>
          </motion.div>

          {/* The broader problem */}
          <motion.div {...staggerContainer} className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Ban,
                title: 'No MAO enforcement',
                desc: 'Nothing in your current stack stops you from making an offer above your Maximum Allowable Offer. You run the numbers, then ignore them.',
              },
              {
                icon: DollarSign,
                title: 'No budget warnings',
                desc: 'You track renovation costs in spreadsheets that don\'t alert you when a category exceeds its budget. You find out when the project is done.',
              },
              {
                icon: CalendarClock,
                title: 'No deadline tracking',
                desc: 'Inspection contingencies, financing deadlines, contract expirations — you manage them in your head or on sticky notes.',
              },
            ].map((item) => (
              <motion.div key={item.title} {...staggerChild} className="rounded-2xl p-7" style={cardStyle}>
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5.5 h-5.5 text-rose-500" />
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div {...fadeUp} className="rounded-2xl p-8 mt-12 text-center" style={cardStyle}>
            <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-lg font-semibold mb-3">The FlipOps Philosophy</h3>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Your platform should actively protect you from the mistakes that cost investors the most money. Not by restricting what you can do — by making sure you&apos;re <span className="text-foreground font-medium">aware of risk</span> before you take it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Section 3: The Three Guardrail Types ─────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tight text-center mb-4">The Three Guardrail Types</h2>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-16">
              Each guardrail type targets a different way investors lose money. Together, they cover the full lifecycle of a deal.
            </p>
          </motion.div>

          {/* ── Budget Alerts ────────────────────────────────────── */}
          <motion.div {...fadeUp} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Budget Alerts</h3>
                <p className="text-sm text-muted-foreground">Catch cost overruns before they eat your margin</p>
              </div>
            </div>

            <div className="rounded-2xl p-8" style={cardStyle}>
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-sm font-bold text-rose-500 uppercase tracking-widest mb-4">How It Works</h4>
                  <ul className="space-y-3">
                    {[
                      'Triggers when spending in any renovation category exceeds the budgeted amount by a configurable threshold (default 10%)',
                      'Shows which category is over, by how much, and the total project impact',
                      'Flags whether the overrun is putting your deal margin at risk',
                      'Tracks every category independently — electrical, plumbing, HVAC, roofing, and more',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <Gauge className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-500 uppercase tracking-widest mb-4">What You See</h4>
                  <ul className="space-y-3">
                    {[
                      'Category name and budgeted vs. actual amount',
                      'Percentage over budget with visual severity indicator',
                      'Project-wide budget impact (are you still in the green overall?)',
                      'Link to the specific invoices or line items causing the overrun',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <Eye className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Real scenario */}
              <div className="rounded-xl p-5 border border-rose-500/20" style={scenarioCardStyle}>
                <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2">Real Scenario</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You budgeted <span className="text-foreground font-semibold">$8,500 for electrical</span> on a flip at 1842 Main St. Actual cost: <span className="text-foreground font-semibold">$9,520 — 12% over</span>. FlipOps flags immediately and shows project-wide impact: total renovation is now at 94% of budget with 3 categories still in progress.
                </p>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <Link href="/features/budget-tracking" className="inline-flex items-center gap-1.5 text-rose-500 hover:text-rose-400 transition-colors font-medium">
                Learn more about budget tracking <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>

          {/* ── Deadline Warnings ────────────────────────────────── */}
          <motion.div {...fadeUp} className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Deadline Warnings</h3>
                <p className="text-sm text-muted-foreground">Never miss a contingency or contract deadline</p>
              </div>
            </div>

            <div className="rounded-2xl p-8" style={cardStyle}>
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4">How It Works</h4>
                  <ul className="space-y-3">
                    {[
                      'Triggers as you approach contingency deadlines, contract expirations, inspection periods, and financing cutoffs',
                      'Escalating urgency — first alert at 7 days, more prominent at 3 days, critical at 24 hours',
                      'Calculates the financial consequence of missing each specific deadline',
                      'Tracks extension cutoff dates so you never miss the window to extend',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <CalendarClock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4">What You See</h4>
                  <ul className="space-y-3">
                    {[
                      'Which deadline and exactly how many days/hours remain',
                      'The financial consequence of missing it (e.g., "$8,000 extension fee")',
                      'Recommended action — complete, extend, or renegotiate',
                      'Quick links to the relevant contract documents',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <Eye className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Real scenario */}
              <div className="rounded-xl p-5 border border-amber-500/20" style={scenarioCardStyle}>
                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Real Scenario</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  892 Oak Ave has an <span className="text-foreground font-semibold">inspection contingency expiring in 5 days</span>. If you don&apos;t complete the inspection or request an extension, you&apos;re at risk of an <span className="text-foreground font-semibold">$8,000 extension fee</span>. FlipOps surfaces this with escalating urgency as the deadline approaches.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Margin Alerts ────────────────────────────────────── */}
          <motion.div {...fadeUp} className="mb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Margin Alerts</h3>
                <p className="text-sm text-muted-foreground">Know instantly when a deal drops below your target return</p>
              </div>
            </div>

            <div className="rounded-2xl p-8" style={cardStyle}>
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-sm font-bold text-violet-500 uppercase tracking-widest mb-4">How It Works</h4>
                  <ul className="space-y-3">
                    {[
                      'Triggers when projected profit margin drops below your configured minimum (default 15%)',
                      'Detects three causes: offer price above MAO, renovation cost overruns, or ARV adjustments',
                      'Recalculates in real-time as deal variables change throughout the lifecycle',
                      'Shows the deal at current numbers so you can make an informed decision',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <BarChart3 className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-violet-500 uppercase tracking-widest mb-4">What You See</h4>
                  <ul className="space-y-3">
                    {[
                      'Current margin vs. your target margin with visual gap indicator',
                      'What caused the drop — pinpoints the specific variable that changed',
                      'Full deal summary: ARV, offer price, repair costs, projected profit',
                      'Recommendation: renegotiate, reduce scope, or proceed with awareness',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <Eye className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Real scenario */}
              <div className="rounded-xl p-5 border border-violet-500/20" style={scenarioCardStyle}>
                <p className="text-xs font-bold text-violet-500 uppercase tracking-widest mb-2">Real Scenario</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  2210 Pine Blvd — ARV: <span className="text-foreground font-semibold">$385,000</span>. Your MAO: <span className="text-foreground font-semibold">$241,000</span>. Offer Price: <span className="text-foreground font-semibold">$255,000</span>. Current Margin: <span className="text-foreground font-semibold">13%</span>. This is below your 15% target margin. FlipOps flags the deal and shows exactly which variable is causing the shortfall.
                </p>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <Link href="/features/margin-alerts" className="inline-flex items-center gap-1.5 text-violet-500 hover:text-violet-400 transition-colors font-medium">
                Learn more about margin alerts <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 4: Why We Didn't Make These Optional ──────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tight text-center mb-4">Why We Didn&apos;t Make These Optional</h2>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-14">
              This is opinionated software design. FlipOps has a point of view.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <motion.div {...fadeUp} className="rounded-2xl p-8" style={cardStyle}>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-5">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Guardrails Are ON by Default</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                You can adjust thresholds — change budget alert sensitivity from 10% to 20%, adjust your target margin from 15% to 12% — but you can&apos;t turn them off entirely.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                This is intentional. We&apos;ve seen too many investors disable protections when they&apos;re excited about a deal, which is exactly when they need protection the most.
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="rounded-2xl p-8" style={cardStyle}>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-5">
                <Zap className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Experience Doesn&apos;t Make You Immune</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Experienced investors are actually <span className="text-foreground font-medium">more susceptible</span> to margin erosion. They move faster, trust their instincts more, and skip the double-check that would have caught the problem.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Guardrails aren&apos;t training wheels. They&apos;re the financial equivalent of a seatbelt — useful at any experience level.
              </p>
            </motion.div>
          </div>

          <motion.div {...fadeUp} className="rounded-2xl p-8 text-center" style={cardStyle}>
            <div className="w-14 h-14 rounded-xl bg-rose-500/10 flex items-center justify-center mx-auto mb-5">
              <Target className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="text-lg font-semibold mb-3">Our Point of View</h3>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed text-[15px]">
              Your platform should <span className="text-foreground font-medium">protect you</span>, not just <span className="text-foreground font-medium">enable you</span>. Most RE investing software gives you tools but not protection. Nothing stops you from ignoring your own MAO. Nothing alerts you when you blow past budget. Nothing reminds you before an inspection contingency expires. FlipOps is different.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Section 5: CTA ───────────────────────────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl font-bold tracking-tight mb-4">Invest With Protection, Not Just Tools</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              See how guardrails watch your deals for budget overruns, missed deadlines, and margin erosion — in real time.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">View Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-gradient-to-r from-rose-500 to-rose-600 text-white border-0 hover:opacity-90">
                <Link href="/reserve">Reserve Your Spot</Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <Link href="/features/margin-alerts" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                Margin Alerts <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/features/budget-tracking" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                Budget Tracking <ArrowRight className="w-3 h-3" />
              </Link>
              <Link href="/features/deal-pipeline" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
                Deal Pipeline <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
