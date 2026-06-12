'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Check,
  X,
  ChevronRight,
  FileOutput,
  BarChart3,
  GitBranchPlus,
  Database,
  Target,
  FileSignature,
  Hammer,
  Home,
  TrendingUp,
  ThumbsUp,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

const features = [
  { capability: 'Property Database', data: true, flipops: true, flipopsNote: 'Self-scraped FL public records' },
  { capability: 'Distress Scoring', data: 'Basic filters', flipops: true, flipopsNote: 'ML-powered' },
  { capability: 'Behavioral Learning', data: false, flipops: true, flipopsNote: 'Adapts over time' },
  { capability: 'Skip Tracing', data: 'Some/Add-on', flipops: true, flipopsNote: 'Built-in' },
  { capability: 'Deal Pipeline', data: false, flipops: true, flipopsNote: null },
  { capability: 'CRM / Lead Management', data: false, flipops: true, flipopsNote: null },
  { capability: 'MAO Calculator', data: false, flipops: true, flipopsNote: null },
  { capability: 'Renovation Tracking', data: false, flipops: true, flipopsNote: null },
  { capability: 'Budget Tracking', data: false, flipops: true, flipopsNote: 'Real-time alerts' },
  { capability: 'Vendor Management', data: false, flipops: true, flipopsNote: null },
  { capability: 'Rental Management', data: false, flipops: true, flipopsNote: null },
  { capability: 'Guardrails & Alerts', data: false, flipops: true, flipopsNote: null },
  { capability: 'Portfolio Analytics', data: false, flipops: true, flipopsNote: 'Full lifecycle' },
  { capability: 'Data Export Required', data: true, flipops: false, flipopsNote: 'Stays in platform' },
  { capability: 'Full Lifecycle Coverage', data: false, flipops: true, flipopsNote: null },
  { capability: 'Multi-Channel Outreach', data: false, flipops: true, flipopsNote: null },
];

const journeySteps = [
  {
    icon: Database,
    label: 'Find Data',
    desc: 'Property research & lists',
    dataCovers: true,
  },
  {
    icon: Target,
    label: 'Score & Prioritize',
    desc: 'AI-powered rankings',
    dataCovers: false,
  },
  {
    icon: TrendingUp,
    label: 'Outreach & CRM',
    desc: 'Contact & follow up',
    dataCovers: false,
  },
  {
    icon: FileSignature,
    label: 'Offer & Close',
    desc: 'MAO, contracts, closing',
    dataCovers: false,
  },
  {
    icon: Hammer,
    label: 'Renovate',
    desc: 'Project & vendor mgmt',
    dataCovers: false,
  },
  {
    icon: Home,
    label: 'Hold or Exit',
    desc: 'Rentals, sales, reporting',
    dataCovers: false,
  },
];

const painPoints = [
  {
    icon: FileOutput,
    title: 'Data Without Action',
    desc: 'Great data, but no workflow to act on it. Every lead requires manual export and re-entry into other tools.',
    detail:
      'Copy-paste from your data platform to your CRM to your dialer. Each hand-off loses context and wastes time you could spend closing deals.',
  },
  {
    icon: BarChart3,
    title: 'Static Scoring',
    desc: "Property scores don\u2019t learn your preferences. Every investor sees the same rankings regardless of strategy.",
    detail:
      'A wholesaler in Phoenix and a flipper in Atlanta get identical lead scores. FlipOps learns your strategy and personalizes rankings over time.',
  },
  {
    icon: GitBranchPlus,
    title: 'No Deal Tracking',
    desc: "Once you contact a lead, the data platform\u2019s job is done. Pipeline management, contracts, and project tracking are your problem.",
    detail:
      'You found the lead in one tool but manage it in three others. FlipOps takes a lead from discovery through renovation to exit, all in one place.',
  },
];

const dataStrengths = [
  'Massive property databases with 150M+ records',
  'Granular filters (equity, vacancy, tax delinquency, pre-foreclosure)',
  'Comp analysis and recent sales data',
  'List building and data export capabilities',
];

export default function VsDataPlatformsPage() {
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
              vs Data Platforms
            </span>
          </nav>

          <SectionPill
            pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
            glowColor="59, 130, 246"
          >
            <ArrowLeftRight className="w-4 h-4" />
            How We Compare
          </SectionPill>

          <h1 className="glow-heading-blue text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mt-6 mb-6 relative z-10">
            FlipOps vs. Data-Only Platforms
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto relative z-10">
            Data platforms give you leads. FlipOps gives you leads AND
            manages the deals they become.
          </p>
        </div>
      </section>

      {/* What Are Data-Only Platforms */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-6">
            What Are Data-Only Platforms?
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed text-center mb-10">
            Data-only platforms are tools focused on property data, list building,
            and filtering. They aggregate public records, tax data, mortgage
            information, and ownership history to help you identify potential
            investment opportunities. They&apos;re research tools — powerful for
            finding leads, but not designed to help you do anything with them.
          </p>

          <div className="rounded-2xl p-8" style={cardStyle}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-blue-500" />
              What They Do Well
            </h3>
            <ul className="space-y-3">
              {dataStrengths.map((s) => (
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
            Data is the starting point, not the finish line. Here&apos;s what happens after you pull a list.
          </p>
          <div className="space-y-4">
            {[
              {
                title: 'No CRM or Deal Pipeline',
                desc: 'You find a promising lead, then export it to a CSV, import it to your CRM, and manually connect the dots. Every handoff loses context and creates room for error.',
              },
              {
                title: 'No Scoring Intelligence',
                desc: 'You ARE the filter. Data platforms show you every property that matches your criteria, but they don\'t rank them by deal quality, learn your preferences, or identify distress signals beyond basic public records.',
              },
              {
                title: 'No Deal Execution Tools',
                desc: 'No MAO calculator, no comp-based ARV analysis, no contract management, no offer tracking. You research in one tool and execute in three others.',
              },
              {
                title: 'No Post-Close Anything',
                desc: 'Zero renovation tracking, zero vendor management, zero rental operations, zero financial guardrails. The data platform\'s job ends the moment you pick up the phone.',
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

      {/* Deal Journey Visual */}
      <section className="py-20 bg-white dark:bg-black">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            From Data to Done
          </h2>
          <p className="text-muted-foreground text-center mb-14 max-w-xl mx-auto">
            Data platforms cover step one. FlipOps covers all six.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {journeySteps.map((step) => (
              <div
                key={step.label}
                className="rounded-2xl p-5 text-center relative"
                style={cardStyle}
              >
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                  <step.icon className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-sm font-semibold mb-0.5">
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {step.desc}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5">
                    {step.dataCovers ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      Data
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
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
          <div className="rounded-2xl overflow-hidden overflow-x-auto" style={cardStyle}>
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">
                    Capability
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-muted-foreground">
                    Data Platform
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
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
                      {f.data === true ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : f.data === false ? (
                        <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {f.data}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {f.flipops === true ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Check className="w-5 h-5 text-emerald-500" />
                          {f.flipopsNote && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {f.flipopsNote}
                            </span>
                          )}
                        </div>
                      ) : f.flipops === false ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <X className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                          {f.flipopsNote && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
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
            The gaps between data and deals cost you time, money, and
            opportunities.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl p-8"
                style={cardStyle}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5">
                  <p.icon className="w-6 h-6 text-blue-500" />
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
              <h3 className="text-lg font-semibold mb-4">A data platform might be enough if...</h3>
              <ul className="space-y-3">
                {[
                  'You already have a CRM, dialer, and project management tool you love',
                  'You only need property data for research — not deal execution',
                  'Your workflow is pulling lists and handing them to a VA or acquisitions team',
                  'You\'re comfortable exporting CSVs and importing into other systems',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-2xl p-8 ring-1 ring-blue-500/20"
              style={cardStyle}
            >
              <h3 className="text-lg font-semibold mb-4 text-blue-600 dark:text-blue-400">
                FlipOps is built for you if...
              </h3>
              <ul className="space-y-3">
                {[
                  'You want intelligence on top of data — not just filters, but ML-powered scoring',
                  'You\'re tired of exporting lists to a CRM, then to a dialer, then to a spreadsheet',
                  'You need deal execution tools (MAO, ARV, contracts) alongside your data',
                  'You want post-close management without adding another subscription',
                  'You want one platform from lead discovery through renovation to exit',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
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
            Go from data to deal to done — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">View Demo</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:opacity-90"
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
