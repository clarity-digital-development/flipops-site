'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { SectionPill } from './section-pill';
import { ArrowRight, RefreshCw, Hammer, Building2, Users } from 'lucide-react';

const personas = [
  {
    id: 'wholesaler',
    icon: RefreshCw,
    title: "I'm a Wholesaler",
    description: 'Find motivated sellers faster and move deals in days, not weeks.',
    href: '/for/wholesalers',
    accentColor: 'blue',
    gradient: 'from-blue-500 to-blue-600',
    borderColor: 'border-blue-500/30 dark:border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/60 dark:hover:border-blue-400/40',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'flipper',
    icon: Hammer,
    title: "I'm a Fix-and-Flipper",
    description: 'Score leads, track rehab budgets, and protect your margins on every project.',
    href: '/for/fix-and-flippers',
    accentColor: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30 dark:border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/60 dark:hover:border-amber-400/40',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'brrrr',
    icon: Building2,
    title: "I'm a BRRRR Investor",
    description: 'From distressed property to cash-flowing rental — managed in one platform.',
    href: '/for/brrrr-investors',
    accentColor: 'emerald',
    gradient: 'from-emerald-500 to-teal-500',
    borderColor: 'border-emerald-500/30 dark:border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-500/60 dark:hover:border-emerald-400/40',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
];

export function PersonaRouting() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const cardStyle = (persona: typeof personas[0]) => isDarkMode ? {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.015) 100%)',
    boxShadow: [
      '0 0 0 1px rgba(255, 255, 255, 0.06)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
      '0 2px 8px rgba(0, 0, 0, 0.25)',
      '0 8px 20px rgba(0, 0, 0, 0.2)',
    ].join(', '),
  } : {
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
    boxShadow: [
      '0 0 0 1px rgba(0, 0, 0, 0.06)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
      'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
      '0 1px 2px rgba(0, 0, 0, 0.04)',
      '0 4px 12px rgba(0, 0, 0, 0.06)',
      '0 12px 32px rgba(0, 0, 0, 0.04)',
    ].join(', '),
  };

  return (
    <section className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/25"
            glowColor="168, 85, 247"
            staggerIndex={0}
          >
            <Users className="h-4 w-4" />
            Built for Every Strategy
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-purple">
            How Do You Invest?
          </h2>
          <p className="relative z-10 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            FlipOps adapts to your strategy. Choose your path to see how.
          </p>
        </motion.div>

        {/* Persona Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {personas.map((persona, index) => {
            const Icon = persona.icon;
            return (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={persona.href} className="block group">
                  <div
                    className={`rounded-2xl p-6 border ${persona.borderColor} ${persona.hoverBorder} transition-all duration-300 group-hover:-translate-y-1`}
                    style={cardStyle(persona)}
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${persona.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className={`h-6 w-6 ${persona.iconColor}`} />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {persona.title}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                      {persona.description}
                    </p>

                    {/* CTA */}
                    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${persona.iconColor} group-hover:gap-2.5 transition-all`}>
                      See how
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
