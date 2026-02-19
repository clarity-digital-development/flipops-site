'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  { id: 'propstream', name: 'PropStream', category: 'Data', cost: 99, shortDesc: 'Property data', replacement: 'Built-in property data with distress scoring' },
  { id: 'batchleads', name: 'BatchLeads', category: 'Data', cost: 119, shortDesc: 'Lead lists', replacement: 'Automated lead import with scoring' },
  { id: 'dealmachine', name: 'DealMachine', category: 'Data', cost: 99, shortDesc: 'Driving for $', replacement: 'Mobile lead capture in pipeline' },

  // CRM
  { id: 'resimpli', name: 'REsimpli', category: 'CRM', cost: 199, shortDesc: 'Investor CRM', replacement: 'Deal-aware CRM with ROI tracking & guardrails' },
  { id: 'freedomsoft', name: 'FreedomSoft', category: 'CRM', cost: 197, shortDesc: 'All-in-one', replacement: 'True all-in-one with connected data' },
  { id: 'podio', name: 'Podio + REI', category: 'CRM', cost: 50, shortDesc: 'Custom CRM', replacement: 'Purpose-built, no setup needed' },
  { id: 'reipro', name: 'REIPro', category: 'CRM', cost: 147, shortDesc: 'CRM + leads', replacement: 'Combined scoring, CRM & projects' },

  // Skip Tracing
  { id: 'batchskip', name: 'BatchSkip', category: 'Skip', cost: 75, shortDesc: 'Contact lookup', replacement: 'Built-in skip tracing, pay-as-you-go' },
  { id: 'mojoskip', name: 'Mojo Skip', category: 'Skip', cost: 49, shortDesc: 'Phone lookup', replacement: 'Instant results in lead view' },

  // Communication
  { id: 'mojodialer', name: 'Mojo Dialer', category: 'Calling', cost: 99, shortDesc: 'Power dialer', replacement: 'Built-in dialer with auto CRM logging' },
  { id: 'callrail', name: 'CallRail', category: 'Calling', cost: 45, shortDesc: 'Call tracking', replacement: 'Call tracking with lead attribution' },
  { id: 'ringcentral', name: 'RingCentral', category: 'Calling', cost: 30, shortDesc: 'Phone system', replacement: 'VoIP + SMS logged to properties' },
  { id: 'grasshopper', name: 'Grasshopper', category: 'Calling', cost: 26, shortDesc: 'Virtual phone', replacement: 'Business numbers with CRM sync' },

  // Marketing
  { id: 'launchcontrol', name: 'Launch Control', category: 'Marketing', cost: 99, shortDesc: 'Direct mail', replacement: 'Automated marketing with score triggers' },
  { id: 'reirply', name: 'REI Reply', category: 'Marketing', cost: 79, shortDesc: 'SMS/email', replacement: 'Omnichannel with deal context' },
  { id: 'mailchimp', name: 'Mailchimp', category: 'Marketing', cost: 35, shortDesc: 'Email', replacement: 'Email with property merge tags' },

  // Contracts
  { id: 'pandadoc', name: 'PandaDoc', category: 'Contracts', cost: 49, shortDesc: 'Contracts', replacement: 'Templates auto-filled from deals' },
  { id: 'docusign', name: 'DocuSign', category: 'Contracts', cost: 40, shortDesc: 'E-signatures', replacement: 'E-signatures in workflow' },

  // Project Management
  { id: 'buildertrend', name: 'Buildertrend', category: 'Projects', cost: 99, shortDesc: 'Construction', replacement: 'Rehab tracking with budget alerts' },
  { id: 'smrtphone', name: 'smrtPhone', category: 'Projects', cost: 75, shortDesc: 'Rehab tracking', replacement: 'Milestones with margin protection' },
  { id: 'coconstruct', name: 'CoConstruct', category: 'Projects', cost: 99, shortDesc: 'Builder SW', replacement: 'Budget vs. actual tracking' },

  // Accounting
  { id: 'quickbooks', name: 'QuickBooks', category: 'Accounting', cost: 65, shortDesc: 'Accounting', replacement: 'Property-level P&L + portfolio view' },
  { id: 'stessa', name: 'Stessa Pro', category: 'Accounting', cost: 20, shortDesc: 'Rental $', replacement: 'Portfolio with rent tracking' },
  { id: 'landlordstudio', name: 'Landlord Studio', category: 'Accounting', cost: 15, shortDesc: 'Property $', replacement: 'Portfolio accounting + leases' },

  // Property Management
  { id: 'buildium', name: 'Buildium', category: 'PropMgmt', cost: 50, shortDesc: 'PM platform', replacement: 'Rentals with lease alerts & cashflow' },
  { id: 'appfolio', name: 'AppFolio', category: 'PropMgmt', cost: 280, shortDesc: 'PM software', replacement: 'Lightweight portfolio management' },
  { id: 'spreadsheet', name: 'Spreadsheets', category: 'PropMgmt', cost: 0, shortDesc: 'Manual', replacement: 'Automated dashboard that scales' },
];

const categoryColors: Record<string, string> = {
  'Data': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'CRM': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Skip': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Calling': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'Marketing': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Contracts': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Projects': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Accounting': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'PropMgmt': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

export function ToolConsolidationV3() {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolId)) {
      newSelected.delete(toolId);
    } else {
      newSelected.add(toolId);
    }
    setSelectedTools(newSelected);
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

        {/* Compact Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700 text-xs font-medium text-gray-600 dark:text-gray-400">
              <div className="col-span-1"></div>
              <div className="col-span-5 sm:col-span-4">Tool</div>
              <div className="hidden sm:block sm:col-span-2">Category</div>
              <div className="col-span-3 sm:col-span-2 text-right">Cost/mo</div>
              <div className="col-span-3 sm:col-span-3 text-right">FlipOps Has</div>
            </div>

            {/* Scrollable Tool List */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
              {tools.map((tool, i) => {
                const isSelected = selectedTools.has(tool.id);
                return (
                  <motion.label
                    key={tool.id}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.01 }}
                    viewport={{ once: true, margin: '100px' }}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTool(tool.id)}
                      />
                    </div>

                    <div className="col-span-5 sm:col-span-4 flex flex-col justify-center min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {tool.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate sm:hidden">
                        {tool.shortDesc}
                      </div>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 items-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[tool.category]}`}>
                        {tool.category}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                      <span className={`text-sm font-bold ${tool.cost > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                        {tool.cost > 0 ? `$${tool.cost}` : 'Free*'}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-3 flex items-center justify-end">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Included</span>
                              <Info className="h-3 w-3 opacity-50" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="text-xs">{tool.replacement}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </motion.label>
                );
              })}
            </div>

            {/* Summary Footer */}
            <div className="border-t-2 border-gray-300 dark:border-zinc-600">
              <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-zinc-700">
                {/* Your Stack Total */}
                <div className="px-6 py-5 bg-rose-50 dark:bg-rose-950/30">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Your Current Stack
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={totalCost}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-3xl font-bold text-rose-600 dark:text-rose-400"
                    >
                      ${totalCost}
                      <span className="text-base font-normal text-gray-500">/mo</span>
                    </motion.div>
                  </AnimatePresence>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedCount} {selectedCount === 1 ? 'tool' : 'tools'} selected
                  </div>
                </div>

                {/* FlipOps */}
                <div className="px-6 py-5 bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    With FlipOps
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                    All-in-one
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    $149
                    <span className="text-base font-normal text-gray-500">/mo</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Starting at
                  </div>
                </div>
              </div>

              {/* Savings Callout */}
              <AnimatePresence>
                {totalCost > 149 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-blue-950/30 border-t border-gray-200 dark:border-zinc-700">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Annual savings potential:
                        </span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          ${annualSavings.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footnote */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center mt-6 space-y-2"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              *Free tools cost you time and sanity. Hidden costs add up when nothing connects.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              All prices are starting monthly costs (not annual ÷ 12). Hover "Included" to see how FlipOps replaces each tool.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
