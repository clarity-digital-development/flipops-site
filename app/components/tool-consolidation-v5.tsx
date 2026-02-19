'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export function ToolConsolidationV5() {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(categories[0]);

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
    <section className="py-16 lg:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900/50 dark:to-zinc-950 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
            <AlertTriangle className="h-4 w-4" />
            The Hidden Cost of Fragmentation
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Calculate Your Real Savings
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Select the tools you currently use to see how much FlipOps saves you
          </p>
        </motion.div>

        {/* Single Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden"
        >
          {/* Top Section: Your Current Stack */}
          <div className="grid md:grid-cols-[1fr,280px] border-b-2 border-gray-200 dark:border-zinc-700">
            <div className="px-5 py-4 bg-rose-50 dark:bg-rose-950/30 border-b md:border-b-0 md:border-r border-rose-100 dark:border-rose-900">
              <div className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300 mb-1">
                <X className="h-4 w-4" />
                Your Current Stack
              </div>
              <p className="text-xs text-rose-600/70 dark:text-rose-400/70">
                {selectedCount === 0 ? 'Select tools below' : `${selectedCount} ${selectedCount === 1 ? 'tool' : 'tools'} selected, nothing connected`}
              </p>
            </div>

            <div className="px-5 py-4 bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={totalCost}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <div className="text-4xl font-bold text-rose-600 dark:text-rose-400">
                    ${totalCost}
                    <span className="text-xl font-normal text-gray-500">/mo</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    ${(totalCost * 12).toLocaleString()}/year
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Middle Section: Categories */}
          <div className="max-h-[500px] overflow-y-auto">
            {categories.map((category) => {
              const categoryTools = tools.filter(t => t.category === category);
              const isExpanded = expandedCategory === category;
              const selectedInCategory = categoryTools.filter(t => selectedTools.has(t.id)).length;

              return (
                <div key={category} className="border-b border-gray-100 dark:border-zinc-800 last:border-b-0">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group"
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
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
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
                        className="overflow-hidden bg-gray-50/50 dark:bg-zinc-800/30"
                      >
                        <div className="px-5 py-3 space-y-2">
                          {categoryTools.map((tool) => {
                            const isSelected = selectedTools.has(tool.id);
                            return (
                              <label
                                key={tool.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                                  isSelected
                                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 shadow-sm'
                                    : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
                                }`}
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
                                        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/50">
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

          {/* Bottom Section: With FlipOps */}
          <div className="grid md:grid-cols-[1fr,280px] border-t-2 border-gray-200 dark:border-zinc-700">
            <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-950/30 border-b md:border-b-0 md:border-r border-emerald-100 dark:border-emerald-900">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                <Check className="h-4 w-4" />
                With FlipOps
              </div>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                One platform, everything connected
              </p>
            </div>

            <div className="px-5 py-4 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                  All-in-one
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  $149<span className="text-xl font-normal text-gray-500">/mo</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Starting at • $1,788/year
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Savings Callout */}
        <AnimatePresence>
          {totalCost > 149 && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-4xl mx-auto mt-6"
            >
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-xl text-center">
                <div className="text-sm font-medium mb-2 opacity-90">
                  Annual Savings Potential
                </div>
                <div className="text-5xl font-bold mb-2">
                  ${annualSavings.toLocaleString()}
                </div>
                <p className="text-sm opacity-90">
                  Save ${(totalCost - 149).toLocaleString()}/month • ${annualSavings.toLocaleString()}/year with FlipOps
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
