import dynamic from 'next/dynamic';
import { Header } from './components/header';
import { HeroV2 as Hero } from './components/hero-v2';

// Below-fold components: code-split into separate chunks to reduce initial bundle
const KPICards = dynamic(() => import('./components/kpi-cards').then(m => ({ default: m.KPICards })));
const ScoringEngine = dynamic(() => import('./components/scoring-engine').then(m => ({ default: m.ScoringEngine })));
const FeatureTabs = dynamic(() => import('./components/feature-tabs-v2').then(m => ({ default: m.FeatureTabsV2 })));
const ToolConsolidation = dynamic(() => import('./components/tool-consolidation-v8').then(m => ({ default: m.ToolConsolidationV8 })));
const GuardrailsSection = dynamic(() => import('./components/guardrails-section').then(m => ({ default: m.GuardrailsSection })));
const NewInvestorSection = dynamic(() => import('./components/new-investor-section').then(m => ({ default: m.NewInvestorSection })));
const PricingSection = dynamic(() => import('./components/pricing-section').then(m => ({ default: m.PricingSection })));
const FinalCTA = dynamic(() => import('./components/final-cta').then(m => ({ default: m.FinalCTA })));
const Footer = dynamic(() => import('./components/footer').then(m => ({ default: m.Footer })));

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <KPICards />
        <ScoringEngine />
        <FeatureTabs />
        <ToolConsolidation />
        <GuardrailsSection />
        <NewInvestorSection />
        <PricingSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
