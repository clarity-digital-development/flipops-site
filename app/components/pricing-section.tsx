'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SectionPill } from './section-pill';
import { Button } from '@/components/ui/button';
import { Check, Zap, Star, Crown, Rocket, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ── Tier data (feature lists will be updated with final breakdown) ──

const tiers = [
  {
    name: 'Core',
    price: 149,
    period: '/mo',
    icon: Zap,
    description: 'Essential tools for solo investors getting started.',
    highlight: false,
    color: '59, 130, 246', // blue
    features: [
      'Lead scoring engine',
      'Up to 500 leads/mo',
      'Basic CRM & pipeline',
      'MAO calculator',
      'Email support',
    ],
    cta: 'Reserve Your Spot',
    ctaHref: '/reserve',
  },
  {
    name: 'Pro',
    price: 299,
    period: '/mo',
    icon: Star,
    description: 'Full platform for active investors scaling operations.',
    highlight: true,
    badge: 'Most Popular',
    color: '45, 212, 191', // teal/primary
    features: [
      'Everything in Core',
      'Up to 2,500 leads/mo',
      'Comps & ARV analysis',
      'Repair estimation',
      'Skip tracing (pay-per-use)',
      'Guardrails (G1–G4)',
      'Priority support',
    ],
    cta: 'Reserve Your Spot',
    ctaHref: '/reserve',
  },
  {
    name: 'Scale',
    price: 549,
    period: '/mo',
    icon: Rocket,
    description: 'Advanced automation for teams managing multiple markets.',
    highlight: false,
    color: '139, 92, 246', // purple
    features: [
      'Everything in Pro',
      'Unlimited leads',
      'Multi-market support',
      'Team management (5 seats)',
      'Vendor network access',
      'Campaign automation',
      'Dedicated support',
    ],
    cta: 'Reserve Your Spot',
    ctaHref: '/reserve',
  },
];

const enterpriseTiers = [
  {
    name: 'Accelerator',
    price: 1149,
    period: '/mo',
    onboarding: 2500,
    icon: Crown,
    description: 'White-glove setup with a dedicated success manager.',
    color: '245, 158, 11', // amber
    features: [
      'Everything in Scale',
      'Team management (15 seats)',
      'Dedicated success manager',
      'Custom integrations',
      'Weekly strategy calls',
      'Data migration assistance',
    ],
  },
  {
    name: 'Partner',
    price: 2499,
    period: '/mo',
    onboarding: 12500,
    icon: Building2,
    description: 'Enterprise-grade for high-volume operations and portfolios.',
    color: '16, 185, 129', // emerald
    features: [
      'Everything in Accelerator',
      'Unlimited seats',
      'Custom API access',
      'SLA guarantee',
      'Quarterly business reviews',
      'Priority feature requests',
    ],
  },
];

export function PricingSection() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const cardStyle = (highlight = false) => isDarkMode ? {
    background: highlight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.02) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
    border: 'none',
    boxShadow: highlight ? [
      '0 0 0 1px rgba(45, 212, 191, 0.25)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.10)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
      '0 2px 4px rgba(0, 0, 0, 0.3)',
      '0 8px 24px rgba(0, 0, 0, 0.45)',
      '0 20px 50px rgba(0, 0, 0, 0.35)',
    ].join(', ') : [
      '0 0 0 1px rgba(255, 255, 255, 0.08)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
      '0 2px 4px rgba(0, 0, 0, 0.25)',
      '0 8px 20px rgba(0, 0, 0, 0.35)',
      '0 16px 40px rgba(0, 0, 0, 0.25)',
    ].join(', '),
  } : {
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
    border: 'none',
    boxShadow: highlight ? [
      '0 0 0 1px rgba(45, 212, 191, 0.3)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
      '0 1px 2px rgba(0, 0, 0, 0.04)',
      '0 4px 12px rgba(45, 212, 191, 0.08)',
      '0 12px 32px rgba(0, 0, 0, 0.06)',
    ].join(', ') : [
      '0 0 0 1px rgba(0, 0, 0, 0.06)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
      '0 1px 2px rgba(0, 0, 0, 0.04)',
      '0 4px 12px rgba(0, 0, 0, 0.06)',
      '0 12px 32px rgba(0, 0, 0, 0.04)',
    ].join(', '),
  };

  return (
    <section id="pricing" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="mb-6 flex justify-center">
            <SectionPill
              pillClassName="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
              glowColor="45, 212, 191"
              staggerIndex={7}
            >
              <Crown className="h-4 w-4" />
              Pricing
            </SectionPill>
          </div>

          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Every plan includes the core platform. Pick the tier that matches your deal volume.
          </p>
        </motion.div>

        {/* Main 3 tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
              className="rounded-xl p-6 flex flex-col relative"
              style={cardStyle(tier.highlight)}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-accent text-white shadow-md">
                  {(tier as typeof tiers[1]).badge}
                </div>
              )}

              <div className="mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `rgba(${tier.color}, 0.12)` }}
                >
                  <tier.icon className="h-5 w-5" style={{ color: `rgb(${tier.color})` }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tier.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">${tier.price}</span>
                <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: `rgb(${tier.color})` }} />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={tier.ctaHref}>
                <Button
                  className={`w-full ${
                    tier.highlight
                      ? 'bg-gradient-to-r from-primary to-accent hover:brightness-110 text-white shadow-lg shadow-primary/25'
                      : ''
                  }`}
                  variant={tier.highlight ? 'default' : 'outline'}
                  size="lg"
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Enterprise tiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {enterpriseTiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              className="rounded-xl p-6 flex flex-col"
              style={cardStyle()}
            >
              <div className="mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `rgba(${tier.color}, 0.12)` }}
                >
                  <tier.icon className="h-5 w-5" style={{ color: `rgb(${tier.color})` }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tier.description}</p>
              </div>

              <div className="mb-1">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  ${tier.price.toLocaleString()}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{tier.period}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                + ${tier.onboarding.toLocaleString()} one-time onboarding
              </p>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: `rgb(${tier.color})` }} />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="mailto:hello@flipops.io?subject=FlipOps Enterprise Inquiry">
                <Button variant="outline" size="lg" className="w-full">
                  Contact Sales
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
