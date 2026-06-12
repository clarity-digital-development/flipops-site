'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  Plan data                                                          */
/* ------------------------------------------------------------------ */

const mainPlans = [
  {
    name: 'Core',
    price: 99,
    badge: 'Best for new investors',
    highlighted: false,
    features: [
      'Up to 500 leads/month',
      'AI distress scoring',
      'Basic deal pipeline',
      'MAO calculator',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: 299,
    badge: 'Most Popular',
    highlighted: true,
    features: [
      'Up to 2,500 leads/month',
      'Everything in Core',
      'Multi-channel outreach (SMS, email, voicemail)',
      'Skip tracing credits included',
      'Renovation tracking',
      'Financial guardrails',
      'Priority support',
    ],
  },
  {
    name: 'Scale',
    price: 599,
    badge: 'Best for teams',
    highlighted: false,
    features: [
      'Up to 10,000 leads/month',
      'Everything in Pro',
      'Vendor network access',
      'Property management',
      'Team collaboration',
      'Advanced analytics',
      'Dedicated account manager',
    ],
  },
];

const enterprisePlans = [
  {
    name: 'Accelerator',
    price: 1149,
    onboarding: 2500,
    features: [
      '25,000 leads/month',
      'Custom integrations',
      'White-glove onboarding',
    ],
  },
  {
    name: 'Partner',
    price: 2499,
    onboarding: 12500,
    features: [
      'Unlimited leads',
      'API access',
      'Custom development',
      'Dedicated success team',
    ],
  },
];

const faqs = [
  {
    q: 'Can I switch plans?',
    a: 'Yes, upgrade or downgrade anytime. Changes take effect at the start of your next billing cycle.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a guided demo so you can see the full platform in action. Reserve your spot to get early access when we launch.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit cards. Enterprise plans (Accelerator and Partner) also support invoicing.',
  },
  {
    q: 'Are there annual discounts?',
    a: 'Yes, save 20% with annual billing on any plan.',
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const cardStyle: React.CSSProperties = isDarkMode
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

  const highlightedCardStyle: React.CSSProperties = isDarkMode
    ? {
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.02) 100%)',
        boxShadow:
          '0 0 0 2px rgba(45, 212, 191, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -1px 0 rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(45, 212, 191, 0.1)',
      }
    : {
        background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        boxShadow:
          '0 0 0 2px rgba(45, 212, 191, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.04)',
      };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* Hero */}
        <section className="pt-32 pb-16 lg:pb-20 overflow-x-clip">
          <div className="container mx-auto px-4 max-w-6xl">
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">Pricing</span>
            </nav>

            <div className="flex justify-center mb-6">
              <SectionPill glowColor="45, 212, 191" staggerIndex={0}>
                Simple Pricing
              </SectionPill>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 max-w-4xl mx-auto text-center glow-heading-teal">
              Plans That Scale With Your Portfolio
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-center">
              Transparent pricing for every stage of your investing journey.
              No hidden fees, no per-deal charges.
            </p>
          </div>
        </section>

        {/* Main pricing tiers */}
        <section className="pb-16 lg:pb-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mainPlans.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-2xl p-6 flex flex-col relative"
                  style={plan.highlighted ? highlightedCardStyle : cardStyle}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-teal-600 text-white text-xs font-medium shadow-lg shadow-teal-500/25">
                      {plan.badge}
                    </div>
                  )}
                  {!plan.highlighted && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {plan.badge}
                    </span>
                  )}

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      /mo
                    </span>
                  </div>

                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <Check className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link href="/reserve">
                    <Button
                      size="lg"
                      className={`w-full text-base ${
                        plan.highlighted
                          ? 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-lg shadow-teal-500/25'
                          : ''
                      }`}
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      Reserve Your Spot
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Enterprise tiers */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8 text-center">
              Enterprise Solutions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {enterprisePlans.map((plan) => (
                <div
                  key={plan.name}
                  className="rounded-2xl p-6 flex flex-col"
                  style={cardStyle}
                >
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${plan.price.toLocaleString()}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      /mo
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    + ${plan.onboarding.toLocaleString()} onboarding
                  </p>

                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <Check className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a href="mailto:sales@flipops.io">
                    <Button variant="outline" size="lg" className="w-full text-base">
                      <Mail className="w-4 h-4 mr-2" />
                      Contact Sales
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 lg:py-28 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-10 text-center">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden"
                  style={cardStyle}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {faq.q}
                    </span>
                    {openFaq === i ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-28 bg-[#f4f4f6] dark:bg-black">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Not sure which plan?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Walk through the platform in under 5 minutes, or lock in
              early-access pricing before launch.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/demo">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base min-w-[160px]"
                >
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-lg shadow-teal-500/25 text-base min-w-[160px]"
                >
                  Reserve Your Spot
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
