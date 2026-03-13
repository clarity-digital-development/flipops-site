'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Check,
  X,
  ChevronRight,
  EyeOff,
  ShieldOff,
  Layers,
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
  { capability: 'Lead Scoring', traditional: 'Manual tags / basic rules', flipops: true, flipopsNote: 'ML-powered' },
  { capability: 'Behavioral Learning', traditional: false, flipops: true, flipopsNote: 'Adapts to your strategy' },
  { capability: 'Skip Trace Integration', traditional: 'Add-on', flipops: true, flipopsNote: 'Built-in' },
  { capability: 'Deal Pipeline', traditional: true, flipops: true, flipopsNote: null },
  { capability: 'MAO Calculator', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Comp Analysis & ARV', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Renovation Tracking', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Budget Alerts', traditional: false, flipops: true, flipopsNote: 'Real-time' },
  { capability: 'Vendor Management', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Rental Tracking', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Margin Alerts', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Deadline Warnings', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Portfolio Analytics', traditional: 'Basic', flipops: true, flipopsNote: 'Full lifecycle' },
  { capability: 'Data Continuity (Lead to Exit)', traditional: false, flipops: true, flipopsNote: null },
  { capability: 'Multi-Channel Outreach', traditional: true, flipops: true, flipopsNote: null },
  { capability: 'Title / Closing Integration', traditional: false, flipops: 'soon', flipopsNote: 'Coming Soon' },
];

const lifecycleStages = [
  { icon: Search, label: 'Find', desc: 'Data & Leads', covered: true, crmCovered: false },
  { icon: Phone, label: 'Contact', desc: 'Outreach & CRM', covered: true, crmCovered: true },
  { icon: FileSignature, label: 'Close', desc: 'Contracts & Offers', covered: true, crmCovered: true },
  { icon: Hammer, label: 'Renovate', desc: 'Project & Vendors', covered: true, crmCovered: false },
  { icon: Home, label: 'Hold/Sell', desc: 'Rentals & Exits', covered: true, crmCovered: false },
  { icon: BarChart3, label: 'Report', desc: 'Financial Analytics', covered: true, crmCovered: false },
];

const painPoints = [
  {
    icon: EyeOff,
    title: 'Post-Close Blind Spot',
    desc: 'After closing, you switch to spreadsheets for renovation budgets, vendor payments, and rental tracking. Your CRM has no idea what happens next.',
    detail: 'Renovation overruns, missed vendor payments, and rental vacancies all happen outside your CRM. You lose visibility exactly when the money is at risk.',
  },
  {
    icon: ShieldOff,
    title: 'No Financial Guardrails',
    desc: 'No automated alerts when budgets spike or margins shrink. You find out at closing — or worse, after.',
    detail: 'FlipOps monitors 12+ cost categories per deal and alerts you the moment budgets trend over threshold — before the damage is done.',
  },
  {
    icon: Layers,
    title: 'Tool Stack Tax',
    desc: 'You still need separate tools for data, skip tracing, project management, and rental tracking. $400+/month in fragmented subscriptions.',
    detail: 'Each tool means another login, another data silo, and another monthly bill. The real cost is the time you spend moving data between them.',
  },
];

const crmStrengths = [
  'Multi-channel outreach workflows (SMS, email, direct mail, dialer)',
  'Lead status tracking and disposition management',
  'Team management and role-based permissions',
  'Drip campaign and follow-up automation',
];

export default function VsTraditionalCRMsPage() {
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
              vs Traditional CRMs
            </span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25"
            glowColor="45, 212, 191"
          >
            <ArrowLeftRight className="w-4 h-4" />
            How We Compare
          </SectionPill>

          <h1 className="glow-heading-teal text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            FlipOps vs. Traditional Investor CRMs
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            Most investor CRMs stop at the closing table. FlipOps manages
            the entire lifecycle — from lead scoring to rental management.
          </p>
        </div>
      </section>

      {/* What Are Traditional RE Investor CRMs */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-6">
            What Are Traditional RE Investor CRMs?
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed text-center mb-10">
            Traditional real estate investor CRMs are platforms focused on lead management,
            outreach, and deal tracking. They help you organize contacts, run marketing
            campaigns, manage your pipeline from initial contact to contract, and
            coordinate your acquisition team.
          </p>

          <div className="rounded-2xl p-8" style={cardStyle}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-teal-500" />
              What They Do Well
            </h3>
            <ul className="space-y-3">
              {crmStrengths.map((s) => (
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
            The capabilities that traditional CRMs were never designed to provide.
          </p>
          <div className="space-y-4">
            {[
              {
                title: 'ML-Powered Scoring',
                desc: 'Most traditional CRMs use manual tags or basic rule-based lead scoring. No machine learning that adapts to your deal preferences over time, no distress signals, no behavioral pattern recognition.',
              },
              {
                title: 'Post-Close Management',
                desc: 'Zero renovation tracking, zero rental management. Once the contract is signed, the CRM\'s job is done. You\'re left with spreadsheets and a separate project management tool.',
              },
              {
                title: 'Title & Closing Integration',
                desc: 'No direct connection to title companies or closing workflows. Contract-to-close is managed through email threads and manual status updates.',
              },
              {
                title: 'Financial Guardrails',
                desc: 'No budget alerts, no margin monitoring, no deadline warnings. You won\'t know a deal is going sideways until you look at a spreadsheet — if you remember to check.',
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

      {/* Lifecycle Coverage Visual */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            Lifecycle Coverage
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Traditional CRMs cover the first two stages. FlipOps covers
            all six.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {lifecycleStages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-2xl p-5 text-center relative"
                style={cardStyle}
              >
                <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto mb-3">
                  <stage.icon className="w-5 h-5 text-teal-500" />
                </div>
                <p className="text-sm font-semibold mb-0.5">{stage.label}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {stage.desc}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5">
                    {stage.crmCovered ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      CRM
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
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
                    Traditional CRM
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-teal-600 dark:text-teal-400">
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
                      {f.traditional === true ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : f.traditional === false ? (
                        <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {f.traditional}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {f.flipops === true ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Check className="w-5 h-5 text-emerald-500" />
                          {f.flipopsNote && (
                            <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                              {f.flipopsNote}
                            </span>
                          )}
                        </div>
                      ) : f.flipops === 'soon' ? (
                        <span className="text-xs text-amber-500 font-medium">
                          {f.flipopsNote}
                        </span>
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
            The hidden costs of staying with a pre-close-only CRM.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl p-8"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-5">
                  <p.icon className="w-6 h-6 text-teal-500" />
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
              <h3 className="text-lg font-semibold mb-4">A traditional CRM might be enough if...</h3>
              <ul className="space-y-3">
                {[
                  'Your business is 100% wholesaling with no rehab or hold strategies',
                  'You only need outreach automation and lead status tracking',
                  'You already have separate tools for data, project management, and accounting that you\'re happy with',
                  'Your volume is low enough that spreadsheets handle post-close tracking',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-2xl p-8 ring-1 ring-teal-500/20"
              style={cardStyle}
            >
              <h3 className="text-lg font-semibold mb-4 text-teal-600 dark:text-teal-400">
                FlipOps is built for you if...
              </h3>
              <ul className="space-y-3">
                {[
                  'You flip, BRRRR, or hold properties — not just wholesale',
                  'You need ML-powered scoring that learns your deal preferences',
                  'You want renovation tracking, vendor management, and budget alerts in the same platform',
                  'You\'re tired of losing deal context when data moves between tools',
                  'You want financial guardrails that catch problems before they cost you money',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
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
              <Link href="/compare/vs-data-platforms">vs Data Platforms</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/compare/vs-project-tools">vs Project Tools</Link>
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
            Stop stitching together tools. See how FlipOps covers the
            entire investment lifecycle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-teal-500 to-teal-600 text-white border-0 hover:opacity-90"
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
