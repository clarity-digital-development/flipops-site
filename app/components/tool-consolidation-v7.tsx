'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle } from 'lucide-react';

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

export function ToolConsolidationV7() {
  // Map of category -> selected tool id
  const [selectedByCategory, setSelectedByCategory] = useState<Map<string, string>>(new Map());

  const handleCategoryChange = (category: string, toolId: string) => {
    const newSelected = new Map(selectedByCategory);
    if (toolId === 'none') {
      newSelected.delete(category);
    } else {
      newSelected.set(category, toolId);
    }
    setSelectedByCategory(newSelected);
  };

  const totalCost = useMemo(() => {
    let sum = 0;
    selectedByCategory.forEach((toolId) => {
      const tool = tools.find(t => t.id === toolId);
      if (tool) sum += tool.cost;
    });
    return sum;
  }, [selectedByCategory]);

  const selectedTools = useMemo(() => {
    return Array.from(selectedByCategory.values())
      .map(toolId => tools.find(t => t.id === toolId))
      .filter(Boolean) as Tool[];
  }, [selectedByCategory]);

  const annualSavings = Math.max(0, (totalCost * 12) - (149 * 12));
  const selectedCount = selectedTools.length;

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

        {/* Main Container with Two-Column Layout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden"
        >
          <div className="grid md:grid-cols-[1fr,220px]">
            {/* Left: Dropdown Selectors */}
            <div className="md:border-r border-gray-200 dark:border-zinc-700">
              {/* Header */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Your Current Stack</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {selectedCount === 0 ? 'Select your tools below' : `${selectedCount} ${selectedCount === 1 ? 'tool' : 'tools'} selected`}
                </p>
              </div>

              {/* Category Dropdowns */}
              <div className="p-6 space-y-4 min-h-[560px] max-h-[560px] overflow-y-auto">
                {categories.map((category) => {
                  const categoryTools = tools.filter(t => t.category === category);
                  const selectedToolId = selectedByCategory.get(category);
                  const selectedTool = selectedToolId ? tools.find(t => t.id === selectedToolId) : null;

                  return (
                    <div key={category}>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        {category}
                      </label>
                      <select
                        value={selectedToolId || 'none'}
                        onChange={(e) => handleCategoryChange(category, e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value="none">None selected</option>
                        {categoryTools.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.name} - ${tool.cost > 0 ? `${tool.cost}/mo` : 'Free'}
                          </option>
                        ))}
                      </select>

                      {/* Show replacement info when tool is selected */}
                      <AnimatePresence>
                        {selectedTool && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                  <span className="font-semibold">FlipOps replaces:</span> {selectedTool.replacement}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Cost Sidebar */}
            <div className="flex flex-col min-h-[560px]">
              {/* Top: Current Stack Cost */}
              <div className="flex-1 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 flex flex-col items-center justify-center p-5">
                <div className="flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300 mb-3">
                  <X className="h-3.5 w-3.5" />
                  <span>Your Stack</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={totalCost}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-center"
                  >
                    <div className="text-4xl font-bold text-rose-600 dark:text-rose-400 mb-1">
                      ${totalCost}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      per month
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      ${(totalCost * 12).toLocaleString()}/year
                    </div>
                  </motion.div>
                </AnimatePresence>
                <p className="text-xs text-center text-rose-600/70 dark:text-rose-400/70 mt-3">
                  {selectedCount} {selectedCount === 1 ? 'tool' : 'tools'}<br />
                  nothing connected
                </p>
              </div>

              {/* Bottom: FlipOps Cost */}
              <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 flex flex-col items-center justify-center p-5">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-3">
                  <Check className="h-3.5 w-3.5" />
                  <span>With FlipOps</span>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    All-in-one
                  </div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                    $149
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    per month
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Starting at • $1,788/year
                  </div>
                </div>
                <p className="text-xs text-center text-emerald-600/70 dark:text-emerald-400/70 mt-3">
                  One platform<br />
                  everything connected
                </p>
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
              className="max-w-5xl mx-auto mt-6"
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
