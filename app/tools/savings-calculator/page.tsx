'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DollarSign, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

interface SliderInputProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function SliderInput({ label, hint, value, min, max, step, onChange }: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground ml-2">({hint})</span>
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(value)}/mo</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const FLIPOPS_MONTHLY = 99;

export default function SavingsCalculatorPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const cardStyle = isDarkMode ? {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 20px rgba(0, 0, 0, 0.2)',
  } : {
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
  };

  /* Inputs */
  const [propertyData, setPropertyData] = useState(99);
  const [crm, setCrm] = useState(199);
  const [skipTracing, setSkipTracing] = useState(50);
  const [outreach, setOutreach] = useState(75);
  const [projectMgmt, setProjectMgmt] = useState(75);
  const [contracts, setContracts] = useState(30);
  const [rental, setRental] = useState(0);
  const [other, setOther] = useState(0);

  /* Calculations */
  const calc = useMemo(() => {
    const currentMonthly = propertyData + crm + skipTracing + outreach + projectMgmt + contracts + rental + other;
    const currentAnnual = currentMonthly * 12;
    const monthlySavings = currentMonthly - FLIPOPS_MONTHLY;
    const annualSavings = monthlySavings * 12;
    const savingsPct = currentMonthly > 0 ? Math.round((monthlySavings / currentMonthly) * 100) : 0;
    return { currentMonthly, currentAnnual, monthlySavings, annualSavings, savingsPct };
  }, [propertyData, crm, skipTracing, outreach, projectMgmt, contracts, rental, other]);

  const savingsPositive = calc.monthlySavings > 0;

  /* Cost breakdown for bar chart */
  const categories = [
    { label: 'Data', value: propertyData, color: 'bg-blue-500' },
    { label: 'CRM', value: crm, color: 'bg-purple-500' },
    { label: 'Skip', value: skipTracing, color: 'bg-amber-500' },
    { label: 'Outreach', value: outreach, color: 'bg-rose-500' },
    { label: 'PM', value: projectMgmt, color: 'bg-cyan-500' },
    { label: 'Docs', value: contracts, color: 'bg-emerald-500' },
    { label: 'Rental', value: rental, color: 'bg-orange-500' },
    { label: 'Other', value: other, color: 'bg-gray-500' },
  ].filter((c) => c.value > 0);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative bg-white dark:bg-black pt-32 pb-16 overflow-x-clip">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <SectionPill glowColor="45, 212, 191">
              <DollarSign className="w-4 h-4" />
              Free Tool
            </SectionPill>
            <h1 className="mt-8 text-4xl sm:text-5xl font-bold tracking-tight glow-heading-teal">
              How Much Is Tool Sprawl Costing You?
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Add up what you&apos;re paying for data, CRM, skip tracing, and project management. See how FlipOps compares.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <section className="bg-[#f4f4f6] dark:bg-black py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Sliders */}
              <div className="rounded-2xl p-6 sm:p-8 space-y-6" style={cardStyle}>
                <h2 className="text-lg font-semibold text-foreground mb-2">Your Current Tool Stack</h2>
                <SliderInput label="Property Data" hint="PropStream, BatchLeads, etc." value={propertyData} min={0} max={300} step={1} onChange={setPropertyData} />
                <SliderInput label="CRM & Pipeline" hint="REsimpli, Podio, etc." value={crm} min={0} max={500} step={1} onChange={setCrm} />
                <SliderInput label="Skip Tracing" hint="per-record or subscription" value={skipTracing} min={0} max={200} step={1} onChange={setSkipTracing} />
                <SliderInput label="Outreach Tools" hint="SMS, dialer, etc." value={outreach} min={0} max={300} step={1} onChange={setOutreach} />
                <SliderInput label="Project Management" hint="task tracking, rehabs" value={projectMgmt} min={0} max={200} step={1} onChange={setProjectMgmt} />
                <SliderInput label="Contracts & Docs" hint="PandaDoc, DocuSign, etc." value={contracts} min={0} max={100} step={1} onChange={setContracts} />
                <SliderInput label="Rental / Property Mgmt" hint="if applicable" value={rental} min={0} max={200} step={1} onChange={setRental} />
                <SliderInput label="Other Tools" hint="miscellaneous" value={other} min={0} max={200} step={1} onChange={setOther} />
              </div>

              {/* Right: Results */}
              <div className="space-y-6">
                {/* Current spend */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-5">Your Current Spend</h2>

                  {/* Cost bar */}
                  {categories.length > 0 && (
                    <div className="mb-5">
                      <div className="flex rounded-lg overflow-hidden h-3">
                        {categories.map((cat) => (
                          <div
                            key={cat.label}
                            className={`${cat.color} transition-all duration-300`}
                            style={{ width: `${(cat.value / calc.currentMonthly) * 100}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {categories.map((cat) => (
                          <span key={cat.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                            {cat.label} {fmt(cat.value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(calc.currentMonthly)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Annual</p>
                      <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(calc.currentAnnual)}</p>
                    </div>
                  </div>
                </div>

                {/* FlipOps comparison */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-5">FlipOps All-in-One</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly (Core)</p>
                      <p className="text-2xl font-bold tabular-nums text-teal-500">{fmt(FLIPOPS_MONTHLY)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Annual</p>
                      <p className="text-2xl font-bold tabular-nums text-teal-500">{fmt(FLIPOPS_MONTHLY * 12)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Core plan at $99/mo. Pro plan available at $299/mo for high-volume teams.
                  </p>
                </div>

                {/* Savings */}
                <div className={`rounded-2xl p-6 sm:p-8 border ${savingsPositive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monthly Savings</p>
                      <p className={`text-2xl font-bold tabular-nums ${savingsPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {fmt(calc.monthlySavings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Annual Savings</p>
                      <p className={`text-4xl font-bold tabular-nums tracking-tight ${savingsPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {fmt(calc.annualSavings)}
                      </p>
                    </div>
                  </div>
                  {savingsPositive && calc.savingsPct > 0 && (
                    <p className="text-sm text-muted-foreground">
                      That&apos;s {calc.savingsPct}% less than your current stack.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Educational */}
        <section className="bg-white dark:bg-black py-16">
          <div className="mx-auto max-w-4xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-teal-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">The Hidden Cost</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Beyond the subscription fees, fragmented tools cost you time switching between platforms,
                  duplicate data entry, and deals lost in the gaps. Investors using 5+ disconnected tools
                  spend an average of 8&ndash;12 hours per week on admin work that an integrated platform
                  handles automatically.
                </p>
              </div>

              <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-teal-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">One Platform, Everything Included</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  Data, CRM, skip tracing, outreach, underwriting, project management, and rental tracking &mdash;
                  all in one place. Plans start at $99/month.
                </p>
                <Link href="/pricing" className="text-sm font-medium text-teal-500 hover:text-teal-400 inline-flex items-center gap-1">
                  View pricing <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#f4f4f6] dark:bg-black py-16">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
              Simplify your stack. Keep your margin.
            </h2>
            <p className="text-muted-foreground mb-8">
              Replace 6+ subscriptions with one platform built specifically for real estate investors.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">View Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 hover:opacity-90">
                <Link href="/reserve">Reserve Your Spot</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
