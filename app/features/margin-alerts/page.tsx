'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  TrendingDown,
  AlertTriangle,
  Target,
  Shield,
  ArrowRight,
  ArrowDownRight,
  CheckCircle2,
  Settings2,
  BarChart3,
  Search,
  Wrench,
  Clock,
  DollarSign,
  XCircle,
  Handshake,
  Calculator,
  CalendarClock,
  Gauge,
  Layers,
  MinusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ── Margin stages data ──────────────────────────────────────── */
const marginStages = [
  {
    stage: 'Underwriting',
    desc: 'Initial margin based on ARV estimate, projected repairs, and offer price. This is your best guess before you own the property.',
    dataPoints: ['Estimated ARV from comps', 'Projected repair budget', 'Offer price and closing costs', 'Estimated holding timeline'],
    margin: '22%',
    color: 'emerald',
  },
  {
    stage: 'Under Contract',
    desc: 'Inspection results refine the repair estimate. Appraisal data may adjust the ARV. Margin narrows or widens based on real findings.',
    dataPoints: ['Inspection report findings', 'Updated repair scope', 'Appraisal data (if available)', 'Refined holding cost estimate'],
    margin: '20%',
    color: 'emerald',
  },
  {
    stage: 'Renovation',
    desc: 'Actual invoices replace estimates. Change orders adjust scope. Every approved cost updates the margin in real time.',
    dataPoints: ['Approved invoices vs. budget', 'Change order impact', 'Schedule delays and holding cost accrual', 'Material cost changes'],
    margin: '17%',
    color: 'amber',
  },
  {
    stage: 'Listing / Disposition',
    desc: 'Market feedback adjusts the expected sale price. Days on market extend holding costs. Final margin crystallizes at close.',
    dataPoints: ['List price vs. ARV', 'Showing feedback and offers', 'Days on market', 'Final sale price and net proceeds'],
    margin: '15%',
    color: 'rose',
  },
];

/* ── Threshold strategy examples ─────────────────────────────── */
const strategies = [
  {
    type: 'Wholesalers',
    icon: Handshake,
    target: '8-12%',
    desc: 'Lower absolute margins, higher velocity. Wholesalers make money on volume — a $5K assignment fee on a $200K property is 2.5%, and that can be fine if you close 4 deals a month.',
    alert: 'Alert when projected margin drops below 6% — at that point the deal may not cover your marketing and acquisition costs.',
  },
  {
    type: 'Flippers',
    icon: Wrench,
    target: '18-25%',
    desc: 'Higher margins to absorb renovation risk and holding costs. A 6-month project with $50K in repairs needs significant margin to justify the capital, risk, and opportunity cost.',
    alert: 'Alert when projected margin drops below 15% — renovation surprises and holding cost overruns can eat the remaining margin fast.',
  },
  {
    type: 'BRRRR Investors',
    icon: Calculator,
    target: '20-30%',
    desc: 'Margin matters at acquisition, but the real metric is cash-on-cash return after refinance. You need enough equity to refinance out your capital.',
    alert: 'Alert when the deal no longer supports a cash-out refinance at your target LTV — that changes the entire thesis.',
  },
];

/* ── Compound erosion scenario ───────────────────────────────── */
const erosionSteps = [
  {
    event: 'Offered $5K over MAO to win the deal',
    impact: '-2.0%',
    running: '20.0%',
    felt: 'Small — "it\'s only $5K to lock it up"',
    icon: DollarSign,
  },
  {
    event: 'Foundation repair came in $3K over estimate',
    impact: '-1.5%',
    running: '18.5%',
    felt: 'Manageable — "can\'t skip foundation work"',
    icon: Wrench,
  },
  {
    event: 'ARV adjusted down $8K after new comps',
    impact: '-2.0%',
    running: '16.5%',
    felt: 'Concerning — "but the market will recover"',
    icon: TrendingDown,
  },
  {
    event: 'Renovation extended 2 months (holding costs)',
    impact: '-1.5%',
    running: '15.0%',
    felt: 'Stressful — "we\'re almost done though"',
    icon: CalendarClock,
  },
];

/* ── Response actions ────────────────────────────────────────── */
const responseActions = [
  {
    action: 'Renegotiate',
    desc: 'If you\'re still under contract or early in renovation, go back to the seller with new findings. Inspection results and cost discoveries are legitimate renegotiation triggers.',
    icon: Handshake,
    color: 'emerald',
  },
  {
    action: 'Value-Engineer the Rehab',
    desc: 'Review the scope of work and find where you can reduce costs without reducing ARV. Refinished cabinets instead of new. LVP instead of hardwood. Cosmetic where structural isn\'t needed.',
    icon: Wrench,
    color: 'blue',
  },
  {
    action: 'Adjust the Timeline',
    desc: 'If holding costs are the issue, accelerate the renovation. Pay overtime, overlap trades, front-load material orders. Time is literally money in a flip.',
    icon: Clock,
    color: 'amber',
  },
  {
    action: 'Walk Away',
    desc: 'Sometimes the right call is to exit. Earnest money and inspection costs are sunk costs — don\'t let them anchor you to a bad deal. A $2K loss is better than a $20K loss.',
    icon: XCircle,
    color: 'rose',
  },
];

export default function MarginAlertsPage() {
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
            <span className="text-foreground font-medium">Margin Alerts</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25"
            glowColor="244, 63, 94"
          >
            Margin Protection
          </SectionPill>

          <h1 className="glow-heading-rose text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Know the Moment Your Margin Is at Risk
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            FlipOps monitors projected profit margins in real-time and alerts you the moment a deal drops below your target.
          </p>

          {/* Hero alert mock */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-4 rounded-2xl px-6 py-4 relative z-10 border border-rose-500/20"
            style={cardStyle}
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-rose-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Margin Alert: 1847 Riverside Dr</p>
              <p className="text-sm text-muted-foreground">Projected margin dropped from 22% to 15.0% — below your 18% target</p>
            </div>
            <div className="w-px h-10 bg-border hidden sm:block" />
            <div className="text-left hidden sm:block">
              <p className="text-2xl font-bold text-rose-500">-7%</p>
              <p className="text-xs text-muted-foreground">margin erosion</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: How Margin Is Calculated ─────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            How Margin Updates Through the Pipeline
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            Your projected margin isn&apos;t static. Each stage of the deal lifecycle adds data that refines the calculation — and FlipOps recalculates at every step.
          </p>

          {/* Stage progression */}
          <div className="space-y-6">
            {marginStages.map((stage, idx) => (
              <motion.div
                key={stage.stage}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                  <div className="flex items-center gap-4 sm:w-48 shrink-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      { emerald: 'bg-emerald-500/10', amber: 'bg-amber-500/10', rose: 'bg-rose-500/10', red: 'bg-red-500/10', blue: 'bg-blue-500/10' }[stage.color] || 'bg-gray-500/10'
                    }`}>
                      <span className="text-sm font-bold text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{stage.stage}</h3>
                      <p className={`text-lg font-bold ${
                        { emerald: 'text-emerald-500', amber: 'text-amber-500', rose: 'text-rose-500', red: 'text-red-500', blue: 'text-blue-500' }[stage.color] || 'text-gray-500'
                      }`}>{stage.margin}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{stage.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {stage.dataPoints.map((point) => (
                        <span key={point} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                          <Gauge className="w-3 h-3" />
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {idx < marginStages.length - 1 && (
                  <div className="flex justify-center mt-4">
                    <ArrowDownRight className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Configurable Thresholds ──────────────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-rose-500 to-rose-600 shadow-lg shadow-rose-500/25"
              glowColor="244, 63, 94"
              staggerIndex={1}
            >
              <Settings2 className="w-4 h-4" />
              Configurable Thresholds
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              Set Targets That Match Your Strategy
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Different strategies have different margin requirements. A wholesaler doing 10 deals a month operates on different math than a flipper doing 2 deals a quarter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {strategies.map((s, idx) => (
              <motion.div
                key={s.type}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                  <s.icon className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{s.type}</h3>
                <p className="text-2xl font-bold text-rose-500 mb-3">{s.target}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                <div className="rounded-lg bg-rose-500/5 border border-rose-500/10 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    <Bell className="w-3 h-3 text-rose-500 inline mr-1 -mt-0.5" />
                    {s.alert}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Compound Erosion Example ─────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            How Margin Death by a Thousand Cuts Actually Works
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            No single change kills a deal. It&apos;s the accumulation of small, individually reasonable decisions that compound into a margin crisis. Here&apos;s a real-world example.
          </p>

          <div className="rounded-2xl p-8" style={cardStyle}>
            {/* Starting point */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Starting projected margin</p>
                <p className="text-2xl font-bold text-emerald-500">22.0%</p>
              </div>
            </div>

            {/* Erosion steps */}
            <div className="space-y-4">
              {erosionSteps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.15 }}
                  viewport={{ once: true }}
                  className="rounded-xl p-5 border border-border"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                        <step.icon className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{step.event}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 italic">&ldquo;{step.felt}&rdquo;</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-rose-500">{step.impact}</p>
                        <p className="text-[10px] text-muted-foreground">impact</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-right">
                        <p className={`text-sm font-bold ${parseFloat(step.running) < 18 ? 'text-rose-500' : 'text-foreground'}`}>{step.running}%</p>
                        <p className="text-[10px] text-muted-foreground">projected</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Result callout */}
            <div className="rounded-xl bg-rose-500/5 border border-rose-500/15 p-5 mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Total margin erosion: 22% to 15%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No single change felt alarming. Each decision was individually defensible. But the cumulative effect was a 7-point margin drop — from a comfortable deal to a deal that barely covers your cost of capital.
                    </p>
                  </div>
                </div>
                <div className="text-center sm:text-right shrink-0">
                  <p className="text-3xl font-bold text-rose-500">-7%</p>
                  <p className="text-xs text-muted-foreground">total erosion</p>
                </div>
              </div>
            </div>

            {/* Without alerts vs with alerts */}
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div className="rounded-xl p-4 border border-red-500/10 bg-red-500/5">
                <p className="text-sm font-semibold text-foreground mb-2">
                  <XCircle className="w-4 h-4 text-red-500 inline mr-1.5 -mt-0.5" />
                  Without margin alerts
                </p>
                <p className="text-sm text-muted-foreground">
                  You discover the margin erosion at closing, when it&apos;s too late to do anything about it. The deal closed. You made less than you thought. You might not even realize how much less until tax time.
                </p>
              </div>
              <div className="rounded-xl p-4 border border-emerald-500/10 bg-emerald-500/5">
                <p className="text-sm font-semibold text-foreground mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 inline mr-1.5 -mt-0.5" />
                  With FlipOps margin alerts
                </p>
                <p className="text-sm text-muted-foreground">
                  You get alerted after the second change — when margin drops below your 18% target. You still have time to renegotiate, value-engineer the rehab, or adjust your timeline before the damage compounds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: What To Do When You Get an Alert ─────────── */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            What To Do When You Get an Alert
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-14">
            A margin alert isn&apos;t a failure — it&apos;s an early warning. The sooner you know, the more options you have.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {responseActions.map((item, idx) => (
              <motion.div
                key={item.action}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                  { emerald: 'bg-emerald-500/10', blue: 'bg-blue-500/10', amber: 'bg-amber-500/10', rose: 'bg-rose-500/10', purple: 'bg-purple-500/10', red: 'bg-red-500/10' }[item.color] || 'bg-gray-500/10'
                }`}>
                  <item.icon className={`w-5 h-5 ${
                    { emerald: 'text-emerald-500', blue: 'text-blue-500', amber: 'text-amber-500', rose: 'text-rose-500', purple: 'text-purple-500', red: 'text-red-500' }[item.color] || 'text-gray-500'
                  }`} />
                </div>
                <h3 className="text-base font-semibold mb-2">{item.action}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-2xl p-6 mt-8" style={cardStyle}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Alerts Are Part of a System</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Margin alerts work alongside FlipOps&apos;{' '}
                  <Link href="/features/guardrails" className="text-rose-500 hover:underline">guardrails</Link> and{' '}
                  <Link href="/features/budget-tracking" className="text-rose-500 hover:underline">budget tracking</Link>.
                  When a margin alert fires, you can drill into exactly which cost category caused the change, which invoice triggered the budget variance, and what your options are — all without leaving the platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: CTA ──────────────────────────────────────── */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Margin Alerts in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps monitors your projected margins in real-time and alerts you before small changes compound into big problems.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-rose-500 to-rose-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-rose-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>

          {/* Cross-links */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">Related Features</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { label: 'Guardrails', href: '/features/guardrails' },
                { label: 'Budget Tracking', href: '/features/budget-tracking' },
                { label: 'Deal Pipeline', href: '/features/deal-pipeline' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-rose-500/30"
                >
                  {link.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
