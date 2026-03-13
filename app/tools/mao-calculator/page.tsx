'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Calculator, ArrowRight, Lightbulb, Sparkles } from 'lucide-react';
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

function pct(n: number) {
  return `${n}%`;
}

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderInput({ label, value, min, max, step, format, onChange }: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{format(value)}</span>
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
/*  Waterfall line                                                     */
/* ------------------------------------------------------------------ */

interface WaterfallLineProps {
  label: string;
  amount: number;
  isTotal?: boolean;
  color?: string;
}

function WaterfallLine({ label, amount, isTotal, color }: WaterfallLineProps) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${isTotal ? 'border-t-2 border-foreground/20 pt-4 mt-2' : 'border-b border-foreground/5'}`}>
      <span className={`text-sm ${isTotal ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color || (isTotal ? 'text-foreground' : 'text-rose-500 dark:text-rose-400')}`}>
        {isTotal ? fmt(amount) : `- ${fmt(Math.abs(amount))}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MAOCalculatorPage() {
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
  const [arv, setArv] = useState(250000);
  const [repairs, setRepairs] = useState(35000);
  const [commission, setCommission] = useState(6);
  const [buyCosts, setBuyCosts] = useState(1.5);
  const [sellCosts, setSellCosts] = useState(2);
  const [holdingMonthly, setHoldingMonthly] = useState(1500);
  const [holdingMonths, setHoldingMonths] = useState(4);
  const [profitTarget, setProfitTarget] = useState(20);

  /* Calculations */
  const calc = useMemo(() => {
    const commissionAmt = arv * (commission / 100);
    const buyAmt = arv * (buyCosts / 100);
    const sellAmt = arv * (sellCosts / 100);
    const holdingAmt = holdingMonthly * holdingMonths;
    const profitAmt = arv * (profitTarget / 100);
    const mao = arv - repairs - commissionAmt - buyAmt - sellAmt - holdingAmt - profitAmt;
    const marginPct = arv > 0 ? (mao / arv) * 100 : 0;
    return { commissionAmt, buyAmt, sellAmt, holdingAmt, profitAmt, mao, marginPct };
  }, [arv, repairs, commission, buyCosts, sellCosts, holdingMonthly, holdingMonths, profitTarget]);

  const maoColor = calc.mao >= arv * 0.15 ? 'text-emerald-500' : calc.mao > 0 ? 'text-amber-500' : 'text-rose-500';
  const maoBg = calc.mao >= arv * 0.15 ? 'bg-emerald-500/10 border-emerald-500/20' : calc.mao > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative bg-white dark:bg-black pt-32 pb-16 overflow-x-clip">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <SectionPill
              pillClassName="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25"
              glowColor="16, 185, 129"
            >
              <Calculator className="w-4 h-4" />
              Free Tool
            </SectionPill>
            <h1 className="mt-8 text-4xl sm:text-5xl font-bold tracking-tight glow-heading-emerald">
              Maximum Allowable Offer Calculator
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Know exactly what to offer before you bid. Enter your numbers and see the full breakdown.
            </p>
          </div>
        </section>

        {/* Calculator */}
        <section className="bg-[#f4f4f6] dark:bg-black py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Sliders */}
              <div className="rounded-2xl p-6 sm:p-8 space-y-6" style={cardStyle}>
                <h2 className="text-lg font-semibold text-foreground mb-2">Deal Inputs</h2>
                <SliderInput label="After-Repair Value (ARV)" value={arv} min={50000} max={1000000} step={5000} format={fmt} onChange={setArv} />
                <SliderInput label="Estimated Repairs" value={repairs} min={0} max={200000} step={1000} format={fmt} onChange={setRepairs} />
                <SliderInput label="Realtor Commission" value={commission} min={0} max={8} step={0.5} format={pct} onChange={setCommission} />
                <SliderInput label="Buy Closing Costs" value={buyCosts} min={0} max={5} step={0.5} format={pct} onChange={setBuyCosts} />
                <SliderInput label="Sell Closing Costs" value={sellCosts} min={0} max={5} step={0.5} format={pct} onChange={setSellCosts} />
                <SliderInput label="Holding Costs (monthly)" value={holdingMonthly} min={0} max={5000} step={100} format={fmt} onChange={setHoldingMonthly} />
                <SliderInput label="Holding Period (months)" value={holdingMonths} min={1} max={12} step={1} format={(v) => `${v} mo`} onChange={setHoldingMonths} />
                <SliderInput label="Profit Target" value={profitTarget} min={5} max={40} step={1} format={pct} onChange={setProfitTarget} />
              </div>

              {/* Right: Waterfall */}
              <div className="space-y-6">
                <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Waterfall Breakdown</h2>
                  <div className="flex items-center justify-between py-2.5 border-b border-foreground/5">
                    <span className="text-sm font-medium text-foreground">After-Repair Value (ARV)</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-500">{fmt(arv)}</span>
                  </div>
                  <WaterfallLine label="Repairs" amount={repairs} />
                  <WaterfallLine label={`Commissions (${commission}%)`} amount={calc.commissionAmt} />
                  <WaterfallLine label={`Buy Closing (${buyCosts}%)`} amount={calc.buyAmt} />
                  <WaterfallLine label={`Sell Closing (${sellCosts}%)`} amount={calc.sellAmt} />
                  <WaterfallLine label={`Holding Costs (${holdingMonths} mo)`} amount={calc.holdingAmt} />
                  <WaterfallLine label={`Profit Target (${profitTarget}%)`} amount={calc.profitAmt} />
                  <WaterfallLine label="= Maximum Allowable Offer" amount={calc.mao} isTotal color={maoColor} />
                </div>

                {/* Result card */}
                <div className={`rounded-2xl p-6 sm:p-8 border ${maoBg}`}>
                  <p className="text-sm text-muted-foreground mb-1">Your Maximum Allowable Offer</p>
                  <p className={`text-4xl sm:text-5xl font-bold tabular-nums tracking-tight ${maoColor}`}>
                    {fmt(calc.mao)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {calc.marginPct.toFixed(1)}% of ARV
                  </p>
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
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">What is MAO?</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  MAO stands for Maximum Allowable Offer &mdash; the highest price you can pay for an investment
                  property and still hit your profit target. Many investors use the quick &ldquo;70% rule&rdquo;
                  (ARV &times; 70% &minus; repairs), but that ignores commissions, closing costs, and holding costs.
                  A full waterfall breakdown gives you a far more accurate ceiling for your bid.
                </p>
              </div>

              <div className="rounded-2xl p-6 sm:p-8" style={cardStyle}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Want More?</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  FlipOps calculates MAO automatically with comp-driven ARV and real repair estimates &mdash;
                  no manual data entry required.
                </p>
                <Link href="/features/mao-calculator" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 inline-flex items-center gap-1">
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
              Stop guessing. Start underwriting.
            </h2>
            <p className="text-muted-foreground mb-8">
              FlipOps gives you comp-driven ARV, repair estimates, and MAO in seconds &mdash; for every property in your pipeline.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">View Demo</Link>
              </Button>
              <Button asChild size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 hover:opacity-90">
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
