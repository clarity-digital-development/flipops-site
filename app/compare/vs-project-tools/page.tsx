'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Check,
  X,
  ChevronRight,
  Calculator,
  SearchX,
  Wrench,
  Search,
  Phone,
  FileSignature,
  Hammer,
  Home,
  BarChart3,
  ThumbsUp,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

const features = [
  { capability: 'Renovation Budget Tracking', project: true, flipops: true, flipopsNote: 'RE-specific' },
  { capability: 'Gantt Charts / Timelines', project: true, flipops: true, flipopsNote: null },
  { capability: 'Vendor / Contractor Management', project: true, flipops: true, flipopsNote: 'Built-in' },
  { capability: 'Draw Scheduling', project: 'Some', flipops: true, flipopsNote: null },
  { capability: 'Property Data & Leads', project: false, flipops: true, flipopsNote: null },
  { capability: 'AI Distress Scoring', project: false, flipops: true, flipopsNote: 'ML-powered' },
  { capability: 'CRM & Lead Pipeline', project: false, flipops: true, flipopsNote: null },
  { capability: 'Multi-Channel Outreach', project: false, flipops: true, flipopsNote: null },
  { capability: 'Skip Trace Integration', project: false, flipops: true, flipopsNote: 'Built-in' },
  { capability: 'MAO Calculator', project: false, flipops: true, flipopsNote: null },
  { capability: 'Comp Analysis & ARV', project: false, flipops: true, flipopsNote: null },
  { capability: 'Contract Management', project: false, flipops: true, flipopsNote: null },
  { capability: 'Financial Guardrails', project: false, flipops: true, flipopsNote: 'Margin + budget alerts' },
  { capability: 'Rental / Hold Management', project: false, flipops: true, flipopsNote: null },
  { capability: 'Deal Economics (ROI, margins)', project: false, flipops: true, flipopsNote: null },
  { capability: 'Underwriting Continuity', project: false, flipops: true, flipopsNote: 'Original numbers travel with the deal' },
];

const workflowStages = [
  {
    icon: Search,
    label: 'Find Deals',
    desc: 'Data, scoring, leads',
    projectCovers: false,
  },
  {
    icon: Phone,
    label: 'Reach Out',
    desc: 'CRM & outreach',
    projectCovers: false,
  },
  {
    icon: FileSignature,
    label: 'Close',
    desc: 'Offers & contracts',
    projectCovers: false,
  },
  {
    icon: Hammer,
    label: 'Renovate',
    desc: 'Tasks & vendors',
    projectCovers: true,
  },
  {
    icon: Home,
    label: 'Hold/Sell',
    desc: 'Rentals & exits',
    projectCovers: false,
  },
  {
    icon: BarChart3,
    label: 'Report',
    desc: 'ROI & financials',
    projectCovers: false,
  },
];

const painPoints = [
  {
    icon: Calculator,
    title: 'No Deal Economics',
    desc: "Project tools track tasks and budgets, but they don\u2019t understand ARV, MAO, or profit margins. You can\u2019t calculate deal viability.",
    detail:
      'Without built-in deal economics, you need a separate spreadsheet for every property to figure out if the numbers work. FlipOps calculates MAO, ARV, and margins natively.',
  },
  {
    icon: SearchX,
    title: 'No Lead Pipeline',
    desc: "You need a separate system to find and manage leads. The project tool only kicks in after you\u2019ve already found and closed the deal.",
    detail:
      'Project tools manage the middle of your workflow. Everything before (finding deals) and after (rental management, financial reporting) requires separate solutions.',
  },
  {
    icon: Wrench,
    title: 'Generic, Not Investor-Built',
    desc: "Every workflow needs custom configuration. No distress scoring, no guardrails, no rental management. You\u2019re adapting a generic tool instead of using one built for your workflow.",
    detail:
      'You spend hours building custom fields, automations, and dashboards that approximate what FlipOps does out of the box. Updates break your custom workflows.',
  },
];

const projectStrengths = [
  'Detailed budget tracking with line-item granularity',
  'Gantt charts and timeline visualization',
  'Vendor and contractor management with payment tracking',
  'Draw scheduling and lender communication tools',
];

export default function VsProjectToolsPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  const cardStyle = isDarkMode
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
    <div className="min-h-screen bg-white dark:bg-black">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-x-clip bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-8">
            <Link
              href="/"
              className="hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Compare</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">
              vs Project Tools
            </span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25"
            glowColor="168, 85, 247"
          >
            <ArrowLeftRight className="w-4 h-4" />
            How We Compare
          </SectionPill>

          <h1 className="glow-heading-purple text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            FlipOps vs. Project Management Tools
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            Project tools manage the rehab. They have no idea where the deal
            came from — or whether the original underwriting was sound.
          </p>
        </div>
      </section>

      {/* What Are Project Management Tools */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-6">
            What Are Project Management Tools?
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed text-center mb-10">
            Project management tools in real estate investing are platforms focused
            on rehab and renovation tracking, budgeting, and contractor management.
            They help you manage the construction phase — scheduling tasks, tracking
            costs against budgets, coordinating vendors, and managing draw requests
            with lenders.
          </p>

          <div className="rounded-2xl p-8" style={cardStyle}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-purple-500" />
              What They Do Well
            </h3>
            <ul className="space-y-3">
              {projectStrengths.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What They're Missing */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-6">
            What They&apos;re Missing
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
            Project tools manage the rehab — but they have no context on how the deal got there or what happens after.
          </p>
          <div className="space-y-4">
            {[
              {
                title: 'Zero Lead Generation',
                desc: 'No property data, no list building, no skip tracing. You need a completely separate system to find deals before the project tool even enters the picture.',
              },
              {
                title: 'Zero CRM or Outreach',
                desc: 'No contact management, no dialer, no drip campaigns, no follow-up automation. The entire acquisition phase happens outside the tool.',
              },
              {
                title: 'No Deal Pipeline or Scoring',
                desc: 'No way to track deals from lead to contract. No distress scoring, no MAO calculation, no comp analysis. You can\'t evaluate whether a deal is worth starting.',
              },
              {
                title: 'No Underwriting Continuity',
                desc: 'The project tool doesn\'t know your original ARV, your MAO assumptions, or your target margins. If renovation costs spike past your underwriting, nobody alerts you — because the tool doesn\'t have the original numbers.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-6"
                style={cardStyle}
              >
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Coverage Visual */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            Workflow Coverage
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Project tools cover one stage. FlipOps covers all six.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {workflowStages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-2xl p-5 text-center relative"
                style={cardStyle}
              >
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <stage.icon className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-sm font-semibold mb-0.5">
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {stage.desc}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5">
                    {stage.projectCovers ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Project
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                      FlipOps
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-14">
            Feature Comparison
          </h2>
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">
                    Capability
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-muted-foreground">
                    Project Tool
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-purple-600 dark:text-purple-400">
                    FlipOps
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr
                    key={f.capability}
                    className={
                      i < features.length - 1
                        ? 'border-b border-black/5 dark:border-white/5'
                        : ''
                    }
                  >
                    <td className="px-6 py-3.5 text-sm font-medium">
                      {f.capability}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {f.project === true ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : f.project === false ? (
                        <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {f.project}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {f.flipops === true ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Check className="w-5 h-5 text-emerald-500" />
                          {f.flipopsNote && (
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                              {f.flipopsNote}
                            </span>
                          )}
                        </div>
                      ) : (
                        <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What You Give Up */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            What You Give Up
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            The trade-offs of using a general tool for a specialized
            workflow.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl p-8"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5">
                  <p.icon className="w-6 h-6 text-purple-500" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {p.desc}
                </p>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  {p.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Should Choose What */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-14">
            Which Is Right for You?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl p-8" style={cardStyle}>
              <h3 className="text-lg font-semibold mb-4">A project tool might be enough if...</h3>
              <ul className="space-y-3">
                {[
                  'You only do rehabs and already have a separate system for finding and closing deals',
                  'You don\'t need lead generation, CRM, or outreach — someone else handles acquisitions',
                  'You\'re a GC or project manager, not the investor making deal decisions',
                  'You only need task and budget tracking for active renovations',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-2xl p-8 ring-1 ring-purple-500/20"
              style={cardStyle}
            >
              <h3 className="text-lg font-semibold mb-4 text-purple-600 dark:text-purple-400">
                FlipOps is built for you if...
              </h3>
              <ul className="space-y-3">
                {[
                  'You\'re the investor — you find deals, close them, renovate, and exit',
                  'You want your original underwriting numbers to follow the deal through renovation',
                  'You need financial guardrails that alert you when rehab costs threaten your margins',
                  'You want lead generation, CRM, project management, and rental tracking in one tool',
                  'You\'re tired of using 4+ tools that don\'t talk to each other',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-12 bg-white dark:bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm text-muted-foreground text-center mb-4">
            See how FlipOps compares to other categories:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/compare/vs-traditional-crms">vs Traditional CRMs</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/compare/vs-data-platforms">vs Data Platforms</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#f4f4f6] dark:bg-black">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            See the Full Platform
          </h2>
          <p className="text-muted-foreground mb-8">
            Purpose-built for real estate investors. No adapting required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0 hover:opacity-90"
            >
              <Link href="/reserve">Reserve Your Spot</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
