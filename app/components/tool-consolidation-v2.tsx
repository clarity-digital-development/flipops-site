'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Tool {
  id: string;
  name: string;
  category: string;
  cost: number;
  description: string;
  flipopsReplacement: string;
}

const tools: Tool[] = [
  // Lead Generation & Data
  {
    id: 'propstream',
    name: 'PropStream',
    category: 'Lead Generation & Data',
    cost: 99,
    description: 'Property data & list building',
    flipopsReplacement: 'Unified lead intake with built-in distress scoring & nationwide property data',
  },
  {
    id: 'batchleads',
    name: 'BatchLeads',
    category: 'Lead Generation & Data',
    cost: 119,
    description: 'Lead lists & data access',
    flipopsReplacement: 'Automated lead import from multiple sources with instant scoring',
  },
  {
    id: 'dealmachine',
    name: 'DealMachine',
    category: 'Lead Generation & Data',
    cost: 99,
    description: 'Driving for dollars app',
    flipopsReplacement: 'Mobile lead capture integrated directly into your pipeline',
  },

  // CRM & Deal Management
  {
    id: 'resimpli',
    name: 'REsimpli',
    category: 'CRM & Deal Management',
    cost: 199,
    description: 'Real estate investor CRM',
    flipopsReplacement: 'Deal-aware CRM with automated ROI tracking, MAO calculations, and guardrails',
  },
  {
    id: 'freedomsoft',
    name: 'FreedomSoft',
    category: 'CRM & Deal Management',
    cost: 197,
    description: 'All-in-one investor platform',
    flipopsReplacement: 'True all-in-one with connected data across every stage of your deal',
  },
  {
    id: 'podio',
    name: 'Podio + REI App',
    category: 'CRM & Deal Management',
    cost: 50,
    description: 'Customizable CRM platform',
    flipopsReplacement: 'Purpose-built for investors with no setup required',
  },
  {
    id: 'reipro',
    name: 'REIPro',
    category: 'CRM & Deal Management',
    cost: 147,
    description: 'Lead generation & CRM',
    flipopsReplacement: 'Combined lead scoring, CRM, and project tracking in one view',
  },

  // Skip Tracing
  {
    id: 'batchskiptracing',
    name: 'BatchSkipTracing',
    category: 'Skip Tracing',
    cost: 75,
    description: 'Contact info lookup (est. $75/mo usage)',
    flipopsReplacement: 'Built-in skip tracing with pay-as-you-go pricing, no monthly fee',
  },
  {
    id: 'mojoskiptracer',
    name: 'Mojo Skip Tracer',
    category: 'Skip Tracing',
    cost: 49,
    description: 'Phone number lookup',
    flipopsReplacement: 'Integrated skip tracing with instant results in your lead view',
  },

  // Communication & Calling
  {
    id: 'mojodialer',
    name: 'Mojo Dialer',
    category: 'Communication & Calling',
    cost: 99,
    description: 'Power dialer for outreach',
    flipopsReplacement: 'Built-in dialer with automatic activity logging to CRM',
  },
  {
    id: 'callrail',
    name: 'CallRail',
    category: 'Communication & Calling',
    cost: 45,
    description: 'Call tracking & analytics',
    flipopsReplacement: 'Integrated call tracking with automatic lead attribution',
  },
  {
    id: 'ringcentral',
    name: 'RingCentral',
    category: 'Communication & Calling',
    cost: 30,
    description: 'Business phone system',
    flipopsReplacement: 'VoIP calling with SMS, all logged to property records',
  },
  {
    id: 'grasshopper',
    name: 'Grasshopper',
    category: 'Communication & Calling',
    cost: 26,
    description: 'Virtual business phone',
    flipopsReplacement: 'Business phone numbers with automatic CRM sync',
  },

  // Marketing Automation
  {
    id: 'launchcontrol',
    name: 'Launch Control',
    category: 'Marketing Automation',
    cost: 99,
    description: 'Direct mail campaigns',
    flipopsReplacement: 'Automated marketing with lead score triggers and response tracking',
  },
  {
    id: 'reirply',
    name: 'REI Reply',
    category: 'Marketing Automation',
    cost: 79,
    description: 'SMS & email automation',
    flipopsReplacement: 'Built-in omnichannel campaigns with deal-context awareness',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'Marketing Automation',
    cost: 35,
    description: 'Email marketing',
    flipopsReplacement: 'Email campaigns with property-specific merge tags',
  },

  // Contracts & Documents
  {
    id: 'pandadoc',
    name: 'PandaDoc',
    category: 'Contracts & Documents',
    cost: 49,
    description: 'Contract management (Business plan)',
    flipopsReplacement: 'Contract templates auto-populated from deal data with e-signature',
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'Contracts & Documents',
    cost: 40,
    description: 'Electronic signatures',
    flipopsReplacement: 'E-signatures integrated with your contract workflow',
  },

  // Project Management
  {
    id: 'buildertrend',
    name: 'Buildertrend',
    category: 'Project Management',
    cost: 99,
    description: 'Construction project management',
    flipopsReplacement: 'Renovation tracking with budget alerts tied to your deal profit',
  },
  {
    id: 'smrtphone',
    name: 'smrtPhone',
    category: 'Project Management',
    cost: 75,
    description: 'Rehab project tracking',
    flipopsReplacement: 'Project milestones with real-time margin protection',
  },
  {
    id: 'coconstruct',
    name: 'CoConstruct',
    category: 'Project Management',
    cost: 99,
    description: 'Custom home builder software',
    flipopsReplacement: 'Rehab management with automatic budget vs. actual tracking',
  },

  // Accounting & Finance
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'Accounting & Finance',
    cost: 65,
    description: 'Accounting software (Plus plan)',
    flipopsReplacement: 'Financial tracking with property-level P&L and portfolio dashboard',
  },
  {
    id: 'stessa',
    name: 'Stessa Pro',
    category: 'Accounting & Finance',
    cost: 20,
    description: 'Rental property accounting (Pro plan est.)',
    flipopsReplacement: 'Portfolio dashboard with automated rent tracking and expenses',
  },
  {
    id: 'landlordstudio',
    name: 'Landlord Studio',
    category: 'Accounting & Finance',
    cost: 15,
    description: 'Rental property finances',
    flipopsReplacement: 'Integrated portfolio accounting with lease management',
  },

  // Property Management
  {
    id: 'buildium',
    name: 'Buildium',
    category: 'Property Management',
    cost: 50,
    description: 'Property management platform',
    flipopsReplacement: 'Rental portfolio with tenant tracking, lease alerts, and cashflow analysis',
  },
  {
    id: 'appfolio',
    name: 'AppFolio',
    category: 'Property Management',
    cost: 280,
    description: 'Property management (Base plan)',
    flipopsReplacement: 'Lightweight portfolio management for small-to-mid portfolios',
  },
  {
    id: 'spreadsheet',
    name: 'Spreadsheets',
    category: 'Property Management',
    cost: 0,
    description: 'Manual tracking (Free but time-consuming)',
    flipopsReplacement: 'Automated portfolio dashboard that scales with your business',
  },
];

const categories = Array.from(new Set(tools.map(t => t.category)));

export function ToolConsolidationV2() {
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
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
            <AlertTriangle className="h-4 w-4" />
            The Hidden Cost of Fragmentation
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Calculate Your Real Savings
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Select the tools you currently use to see how much FlipOps saves you every month
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.5fr,1fr] gap-8">
          {/* Left: Tool Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden"
          >
            <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Your Current Stack</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedCount === 0 ? 'Select tools below' : `${selectedCount} ${selectedCount === 1 ? 'tool' : 'tools'} selected`}
              </p>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {categories.map((category) => {
                const categoryTools = tools.filter(t => t.category === category);
                const isExpanded = expandedCategory === category;

                return (
                  <div key={category} className="border-b border-gray-100 dark:border-zinc-800 last:border-b-0">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-sm font-medium text-gray-900 dark:text-white transition-colors ${
                          categoryTools.some(t => selectedTools.has(t.id)) ? 'text-blue-600 dark:text-blue-400' : ''
                        }`}>
                          {category}
                        </div>
                        {categoryTools.some(t => selectedTools.has(t.id)) && (
                          <div className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {categoryTools.filter(t => selectedTools.has(t.id)).length}
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-4 space-y-3">
                            {categoryTools.map((tool) => (
                              <label
                                key={tool.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/30 ${
                                  selectedTools.has(tool.id)
                                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20'
                                    : 'border-gray-200 dark:border-zinc-700'
                                }`}
                              >
                                <Checkbox
                                  checked={selectedTools.has(tool.id)}
                                  onCheckedChange={() => toggleTool(tool.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                                      {tool.name}
                                    </span>
                                    <span className={`text-sm font-bold flex-shrink-0 ${
                                      tool.cost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'
                                    }`}>
                                      {tool.cost > 0 ? `$${tool.cost}/mo` : 'Free*'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                    {tool.description}
                                  </p>
                                  <AnimatePresence>
                                    {selectedTools.has(tool.id) && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                                          <div className="flex items-start gap-2">
                                            <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                              <span className="font-medium">FlipOps:</span> {tool.flipopsReplacement}
                                            </p>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </label>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Right: Cost Comparison */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="lg:sticky lg:top-8 space-y-6 h-fit"
          >
            {/* Current Stack Cost */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300 mb-1">
                  <X className="h-4 w-4" />
                  Your Current Stack
                </div>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70">
                  {selectedCount} {selectedCount === 1 ? 'tool' : 'separate tools'}, nothing connected
                </p>
              </div>

              <div className="px-6 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={totalCost}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <div className="text-5xl font-bold text-rose-600 dark:text-rose-400 mb-2">
                      ${totalCost.toLocaleString()}
                      <span className="text-2xl font-normal text-gray-500">/mo</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ${(totalCost * 12).toLocaleString()}/year
                    </p>
                    {selectedCount > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                        All prices are starting monthly costs
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* FlipOps Cost */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                  <Check className="h-4 w-4" />
                  With FlipOps
                </div>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  One platform, everything connected
                </p>
              </div>

              <div className="px-6 py-8 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  All-in-one
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  $149<span className="text-lg font-normal text-gray-500">/mo</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Starting at • $1,788/year
                </p>
              </div>
            </div>

            {/* Savings Callout */}
            <AnimatePresence>
              {totalCost > 149 && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white shadow-xl"
                >
                  <div className="text-center">
                    <div className="text-sm font-medium mb-2 opacity-90">
                      Annual Savings Potential
                    </div>
                    <div className="text-4xl font-bold mb-1">
                      ${annualSavings.toLocaleString()}
                    </div>
                    <p className="text-sm opacity-75">
                      Save ${(totalCost - 149).toLocaleString()}/month with FlipOps
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {selectedCount === 0 && (
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  👈 Select the tools you currently use to calculate your savings
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Footnote */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12 space-y-2"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            *Free tools cost you time and sanity. Hidden costs add up fast when nothing talks to each other.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            All prices are starting monthly costs (not annual divided by 12). Your actual costs may be higher with premium plans, per-user licenses, and usage fees.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
