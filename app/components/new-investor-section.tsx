'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SectionPill } from './section-pill';
import {
  GraduationCap,
  Users,
  ClipboardCheck,
  Headphones,
  Play,
  Calendar,
  MessageCircle,
  FileText,
  Video,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    id: 'learning',
    icon: GraduationCap,
    title: 'Guided Learning Path',
    color: 'blue',
    items: [
      { icon: BookOpen, text: 'Step-by-step tutorials covering deal analysis, offer strategies, and negotiation basics' },
      { icon: Video, text: 'Video walkthroughs of actual FlipOps features with real examples' },
      { icon: Calendar, text: '"Your First 30 Days" onboarding sequence' },
    ],
  },
  {
    id: 'mentorship',
    icon: Users,
    title: 'Expert Mentorship',
    color: 'purple',
    items: [
      { icon: Calendar, text: 'Monthly group coaching calls with experienced investors' },
      { icon: MessageCircle, text: '1-on-1 strategy sessions for Pro+ plan subscribers' },
      { icon: Users, text: 'Access to investor community forum for questions' },
    ],
  },
  {
    id: 'review',
    icon: ClipboardCheck,
    title: 'Deal Review & Feedback',
    color: 'emerald',
    items: [
      { icon: FileText, text: 'Submit your first 3 deals for expert analysis before making offers' },
      { icon: ClipboardCheck, text: 'Get feedback on your MAO calculations and risk assessment' },
      { icon: Sparkles, text: 'Learn from real examples of what works (and what doesn\'t)' },
    ],
  },
  {
    id: 'support',
    icon: Headphones,
    title: 'Ongoing Support',
    color: 'amber',
    items: [
      { icon: MessageCircle, text: 'Live chat support for platform questions' },
      { icon: Play, text: 'Weekly "Deal Breakdown" webinars analyzing current market opportunities' },
      { icon: FileText, text: 'Templates and scripts for first-time investor conversations' },
    ],
  },
];

const colorClasses = {
  blue: {
    gradient: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-500',
    text: 'text-blue-600 dark:text-blue-400',
    shadow: 'shadow-blue-500/20',
    darkAccent: '59, 130, 246',
  },
  purple: {
    gradient: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
    text: 'text-purple-600 dark:text-purple-400',
    shadow: 'shadow-purple-500/20',
    darkAccent: '168, 85, 247',
  },
  emerald: {
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    shadow: 'shadow-emerald-500/20',
    darkAccent: '16, 185, 129',
  },
  amber: {
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    text: 'text-amber-600 dark:text-amber-400',
    shadow: 'shadow-amber-500/20',
    darkAccent: '245, 158, 11',
  },
};

export function NewInvestorSection() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <section id="new-investors" className="py-16 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-black dark:to-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12 relative"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
            glowColor="45, 212, 191"
            staggerIndex={4}
          >
            <GraduationCap className="h-4 w-4" />
            For New Investors
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            <span className="glow-heading-teal">New to Real Estate?</span><br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              We&apos;ll Get You From Zero to Your First Deal
            </span>
          </h2>
          <p className="relative z-10 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            No big brother required. FlipOps includes everything you need to start investing confidently.
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colors = colorClasses[feature.color as keyof typeof colorClasses];

              const cardStyle = isDarkMode ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                border: 'none',
                boxShadow: [
                  `0 0 0 1px rgba(${colors.darkAccent}, 0.2)`,
                  'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                  '0 2px 4px rgba(0, 0, 0, 0.25)',
                  '0 8px 20px rgba(0, 0, 0, 0.35)',
                  '0 16px 40px rgba(0, 0, 0, 0.25)',
                ].join(', '),
              } : {
                background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
                boxShadow: [
                  `0 0 0 1px rgba(${colors.darkAccent}, 0.12)`,
                  'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                  '0 1px 2px rgba(0, 0, 0, 0.04)',
                  '0 4px 12px rgba(0, 0, 0, 0.06)',
                  '0 12px 32px rgba(0, 0, 0, 0.04)',
                ].join(', '),
              };

              return (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="rounded-xl overflow-hidden"
                  style={cardStyle}
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-r ${colors.gradient} px-5 py-3`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold text-white text-lg">{feature.title}</h3>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-4">
                    {feature.items.map((item, i) => {
                      const ItemIcon = item.icon;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDarkMode ? '' : colors.bg}`}
                            style={isDarkMode ? {
                              background: `rgba(${colors.darkAccent}, 0.1)`,
                              boxShadow: `0 0 0 1px rgba(${colors.darkAccent}, 0.15), inset 0 1px 0 rgba(255,255,255,0.04)`,
                            } : {}}
                          >
                            <ItemIcon className={`h-4 w-4 ${colors.text}`} />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-white/50 leading-relaxed pt-1">
                            {item.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/sign-in">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:brightness-110 shadow-lg shadow-primary/25">
                Start Your Real Estate Journey
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <FileText className="mr-2 h-4 w-4" />
              Get Your First Deal Roadmap
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4" />
              Join Our Next Beginner Workshop
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            Free resources available even before you subscribe
          </p>
        </motion.div>
      </div>
    </section>
  );
}
