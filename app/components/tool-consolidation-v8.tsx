'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionPill } from './section-pill';
import { Check, X, AlertTriangle, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Tool {
  id: string;
  name: string;
  category: string;
  cost: number;
  shortDesc: string;
  replacement: string;
}

const tools: Tool[] = [
  // Lead Generation & Data
  { id: 'propstream', name: 'PropStream', category: 'Lead Generation & Data', cost: 99, shortDesc: 'Property data & list building', replacement: 'Built-in property data with distress scoring & nationwide coverage' },
  { id: 'batchleads', name: 'BatchLeads', category: 'Lead Generation & Data', cost: 119, shortDesc: 'Lead lists & data access', replacement: 'Automated lead import with instant scoring' },
  { id: 'dealmachine', name: 'DealMachine', category: 'Lead Generation & Data', cost: 99, shortDesc: 'Driving for dollars app', replacement: 'Mobile lead capture integrated into pipeline' },

  // CRM
  { id: 'resimpli', name: 'REsimpli', category: 'CRM & Deal Management', cost: 199, shortDesc: 'Real estate investor CRM', replacement: 'Deal-aware CRM with automated ROI tracking, MAO calculations, and guardrails' },
  { id: 'freedomsoft', name: 'FreedomSoft', category: 'CRM & Deal Management', cost: 197, shortDesc: 'All-in-one investor platform', replacement: 'True all-in-one with connected data across every deal stage' },
  { id: 'podio', name: 'Podio + REI App', category: 'CRM & Deal Management', cost: 50, shortDesc: 'Customizable CRM platform', replacement: 'Purpose-built for investors with no setup required' },
  { id: 'reipro', name: 'REIPro', category: 'CRM & Deal Management', cost: 147, shortDesc: 'Lead generation & CRM', replacement: 'Combined lead scoring, CRM, and project tracking' },

  // Skip Tracing
  { id: 'batchskip', name: 'BatchSkipTracing', category: 'Skip Tracing', cost: 75, shortDesc: 'Contact info lookup (~$75/mo usage)', replacement: 'Built-in skip tracing with pay-as-you-go pricing, no monthly fee' },
  { id: 'mojoskip', name: 'Mojo Skip Tracer', category: 'Skip Tracing', cost: 49, shortDesc: 'Phone number lookup', replacement: 'Integrated skip tracing with instant results in lead view' },

  // Communication
  { id: 'mojodialer', name: 'Mojo Dialer', category: 'Communication & Calling', cost: 99, shortDesc: 'Power dialer for outreach', replacement: 'Built-in dialer with automatic activity logging to CRM' },
  { id: 'callrail', name: 'CallRail', category: 'Communication & Calling', cost: 45, shortDesc: 'Call tracking & analytics', replacement: 'Integrated call tracking with automatic lead attribution' },
  { id: 'ringcentral', name: 'RingCentral', category: 'Communication & Calling', cost: 30, shortDesc: 'Business phone system', replacement: 'VoIP calling with SMS, all logged to property records' },
  { id: 'grasshopper', name: 'Grasshopper', category: 'Communication & Calling', cost: 26, shortDesc: 'Virtual business phone', replacement: 'Business phone numbers with automatic CRM sync' },

  // Marketing
  { id: 'launchcontrol', name: 'Launch Control', category: 'Marketing Automation', cost: 99, shortDesc: 'Direct mail campaigns', replacement: 'Automated marketing with lead score triggers and response tracking' },
  { id: 'reirply', name: 'REI Reply', category: 'Marketing Automation', cost: 79, shortDesc: 'SMS & email automation', replacement: 'Built-in omnichannel campaigns with deal-context awareness' },
  { id: 'mailchimp', name: 'Mailchimp', category: 'Marketing Automation', cost: 35, shortDesc: 'Email marketing', replacement: 'Email campaigns with property-specific merge tags' },

  // Contracts
  { id: 'pandadoc', name: 'PandaDoc', category: 'Contracts & Documents', cost: 49, shortDesc: 'Contract management (Business plan)', replacement: 'Contract templates auto-populated from deal data with e-signature' },
  { id: 'docusign', name: 'DocuSign', category: 'Contracts & Documents', cost: 40, shortDesc: 'Electronic signatures', replacement: 'E-signatures integrated with your contract workflow' },

  // Project Management
  { id: 'buildertrend', name: 'Buildertrend', category: 'Project Management', cost: 99, shortDesc: 'Construction project management', replacement: 'Renovation tracking with budget alerts tied to your deal profit' },
  { id: 'smrtphone', name: 'smrtPhone', category: 'Project Management', cost: 75, shortDesc: 'Rehab project tracking', replacement: 'Project milestones with real-time margin protection' },
  { id: 'coconstruct', name: 'CoConstruct', category: 'Project Management', cost: 99, shortDesc: 'Custom home builder software', replacement: 'Rehab management with automatic budget vs. actual tracking' },

  // Accounting
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting & Finance', cost: 65, shortDesc: 'Accounting software (Plus plan)', replacement: 'Financial tracking with property-level P&L and portfolio dashboard' },
  { id: 'stessa', name: 'Stessa Pro', category: 'Accounting & Finance', cost: 20, shortDesc: 'Rental property accounting (Pro)', replacement: 'Portfolio dashboard with automated rent tracking and expenses' },
  { id: 'landlordstudio', name: 'Landlord Studio', category: 'Accounting & Finance', cost: 15, shortDesc: 'Rental property finances', replacement: 'Integrated portfolio accounting with lease management' },

  // Property Management
  { id: 'buildium', name: 'Buildium', category: 'Property Management', cost: 50, shortDesc: 'Property management platform', replacement: 'Rental portfolio with tenant tracking, lease alerts, and cashflow analysis' },
  { id: 'appfolio', name: 'AppFolio', category: 'Property Management', cost: 280, shortDesc: 'Property management (Base plan)', replacement: 'Lightweight portfolio management for small-to-mid portfolios' },
  { id: 'spreadsheet', name: 'Spreadsheets', category: 'Property Management', cost: 0, shortDesc: 'Manual tracking (Free but time-consuming)', replacement: 'Automated portfolio dashboard that scales with your business' },
];

const categories = Array.from(new Set(tools.map(t => t.category)));

export function ToolConsolidationV8() {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const toggleTool = (toolId: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolId)) {
      newSelected.delete(toolId);
    } else {
      newSelected.add(toolId);
    }
    setSelectedTools(newSelected);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const totalCost = useMemo(() => {
    return Array.from(selectedTools).reduce((sum, toolId) => {
      const tool = tools.find(t => t.id === toolId);
      return sum + (tool?.cost || 0);
    }, 0);
  }, [selectedTools]);

  const annualSavings = Math.max(0, (totalCost * 12) - (149 * 12));
  const selectedCount = selectedTools.size;

  return (
    <section id="savings" className="py-16 lg:py-24 bg-[#f4f4f6] dark:bg-black overflow-x-clip">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <SectionPill
            className="mb-4 relative z-[1]"
            pillClassName="bg-gradient-to-r from-rose-500 to-pink-500 shadow-lg shadow-rose-500/25"
            glowColor="244, 63, 94"
            staggerIndex={2}
          >
            <AlertTriangle className="h-4 w-4" />
            The Hidden Cost of Fragmentation
          </SectionPill>
          <h2 className="relative z-10 text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-rose">
            Calculate Your Real Savings
          </h2>
          <p className="relative z-10 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Select the tools you currently use to see how much FlipOps saves you
          </p>
        </motion.div>

        {/* Two-Column Grid Layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column: Tool Selection */}
            <div
              className="rounded-xl overflow-hidden"
              style={isDarkMode ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                boxShadow: [
                  '0 0 0 1px rgba(255, 255, 255, 0.08)',
                  'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                  '0 2px 4px rgba(0, 0, 0, 0.25)',
                  '0 8px 20px rgba(0, 0, 0, 0.35)',
                  '0 16px 40px rgba(0, 0, 0, 0.25)',
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
              }}
            >
              {/* Header */}
              <div
                className="px-5 py-3"
                style={isDarkMode ? {
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                  borderBottom: '1px solid rgba(0,0,0,0.4)',
                  boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.2)',
                } : {
                  background: '#f9fafb',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">Your Current Stack</h3>
                <p className="text-xs text-gray-500 dark:text-white/30 mt-0.5">
                  {selectedCount === 0 ? 'Select tools below' : `${selectedCount} ${selectedCount === 1 ? 'tool' : 'tools'} selected`}
                </p>
              </div>

              {/* Categories */}
              <div className="max-h-[600px] overflow-y-auto">
                {categories.map((category) => {
                  const categoryTools = tools.filter(t => t.category === category);
                  const isExpanded = expandedCategory === category;
                  const selectedInCategory = categoryTools.filter(t => selectedTools.has(t.id)).length;

                  return (
                    <div
                      key={category}
                      className={isDarkMode ? 'last:border-b-0' : 'border-b border-gray-100 last:border-b-0'}
                      style={isDarkMode ? {
                        borderBottom: '1px solid rgba(0,0,0,0.4)',
                        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)',
                      } : {}}
                    >
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                          </motion.div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {category}
                          </span>
                          {selectedInCategory > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium shadow-sm">
                              {selectedInCategory}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {categoryTools.length} {categoryTools.length === 1 ? 'tool' : 'tools'}
                        </span>
                      </button>

                      {/* Category Tools */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`overflow-hidden ${isDarkMode ? '' : 'bg-gray-50/50'}`}
                            style={isDarkMode ? { background: 'rgba(0,0,0,0.15)' } : {}}
                          >
                            <div className="px-5 py-3 space-y-2">
                              {categoryTools.map((tool) => {
                                const isSelected = selectedTools.has(tool.id);
                                return (
                                  <label
                                    key={tool.id}
                                    className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer hover:shadow-sm ${
                                      isDarkMode
                                        ? ''
                                        : isSelected
                                          ? 'border border-blue-300 bg-blue-50 shadow-sm'
                                          : 'border border-gray-200 hover:border-gray-300'
                                    }`}
                                    style={isDarkMode ? {
                                      background: isSelected
                                        ? 'linear-gradient(180deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.04) 100%)'
                                        : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
                                      boxShadow: [
                                        `0 0 0 1px ${isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)'}`,
                                        'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                                        'inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
                                        '0 1px 3px rgba(0, 0, 0, 0.15)',
                                      ].join(', '),
                                    } : {}}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleTool(tool.id)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                                          {tool.name}
                                        </span>
                                        <span className={`text-sm font-bold flex-shrink-0 ${
                                          tool.cost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'
                                        }`}>
                                          {tool.cost > 0 ? `$${tool.cost}/mo` : 'Free*'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-600 dark:text-gray-400">
                                        {tool.shortDesc}
                                      </p>

                                      {/* Replacement Info (shown when selected) */}
                                      <AnimatePresence>
                                        {isSelected && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="mt-2 pt-2 border-t border-blue-200 dark:border-white/[0.05]">
                                              <div className="flex items-start gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                                  <span className="font-semibold">FlipOps:</span> {tool.replacement}
                                                </p>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Cost Display (Sticky) */}
            <div className="md:sticky md:top-4 md:self-start">
              <div
                className="rounded-xl overflow-hidden"
                style={isDarkMode ? {
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 40%, rgba(255,255,255,0.015) 100%)',
                  boxShadow: [
                    '0 0 0 1px rgba(255, 255, 255, 0.08)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                    '0 2px 4px rgba(0, 0, 0, 0.25)',
                    '0 8px 20px rgba(0, 0, 0, 0.35)',
                    '0 16px 40px rgba(0, 0, 0, 0.25)',
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
                }}
              >
                {/* Your Stack Cost */}
                <div
                  className="bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.15)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
                    <X className="h-4 w-4" />
                    <span>Your Stack</span>
                  </div>
                </div>
                <div
                  className="p-8 text-center"
                  style={isDarkMode ? {
                    background: 'linear-gradient(180deg, rgba(244,63,94,0.12) 0%, rgba(244,63,94,0.05) 100%)',
                    borderBottom: '1px solid rgba(0,0,0,0.4)',
                    boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.04)',
                  } : {
                    background: 'linear-gradient(180deg, rgba(244, 63, 94, 0.07) 0%, rgba(244, 63, 94, 0.03) 100%)',
                    borderBottom: '1px solid rgba(244, 63, 94, 0.12)',
                    boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={totalCost}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-5xl font-bold text-rose-600 dark:text-rose-400 mb-2">
                        ${totalCost}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white/40">
                        per month
                      </div>
                      <div className="text-sm text-gray-400 dark:text-white/30 mt-2">
                        ${(totalCost * 12).toLocaleString()}/year
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <p className="text-xs text-rose-600/70 dark:text-rose-400/50 mt-4">
                    {selectedCount} {selectedCount === 1 ? 'tool' : 'tools'}<br />
                    nothing connected
                  </p>
                </div>

                {/* FlipOps Cost */}
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 3px rgba(0,0,0,0.15)',
                  }}
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
                    <Check className="h-4 w-4" />
                    <span>With FlipOps</span>
                  </div>
                </div>
                <div
                  className="p-8 text-center"
                  style={isDarkMode ? {
                    background: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.04) 100%)',
                  } : {
                    background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%)',
                  }}
                >
                  <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                    Annual Savings Potential
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={annualSavings}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                        ${annualSavings.toLocaleString()}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  <div className="text-sm text-gray-500 dark:text-white/40 mt-4">
                    Starting at $149 a month
                  </div>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/50 mt-3">
                    One platform<br />
                    everything connected
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-8 space-y-2"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            *Free tools cost you time and sanity. Hidden costs add up fast when nothing talks to each other.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            All prices are starting monthly costs (not annual ÷ 12). Your actual costs may be higher with premium plans, per-user licenses, and usage fees.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
