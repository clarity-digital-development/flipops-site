'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HelpCircle, ChevronDown, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { SectionPill } from '../components/section-pill';

/* ------------------------------------------------------------------ */
/*  FAQ data                                                           */
/* ------------------------------------------------------------------ */

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  name: string;
  items: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    name: 'General',
    items: [
      {
        question: 'What is FlipOps?',
        answer:
          'FlipOps is a Real Estate Investment Operating System that helps investors find distressed properties, analyze deals, manage renovations, and track rental portfolios — all from one platform.',
      },
      {
        question: 'Who is FlipOps built for?',
        answer:
          'FlipOps serves three types of real estate investors: wholesalers, fix-and-flippers, and BRRRR (buy-rehab-rent-refinance-repeat) operators. Whether you\'re doing your first deal or your hundredth, FlipOps adapts to your strategy.',
      },
      {
        question: 'Is FlipOps available nationwide?',
        answer:
          'FlipOps currently covers Florida — all 67 counties, ~11M parcels self-scraped from public records. National coverage is on our roadmap, with more states coming.',
      },
    ],
  },
  {
    name: 'Features',
    items: [
      {
        question: 'How does the AI distress scoring work?',
        answer:
          'FlipOps scores every property for 15+ distress signals including pre-foreclosure, tax liens, vacancy, and more. Over time, the scoring engine learns your preferences and personalizes lead rankings to match your investment strategy.',
      },
      {
        question: 'What is the MAO calculator?',
        answer:
          'The Maximum Allowable Offer calculator provides a transparent waterfall breakdown: ARV minus repairs, commissions, closing costs, holding costs, and profit target. Every assumption is adjustable per deal.',
      },
      {
        question: 'Do you offer property management features?',
        answer:
          'Yes. FlipOps is the only platform in its category that manages actual rentals — tenants, leases, maintenance requests, and financial reporting. No separate property management software needed.',
      },
      {
        question: 'What are financial guardrails?',
        answer:
          'Automated alerts that protect your margins. FlipOps monitors budget thresholds, deadline risks, and margin erosion across your portfolio and alerts you before problems become costly.',
      },
    ],
  },
  {
    name: 'Pricing & Getting Started',
    items: [
      {
        question: 'How much does FlipOps cost?',
        answer:
          'Plans start at $149/month for the Core plan. See our pricing page for full details.',
      },
      {
        question: 'Is there a free trial?',
        answer:
          'We offer a self-guided demo so you can explore the platform. Reserve your spot to get early access when we launch.',
      },
      {
        question: 'Can I switch plans later?',
        answer:
          'Yes. You can upgrade or downgrade your plan at any time.',
      },
      {
        question: 'What payment methods do you accept?',
        answer:
          'All major credit cards. Enterprise plans support invoicing.',
      },
    ],
  },
  {
    name: 'Data & Integrations',
    items: [
      {
        question: 'Where does the property data come from?',
        answer:
          'Our property data is self-scraped directly from Florida county appraisers, clerks of court, and the Florida Department of Revenue — no third-party data vendor. That\'s ~11M parcels across all 67 Florida counties.',
      },
      {
        question: 'Do you integrate with other tools?',
        answer:
          'We\'re building integrations with title companies (Qualia — coming soon), and plan to add Zapier, Make, and other connectors. Our goal is to replace — not add to — your tool stack.',
      },
      {
        question: 'Is my data secure?',
        answer:
          'Yes. We use industry-standard encryption, secure authentication via Clerk, and follow best practices for data protection.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Accordion item component                                           */
/* ------------------------------------------------------------------ */

function AccordionItem({
  item,
  isOpen,
  onToggle,
  cardStyle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  cardStyle: React.CSSProperties;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={cardStyle}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
      >
        <span className="text-base font-medium text-gray-900 dark:text-white">
          {item.question}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-5 pt-0 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function FAQPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

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

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <>
      <Header />
      <main className="bg-[#f4f4f6] dark:bg-black min-h-screen">
        {/* -------------------------------------------------------- */}
        {/*  Hero                                                     */}
        {/* -------------------------------------------------------- */}
        <section className="pt-32 pb-16 lg:pb-20">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
              <Link
                href="/"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white">FAQ</span>
            </nav>

            <div className="flex flex-col items-start">
              <SectionPill
                glowColor="45, 212, 191"
                pillClassName="bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Got Questions?
              </SectionPill>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 max-w-4xl mt-6 glow-heading-teal">
              Frequently Asked Questions
            </h1>
            <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl">
              Everything you need to know about FlipOps.
            </p>
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  FAQ accordion                                            */}
        {/* -------------------------------------------------------- */}
        <section className="pb-20 lg:pb-28">
          <div className="container mx-auto px-4 max-w-4xl">
            {faqCategories.map((category) => (
              <div key={category.name} className="mb-12 last:mb-0">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-5">
                  {category.name}
                </h2>
                <div className="space-y-3">
                  {category.items.map((item) => {
                    const key = `${category.name}-${item.question}`;
                    return (
                      <AccordionItem
                        key={key}
                        item={item}
                        isOpen={openItems.has(key)}
                        onToggle={() => toggleItem(key)}
                        cardStyle={cardStyle}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/*  CTA                                                      */}
        {/* -------------------------------------------------------- */}
        <section className="py-20 lg:py-28 border-t border-gray-200 dark:border-white/5">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Still have questions?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              Contact us at{' '}
              <a
                href="mailto:info@flipops.io"
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                info@flipops.io
              </a>
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
