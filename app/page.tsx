import dynamic from 'next/dynamic';
import { Header } from './components/header';
import { HeroV2 as Hero } from './components/hero-v2';

// Below-fold components: code-split into separate chunks to reduce initial bundle
const PersonaRouting = dynamic(() => import('./components/persona-routing').then(m => ({ default: m.PersonaRouting })));
const FeatureTabs = dynamic(() => import('./components/feature-tabs-v2').then(m => ({ default: m.FeatureTabsV2 })));
const SavingsCalculator = dynamic(() => import('./components/savings-calculator').then(m => ({ default: m.SavingsCalculator })));
const FinalCTA = dynamic(() => import('./components/final-cta').then(m => ({ default: m.FinalCTA })));
const Footer = dynamic(() => import('./components/footer').then(m => ({ default: m.Footer })));

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <PersonaRouting />
        <FeatureTabs />
        <SavingsCalculator />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
