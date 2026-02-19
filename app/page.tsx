import { Header } from './components/header';
import { HeroV2 as Hero } from './components/hero-v2';
import { KPICards } from './components/kpi-cards';
import { FeatureTabsV2 as FeatureTabs } from './components/feature-tabs-v2';
import { GuardrailsSection } from './components/guardrails-section';
import { ToolConsolidationV8 as ToolConsolidation } from './components/tool-consolidation-v8';
import { ScoringEngine } from './components/scoring-engine';
import { NewInvestorSection } from './components/new-investor-section';
import { FinalCTA } from './components/final-cta';
import { Footer } from './components/footer';

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
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
