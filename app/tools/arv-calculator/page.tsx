'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Home, Plus, Trash2, ArrowRight, Lightbulb, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { SectionPill } from '../../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

interface Comp {
  id: number;
  price: number;
  sqft: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtPsf(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let nextId = 4;

const DEFAULT_COMPS: Comp[] = [
  { id: 1, price: 265000, sqft: 1750 },
  { id: 2, price: 282000, sqft: 1900 },
  { id: 3, price: 258000, sqft: 1700 },
];

/* ------------------------------------------------------------------ */
/*  Number input                                                       */
/* ------------------------------------------------------------------ */

interface NumberInputProps {
  label: string;
  value: number;
  placeholder: string;
  onChange: (v: number) => void;
  prefix?: string;
}

function NumberInput({ label, value, placeholder, onChange, prefix }: NumberInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${prefix ? 'pl-7' : ''}`}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ARVCalculatorPage() {
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

  /* State */
  const [comps, setComps] = useState<Comp[]>(DEFAULT_COMPS);
  const [subjectSqft, setSubjectSqft] = useState(1650);
  const [adjustment, setAdjustment] = useState(0);

  const updateComp = (id: number, field: keyof Omit<Comp, 'id'>, value: number) => {
    setComps((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addComp = () => {
    if (comps.length >= 5) return;
    setComps((prev) => [...prev, { id: nextId++, price: 0, sqft: 0 }]);
  };

  const removeComp = (id: number) => {
    if (comps.length <= 1) return;
    setComps((prev) => prev.filter((c) => c.id !== id));
  };

  /* Calculations */
  const calc = useMemo(() => {
    const validComps = comps.filter((c) => c.price > 0 && c.sqft > 0);
    if (validComps.length === 0 || subjectSqft <= 0) {
      return { compData: [], avgPsf: 0, baseArv: 0, adjustmentAmt: 0, finalArv: 0 };
    }
    const compData = validComps.map((c) => ({ ...c, psf: c.price / c.sqft }));
    const avgPsf = compData.reduce((sum, c) => sum + c.psf, 0) / compData.length;
    const baseArv = avgPsf * subjectSqft;
    const adjustmentAmt = baseArv * (adjustment / 100);
    const finalArv = baseArv + adjustmentAmt;
    return { compData, avgPsf, baseArv, adjustmentAmt, finalArv };
  }, [comps, subjectSqft, adjustment]);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative bg-white dark:bg-black pt-32 pb-16 overflow-x-clip">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <SectionPill
              pillClassName="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
              glowColor="59, 130, 246"
            >
              <Home className="w-4 h-4" />
              Free Tool
            </SectionPill>
            <h1 className="mt-8 text-4xl sm:text-5xl font-bold tracking-tight glow-heading-blue">
              After-Repair Value Calculator
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Estimate what a property will be worth after renovations. Add comparable sales and get an instant ARV.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <section className="bg-[#f4f4f6] dark:bg-black py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Inputs */}
              <div className="space-y-6">
                {/* Comps */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-foreground">Comparable Sales</h2>
                    <span className="text-xs text-muted-foreground">{comps.length}/5 comps</span>
                  </div>

                  <div className="space-y-4">
                    {comps.map((comp, i) => (
                      <div key={comp.id} className="rounded-xl border border-foreground/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Comp {i + 1}</span>
                          {comps.length > 1 && (
                            <button
                              onClick={() => removeComp(comp.id)}
                              className="text-muted-foreground hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <NumberInput label="Sale Price" value={comp.price} placeholder="275,000" prefix="$" onChange={(v) => updateComp(comp.id, 'price', v)} />
                          <NumberInput label="Square Footage" value={comp.sqft} placeholder="1,800" onChange={(v) => updateComp(comp.id, 'sqft', v)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {comps.length < 5 && (
                    <button
                      onClick={addComp}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/10 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Comp
                    </button>
                  )}
                </div>

                {/* Subject property */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Subject Property</h2>
                  <NumberInput label="Square Footage" value={subjectSqft} placeholder="1,650" onChange={setSubjectSqft} />
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">ARV Adjustment</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{adjustment > 0 ? '+' : ''}{adjustment}%</span>
                    </div>
                    <Slider min={-20} max={20} step={1} value={[adjustment]} onValueChange={([v]) => setAdjustment(v)} />
                    <p className="text-xs text-muted-foreground">Adjust for condition, location, or feature differences</p>
                  </div>
                </div>
              </div>

              {/* Right: Results */}
              <div className="space-y-6">
                {/* Comp analysis table */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Comp Analysis</h2>
                  {calc.compData.length > 0 ? (
                    <div className="space-y-0">
                      <div className="grid grid-cols-3 gap-4 pb-2 border-b border-foreground/10">
                        <span className="text-xs font-medium text-muted-foreground">Comp</span>
                        <span className="text-xs font-medium text-muted-foreground text-right">Sale Price</span>
                        <span className="text-xs font-medium text-muted-foreground text-right">$/sqft</span>
                      </div>
                      {calc.compData.map((c, i) => (
                        <div key={c.id} className="grid grid-cols-3 gap-4 py-2.5 border-b border-foreground/5">
                          <span className="text-sm text-foreground">Comp {i + 1}</span>
                          <span className="text-sm tabular-nums text-foreground text-right">{fmt(c.price)}</span>
                          <span className="text-sm tabular-nums text-foreground text-right">{fmtPsf(c.psf)}</span>
                        </div>
                      ))}
                      <div className="grid grid-cols-3 gap-4 py-2.5 border-t border-foreground/10 mt-1">
                        <span className="text-sm font-semibold text-foreground">Average</span>
                        <span className="text-sm text-foreground text-right">&mdash;</span>
                        <span className="text-sm font-semibold tabular-nums text-blue-500 text-right">{fmtPsf(calc.avgPsf)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Add at least one comp with sale price and square footage.</p>
                  )}
                </div>

                {/* Breakdown */}
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-4">ARV Calculation</h2>
                  <div className="space-y-0">
                    <div className="flex items-center justify-between py-2.5 border-b border-foreground/5">
                      <span className="text-sm text-muted-foreground">Avg $/sqft</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{fmtPsf(calc.avgPsf)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-foreground/5">
                      <span className="text-sm text-muted-foreground">Subject sqft</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{subjectSqft.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-foreground/5">
                      <span className="text-sm text-muted-foreground">Base ARV</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(calc.baseArv)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2.5 border-b border-foreground/5">
                      <span className="text-sm text-muted-foreground">Adjustment ({adjustment > 0 ? '+' : ''}{adjustment}%)</span>
                      <span className={`text-sm font-semibold tabular-nums ${calc.adjustmentAmt >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {calc.adjustmentAmt >= 0 ? '+' : ''}{fmt(calc.adjustmentAmt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final ARV */}
                <div className="rounded-2xl p-6 sm:p-8 border bg-blue-500/10 border-blue-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Estimated After-Repair Value</p>
                  <p className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight text-blue-500">
                    {fmt(calc.finalArv)}
                  </p>
                  {adjustment !== 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Base {fmt(calc.baseArv)} {adjustment > 0 ? '+' : ''}{adjustment}% adjustment
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
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">What is ARV?</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ARV (After-Repair Value) is the estimated market value of a property after all planned
                  renovations are complete. It&apos;s calculated by analyzing recent comparable sales in the same
                  area &mdash; properties with similar size, condition, and features that have sold recently.
                  ARV is the foundation of every investment analysis: your MAO, profit projections, and exit
                  strategy all start here.
                </p>
              </div>

              <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Want More?</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  FlipOps pulls real comparable sales from CoreLogic&apos;s database and calculates ARV
                  automatically &mdash; with adjustments for condition, proximity, and recency baked in.
                </p>
                <Link href="/features/mao-calculator" className="text-sm font-medium text-blue-500 hover:text-blue-400 inline-flex items-center gap-1">
                  Learn more <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#f4f4f6] dark:bg-black py-16">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
              Get real comps, not guesswork.
            </h2>
            <p className="text-muted-foreground mb-8">
              FlipOps connects to CoreLogic&apos;s national MLS database to surface true comparable sales &mdash;
              with automatic adjustments and confidence scoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">View Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 hover:opacity-90">
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
