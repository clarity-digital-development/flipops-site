'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Search,
  Phone,
  DollarSign,
  Filter,
  Zap,
  ChevronRight,
  Users,
  Building2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Upload,
  Layers,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* -- How FlipOps does it steps ---------------------------------------- */
const pipelineSteps = [
  {
    num: '01',
    title: 'Score Crosses Threshold',
    desc: 'When a property\'s distress score crosses your configurable threshold (default 70+), skip tracing fires automatically. No manual trigger needed.',
    icon: Filter,
  },
  {
    num: '02',
    title: 'Contact Info Pulled',
    desc: 'Owner name, phone numbers, email addresses, and mailing address are enriched from multiple data sources — including hard-to-find LLC and trust-held owners.',
    icon: Phone,
  },
  {
    num: '03',
    title: 'Lead Record Populated',
    desc: 'Traced contact info immediately populates the Lead record inside FlipOps. No export, no CSV upload, no switching between platforms.',
    icon: Zap,
  },
];

/* -- Enrichment capabilities ------------------------------------------ */
const enrichmentCards = [
  {
    title: 'LLC-Owned Properties',
    desc: 'Multi-source enrichment pierces through LLC registrations to identify the actual decision-maker behind the entity.',
    icon: Building2,
    color: 'teal',
  },
  {
    title: 'Trust-Held Properties',
    desc: 'Identifies trustees and beneficiaries for properties held in living trusts, family trusts, and irrevocable trusts.',
    icon: ShieldCheck,
    color: 'teal',
  },
  {
    title: 'Probate Situations',
    desc: 'Cross-references probate filings with property records to locate heirs and personal representatives.',
    icon: Users,
    color: 'teal',
  },
];

export default function SkipTracingPage() {
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

  /* Cost math values */
  const leadsPerMonth = 500;
  const costPerTrace = 0.15;
  const thresholdFilter = 0.6;
  const tracedWithFlipOps = leadsPerMonth * (1 - thresholdFilter);
  const costBefore = leadsPerMonth * costPerTrace;
  const costAfter = tracedWithFlipOps * costPerTrace;
  const annualSavings = (costBefore - costAfter) * 12;

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />

      {/* -- Section 1: Hero ------------------------------------------- */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Skip Tracing</span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25"
            glowColor="20, 184, 166"
          >
            Smart Skip Tracing
          </SectionPill>

          <h1 className="glow-heading-teal text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            Owner Contact Info, Automatically — No Manual Lookups
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto relative z-10 mb-8">
            FlipOps skip traces only the leads worth pursuing. When a property crosses your score threshold, owner contact info is pulled automatically.
          </p>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="inline-flex items-center gap-3 rounded-2xl px-6 py-4 relative z-10"
            style={cardStyle}
          >
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-teal-500">60%</p>
              <p className="text-sm text-muted-foreground">fewer traces needed</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-left">
              <p className="text-3xl sm:text-4xl font-bold text-teal-500">$0</p>
              <p className="text-sm text-muted-foreground">wasted on dead leads</p>
            </div>
            <div className="w-px h-12 bg-border hidden sm:block" />
            <div className="text-left hidden sm:block">
              <p className="text-3xl sm:text-4xl font-bold text-teal-500">0</p>
              <p className="text-sm text-muted-foreground">CSV uploads required</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* -- Section 2: How Skip Tracing Usually Works ------------------ */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            How Skip Tracing Usually Works
          </h2>
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              Most platforms follow the same workflow: build a list, bulk skip trace the entire list, pay per record. Whether you use BatchSkipTracing, REISkip, or any other provider, the process is the same — you&apos;re paying to trace every lead on the list regardless of quality.
            </p>
            <p className="text-lg">
              The waste is predictable. If <span className="text-foreground font-semibold">40–60% of your leads are low-quality</span>, you&apos;re spending 40–60% of your skip tracing budget on contacts you&apos;ll never use. Those are phone numbers you&apos;ll never dial. Addresses you&apos;ll never mail. Money that disappears into a CSV file.
            </p>

            {/* Waste visualization */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-red-500" />
                  </div>
                  <h4 className="font-semibold text-foreground">The Typical Workflow</h4>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>Pull a list of 500 properties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>Bulk skip trace all 500 — $75 at $0.15/record</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>300 of those leads are low-quality — $45 wasted</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>Export CSV, import to CRM, manually match records</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-teal-500" />
                  </div>
                  <h4 className="font-semibold text-foreground">The Core Problem</h4>
                </div>
                <p className="text-sm leading-relaxed">
                  Skip tracing is disconnected from lead quality. You trace first, evaluate later. By the time you realize a lead is dead, you&apos;ve already paid for the trace. There&apos;s no intelligence layer between &ldquo;I have a list&rdquo; and &ldquo;I traced it.&rdquo;
                </p>
                <div className="mt-4 rounded-lg bg-red-500/5 border border-red-500/10 px-4 py-3">
                  <p className="text-sm text-foreground font-medium">
                    At $0.15/trace and 500 leads/month, that&apos;s <span className="text-red-500">$540/year wasted</span> on leads you&apos;d never call.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Section 3: How FlipOps Does It ----------------------------- */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <SectionPill
              pillClassName="bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25"
              glowColor="20, 184, 166"
              staggerIndex={1}
            >
              <Zap className="w-4 h-4" />
              Score-Triggered Tracing
            </SectionPill>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-6 mb-4 relative z-10">
              How FlipOps Does It
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto relative z-10">
              Skip tracing is integrated directly into the scoring pipeline. No manual step. No bulk uploads. No wasted spend.
            </p>
          </div>

          {/* 3-step pipeline */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {pipelineSteps.map((step) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: parseInt(step.num) * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl p-8 text-center"
                style={cardStyle}
              >
                <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-7 h-7 text-teal-500" />
                </div>
                <span className="text-xs font-semibold text-teal-500 tracking-widest uppercase">{step.num}</span>
                <h3 className="text-xl font-semibold mt-2 mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Threshold + integration detail cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-4">
                <Filter className="w-5 h-5 text-teal-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Configurable Threshold</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The default threshold is 70+, but it&apos;s fully adjustable. Running a high-volume wholesale operation? Lower it to 60 to cast a wider net. Focused on high-quality flips? Raise it to 80+ to only trace the highest-conviction leads. The threshold is yours to control.
              </p>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-teal-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Integrated Into the Pipeline</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Traced contact info immediately populates the Lead record. No exporting a list from one platform, uploading it to a skip trace provider, downloading the results, and importing them into your CRM. The data flows through one system — from{' '}
                <Link href="/features/distress-scoring" className="text-teal-500 hover:underline">distress scoring</Link> to contact enrichment to outreach.
              </p>
            </div>
          </div>

          {/* Deep enrichment */}
          <h3 className="text-2xl font-bold tracking-tight mb-6">Deep Enrichment for Hard-to-Find Owners</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {enrichmentCards.map((card) => (
              <div key={card.title} className="rounded-xl p-5 flex items-start gap-4" style={cardStyle}>
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                  <card.icon className="w-5 h-5 text-teal-500" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">{card.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Section 4: The Cost Math ----------------------------------- */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-4">
            The Cost Math
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Score-triggered tracing isn&apos;t a marginal improvement — it&apos;s a structural cost reduction that compounds every month.
          </p>

          {/* Before / After comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {/* Before */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="rounded-2xl p-8"
              style={cardStyle}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold">Without FlipOps</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Leads generated / month</span>
                  <span className="font-semibold text-foreground">{leadsPerMonth}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Leads skip traced</span>
                  <span className="font-semibold text-foreground">{leadsPerMonth} (all of them)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Cost per trace</span>
                  <span className="font-semibold text-foreground">${costPerTrace.toFixed(2)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Monthly skip trace cost</span>
                  <span className="font-bold text-red-500 text-lg">${costBefore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Annual cost</span>
                  <span className="font-bold text-red-500">${(costBefore * 12).toFixed(0)}</span>
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 px-4 py-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-red-500 font-semibold">~{(thresholdFilter * 100).toFixed(0)}% wasted</span> — tracing leads you&apos;ll never pursue
                  </p>
                </div>
              </div>
            </motion.div>

            {/* After */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="rounded-2xl p-8"
              style={cardStyle}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-teal-500" />
                </div>
                <h3 className="text-xl font-semibold">With FlipOps</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Leads generated / month</span>
                  <span className="font-semibold text-foreground">{leadsPerMonth}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Leads that cross threshold</span>
                  <span className="font-semibold text-teal-500">{tracedWithFlipOps} (score 70+)</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Cost per trace</span>
                  <span className="font-semibold text-foreground">${costPerTrace.toFixed(2)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Monthly skip trace cost</span>
                  <span className="font-bold text-teal-500 text-lg">${costAfter.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Annual cost</span>
                  <span className="font-bold text-teal-500">${(costAfter * 12).toFixed(0)}</span>
                </div>
                <div className="rounded-lg bg-teal-500/5 border border-teal-500/10 px-4 py-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-teal-500 font-semibold">${annualSavings.toFixed(0)}/year saved</span> — only tracing qualified leads
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Summary callout */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-500" />
              </div>
              <h3 className="text-lg font-semibold">The Takeaway</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This is a conservative estimate using $0.15/trace and a 60% filter rate. Many investors run 1,000+ leads/month, where the savings double. And this doesn&apos;t account for the time saved — no more exporting lists, uploading CSVs, waiting for results, and manually importing contacts back into your CRM. The entire workflow collapses into a single automated pipeline triggered by{' '}
              <Link href="/features/distress-scoring" className="text-teal-500 hover:underline">distress score</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* -- Section 5: CTA --------------------------------------------- */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">See Skip Tracing in Action</h2>
          <p className="text-muted-foreground mb-8">
            Watch how FlipOps automatically traces owner contact info when properties cross your score threshold — no manual lookups, no wasted spend.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button asChild size="lg" className="bg-gradient-to-r from-teal-500 to-teal-600 text-white border-0 hover:opacity-90">
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-teal-500 hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
