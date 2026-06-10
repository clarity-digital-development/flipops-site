'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Hammer,
  FileText,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Star,
  Phone,
  Mail,
  Calendar,
  ArrowRight,
  TrendingUp,
  Building2,
  MapPin,
  Flame,
} from 'lucide-react';

const tabs = [
  { id: 'vendors', label: 'Vendor Management', icon: Users },
  { id: 'renovations', label: 'Renovation Tracking', icon: Hammer },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'rentals', label: 'Rental Portfolio', icon: Home },
];

// Vendor Management Mockup
function VendorManagementDemo() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
      {/* Vendor Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-xl font-bold text-white">JR</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Johnson Renovations</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm">
                <Star className="h-3 w-3 text-white fill-current" />
                <span className="text-xs font-medium text-white">4.8</span>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                (904) 555-0142
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                johnson@renos.com
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Specialty</div>
            <div className="font-medium text-gray-900 dark:text-white">General Contractor</div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-zinc-700 border-b border-gray-200 dark:border-zinc-700">
        <div className="p-3 text-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">12</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Jobs Completed</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">2</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Active Jobs</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">$142K</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Paid</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">97%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">On-Time Rate</div>
        </div>
      </div>

      {/* Active Jobs */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Active Assignments</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-blue-100 dark:bg-blue-950/50 rounded-lg border border-blue-300 dark:border-blue-700">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">1842 Main St</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Kitchen & Bath Remodel</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">In Progress</div>
              <div className="text-xs text-gray-500">Due: Feb 28</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">892 Oak Ave</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Foundation Repair</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">Scheduled</div>
              <div className="text-xs text-gray-500">Starts: Mar 5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="p-4 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Invoices</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">INV-2024-089</span>
            <span className="font-medium text-gray-900 dark:text-white">$8,450</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">Paid</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">INV-2024-092</span>
            <span className="font-medium text-gray-900 dark:text-white">$12,200</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Renovation Tracking Mockup
function RenovationTrackingDemo() {
  const [activeTab, setActiveTab] = useState<'overview' | 'scope' | 'timeline'>('overview');
  const [hoveredTrade, setHoveredTrade] = useState<string | null>(null);

  const trades = [
    { name: 'Kitchen', budget: 18000, spent: 12400, status: 'in-progress', progress: 65, vendor: 'Johnson Renovations' },
    { name: 'Bath', budget: 8500, spent: 8500, status: 'complete', progress: 100, vendor: 'Johnson Renovations' },
    { name: 'Flooring', budget: 12000, spent: 4200, status: 'in-progress', progress: 35, vendor: 'FloorPro LLC' },
    { name: 'Paint', budget: 6500, spent: 0, status: 'pending', progress: 0, vendor: 'Pro Painters' },
    { name: 'HVAC', budget: 9500, spent: 3400, status: 'in-progress', progress: 40, vendor: 'Cool Air Systems' },
  ];

  const timeline = [
    { label: 'Created', value: 'Jan 10, 2026', done: true },
    { label: 'Started', value: 'Jan 14, 2026', done: true },
    { label: 'Est. Completion', value: 'Mar 8, 2026', done: false },
  ];

  const tradeColors: Record<string, string> = {
    Kitchen: 'bg-blue-500',
    Bath: 'bg-cyan-500',
    Flooring: 'bg-amber-500',
    Paint: 'bg-purple-500',
    HVAC: 'bg-emerald-500',
  };

  const totalBudget = 65000;
  const committed = 52000;
  const spent = 28500;
  const contingency = 6500;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
      {/* Property Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Home className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">1234 Oak Street</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">Jacksonville, FL · 3bd · 2ba · 1,650 sqft</div>
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium flex items-center gap-1 shadow-md shadow-blue-500/20">
            <Hammer className="h-3 w-3" /> Active
          </span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="text-xl font-bold text-gray-900 dark:text-white">${(totalBudget / 1000).toFixed(0)}K</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Budget</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">25%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Target ROI</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="text-xl font-bold text-gray-900 dark:text-white">$285K</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">ARV</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">24d</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Days Active</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-zinc-700">
        {[
          { id: 'overview', label: 'Budget' },
          { id: 'scope', label: 'Scope & Trades' },
          { id: 'timeline', label: 'Timeline' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Segmented Budget Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>${(spent / 1000).toFixed(0)}K spent</span>
                  <span>${((totalBudget - spent) / 1000).toFixed(0)}K left</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(spent / totalBudget) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-emerald-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${((committed - spent) / totalBudget) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-blue-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(contingency / totalBudget) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                    className="h-full bg-amber-400"
                  />
                </div>
              </div>

              {/* Budget Breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg border border-emerald-300 dark:border-emerald-700">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${(spent / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">Spent</div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-lg border border-blue-300 dark:border-blue-700">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">${(committed / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">Committed</div>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-lg border border-amber-300 dark:border-amber-700">
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">${(contingency / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-amber-700 dark:text-amber-300">Contingency</div>
                </div>
              </div>

              {/* Activity Summary */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Bids Received</span>
                  <span className="font-semibold text-gray-900 dark:text-white">4</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600 dark:text-gray-400">Change Orders</span>
                  <span className="font-semibold text-gray-900 dark:text-white">1</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'scope' && (
            <motion.div
              key="scope"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {trades.map((trade, i) => (
                <motion.div
                  key={trade.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  onMouseEnter={() => setHoveredTrade(trade.name)}
                  onMouseLeave={() => setHoveredTrade(null)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    hoveredTrade === trade.name
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 shadow-sm'
                      : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${tradeColors[trade.name]}`} />
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{trade.name}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      trade.status === 'complete'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                        : trade.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400'
                    }`}>
                      {trade.status === 'complete' ? 'Complete' : trade.status === 'in-progress' ? `${trade.progress}%` : 'Pending'}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${trade.progress}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className={tradeColors[trade.name]}
                      style={{ height: '100%' }}
                    />
                  </div>
                  <AnimatePresence>
                    {hoveredTrade === trade.name && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-zinc-600"
                      >
                        <span>{trade.vendor}</span>
                        <span>${(trade.spent / 1000).toFixed(1)}K / ${(trade.budget / 1000).toFixed(0)}K</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.done
                        ? 'bg-emerald-100 dark:bg-emerald-900/50'
                        : 'bg-gray-100 dark:bg-zinc-800'
                    }`}>
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.label}</div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.value}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">Days Active</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">24 days</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-blue-600 dark:text-blue-400">Est. Remaining</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">29 days</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Contracts Mockup
function ContractsDemo() {
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  const contracts = [
    {
      id: '1234-oak',
      address: '1234 Oak Street',
      city: 'Austin, TX 78701',
      price: 185000,
      status: 'escrow' as const,
      closingDate: 'Feb 9, 2026',
      closingBadge: { text: '2d left', type: 'warning' as const },
      workflow: 'Assigned',
      keyDates: [
        { label: 'Created', date: 'Jan 28, 2026' },
        { label: 'Signed', date: 'Jan 31, 2026' },
        { label: 'Escrow Opened', date: 'Feb 2, 2026' },
        { label: 'Closing Date', date: 'Feb 9', badge: '2d left' },
        { label: 'Closed', date: 'Not set' },
      ],
      assignment: { name: 'Marcus Johnson', email: 'marcus@mjcapital.com', fee: 15000 },
      notes: 'Clear title, waiting on final walkthrough',
    },
    {
      id: '567-maple',
      address: '567 Maple Avenue',
      city: 'Dallas, TX 75201',
      price: 225000,
      status: 'signed' as const,
      closingDate: 'Feb 12, 2026',
      closingBadge: { text: '5d left', type: 'info' as const },
      workflow: null,
      keyDates: [
        { label: 'Created', date: 'Jan 25, 2026' },
        { label: 'Signed', date: 'Jan 29, 2026' },
        { label: 'Escrow Opened', date: 'Not set' },
        { label: 'Closing Date', date: 'Feb 12', badge: '5d left' },
        { label: 'Closed', date: 'Not set' },
      ],
      assignment: null,
      notes: 'Awaiting earnest money deposit',
    },
    {
      id: '890-pine',
      address: '890 Pine Road',
      city: 'Houston, TX 77001',
      price: 165000,
      status: 'closed' as const,
      closingDate: 'Not set',
      closingBadge: null,
      workflow: 'Assigned',
      keyDates: [
        { label: 'Created', date: 'Jan 10, 2026' },
        { label: 'Signed', date: 'Jan 12, 2026' },
        { label: 'Escrow Opened', date: 'Jan 15, 2026' },
        { label: 'Closing Date', date: 'Jan 31, 2026' },
        { label: 'Closed', date: 'Jan 31, 2026' },
      ],
      assignment: { name: 'Sarah Chen', email: 'sarah@chengroup.com', fee: 12000 },
      notes: 'Successfully closed - funds disbursed',
    },
    {
      id: '321-cedar',
      address: '321 Cedar Lane',
      city: 'San Antonio, TX 78201',
      price: 195000,
      status: 'pending' as const,
      closingDate: 'Feb 21, 2026',
      closingBadge: { text: '14d', type: 'neutral' as const },
      workflow: null,
      keyDates: [
        { label: 'Created', date: 'Feb 5, 2026' },
        { label: 'Signed', date: 'Not set' },
        { label: 'Escrow Opened', date: 'Not set' },
        { label: 'Closing Date', date: 'Feb 21', badge: '14d' },
        { label: 'Closed', date: 'Not set' },
      ],
      assignment: null,
      notes: 'Waiting for seller signature',
    },
    {
      id: '789-elm',
      address: '789 Elm Boulevard',
      city: 'Fort Worth, TX 76102',
      price: 145000,
      status: 'escrow' as const,
      closingDate: 'Feb 5, 2026',
      closingBadge: { text: '2d overdue', type: 'danger' as const },
      workflow: null,
      keyDates: [
        { label: 'Created', date: 'Jan 15, 2026' },
        { label: 'Signed', date: 'Jan 18, 2026' },
        { label: 'Escrow Opened', date: 'Jan 20, 2026' },
        { label: 'Closing Date', date: 'Feb 5', badge: '2d overdue' },
        { label: 'Closed', date: 'Not set' },
      ],
      assignment: null,
      notes: 'Title issue being resolved - extension filed',
    },
  ];

  const statusConfig = {
    escrow: { label: 'In Escrow', bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-400', icon: Clock },
    signed: { label: 'Signed', bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-400', icon: CheckCircle2 },
    closed: { label: 'Closed', bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
    pending: { label: 'Pending', bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  };

  const badgeConfig = {
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400',
    neutral: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-400',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <div className="col-span-4">Property</div>
        <div className="col-span-2">Purchase Price</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Closing</div>
        <div className="col-span-2">Workflows</div>
      </div>

      {/* Contract Rows */}
      <div className="divide-y divide-gray-200 dark:divide-zinc-700">
        {contracts.map((contract, i) => {
          const status = statusConfig[contract.status];
          const StatusIcon = status.icon;
          const isExpanded = expandedContract === contract.id;

          return (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              onMouseEnter={() => setExpandedContract(contract.id)}
              onMouseLeave={() => setExpandedContract(null)}
            >
              {/* Main Row */}
              <div
                className={`grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer transition-colors ${
                  isExpanded
                    ? 'bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {/* Property */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Home className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{contract.address}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{contract.city}</div>
                  </div>
                </div>

                {/* Purchase Price */}
                <div className="col-span-2 flex items-center">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">
                    ${contract.price.toLocaleString()}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>

                {/* Closing */}
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-sm text-gray-900 dark:text-white">{contract.closingDate}</span>
                  {contract.closingBadge && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeConfig[contract.closingBadge.type]}`}>
                      {contract.closingBadge.text}
                    </span>
                  )}
                </div>

                {/* Workflows */}
                <div className="col-span-2 flex items-center justify-center">
                  {contract.workflow ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-600">
                      <Users className="h-3 w-3" />
                      {contract.workflow}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 bg-blue-50/50 dark:bg-blue-950/10 border-t border-blue-100 dark:border-blue-900/30">
                      <div className="grid md:grid-cols-3 gap-4">
                        {/* Key Dates */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Key Dates</div>
                          <div className="space-y-2">
                            {contract.keyDates.map((date: { label: string; date: string; badge?: string }, j) => (
                              <div key={date.label} className="flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{date.label}</span>
                                <div className="flex items-center gap-2">
                                  {date.badge && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      date.badge.includes('overdue')
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                                    }`}>
                                      {date.badge}
                                    </span>
                                  )}
                                  <span className={`font-medium ${date.date === 'Not set' ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                    {date.date}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Assignment */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Assignment</div>
                          {contract.assignment ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white text-sm">{contract.assignment.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{contract.assignment.email}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-emerald-600 dark:text-emerald-400">${contract.assignment.fee.toLocaleString()}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Assignment Fee</div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400 italic">No assignment set</div>
                          )}
                        </div>

                        {/* Notes */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-gray-200 dark:border-zinc-700">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Notes</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">{contract.notes}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">5 contracts</span> · Hover to expand details
        </span>
      </div>
    </div>
  );
}

// Rental Portfolio Mockup
function RentalPortfolioDemo() {
  const [hoveredProperty, setHoveredProperty] = useState<string | null>(null);

  const portfolioMetrics = [
    { label: 'Monthly Rent', value: '$28,450', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Cash Flow', value: '$12,840', icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Avg Cap Rate', value: '8.2%', icon: TrendingUp, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Portfolio Value', value: '$2.4M', icon: Building2, color: 'text-gray-900 dark:text-white' },
  ];

  const properties = [
    { id: 'main', address: '1842 Main St', city: 'Jacksonville, FL', beds: 3, baths: 2, sqft: 1650, units: 4, rent: 4200, cashFlow: 980, capRate: 8.4, occupancy: 100, leaseExpiry: null, daysLeased: 45 },
    { id: 'oak', address: '892 Oak Ave', city: 'Jacksonville, FL', beds: 2, baths: 1, sqft: 1100, units: 2, rent: 2800, cashFlow: 620, capRate: 7.8, occupancy: 100, leaseExpiry: null, daysLeased: 120 },
    { id: 'cedar', address: '445 Cedar Ln', city: 'Jacksonville, FL', beds: 4, baths: 3, sqft: 2200, units: 6, rent: 7200, cashFlow: 1840, capRate: 9.1, occupancy: 83, leaseExpiry: 'Mar 15', daysLeased: null },
    { id: 'pine', address: '2210 Pine Blvd', city: 'Jacksonville, FL', beds: 2, baths: 2, sqft: 1400, units: 1, rent: 1850, cashFlow: 440, capRate: 9.2, occupancy: 100, leaseExpiry: 'Apr 1', daysLeased: 20 },
  ];

  // Circle parameters - using viewBox for proper centering
  const size = 44;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const hoveredPropertyData = properties.find(p => p.id === hoveredProperty);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
      {/* Portfolio Metrics Header */}
      <div className="grid grid-cols-4 divide-x divide-blue-200 dark:divide-zinc-700 border-b border-gray-200 dark:border-zinc-700 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950/50 dark:to-purple-950/50">
        {portfolioMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="p-4 text-center">
              <div className={`text-xl font-bold ${metric.color}`}>{metric.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                <Icon className="h-3 w-3" />
                {metric.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expiring Leases Alert */}
      <div className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 border-b border-amber-500">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-white" />
          <span className="text-white font-medium">2 leases expiring in 60 days</span>
        </div>
      </div>

      {/* Property Cards */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {hoveredPropertyData ? (
            // Expanded single card view
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onMouseLeave={() => setHoveredProperty(null)}
              className="rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-lg shadow-emerald-500/10 bg-white dark:bg-zinc-900 overflow-hidden"
            >
              {/* Expanded Card Header */}
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-zinc-900">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{hoveredPropertyData.address}</h4>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {hoveredPropertyData.city}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-3">
                      <span>{hoveredPropertyData.beds} bd</span>
                      <span>{hoveredPropertyData.baths} ba</span>
                      <span>{hoveredPropertyData.sqft.toLocaleString()} sqft</span>
                    </div>
                  </div>
                  {/* Larger Occupancy Ring */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-gray-200 dark:text-zinc-700"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={(2 * Math.PI * 28) - (hoveredPropertyData.occupancy / 100) * (2 * Math.PI * 28)}
                        className={hoveredPropertyData.occupancy === 100 ? 'text-emerald-500' : 'text-amber-500'}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{hoveredPropertyData.occupancy}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Metrics */}
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Rent</div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${hoveredPropertyData.rent.toLocaleString()}</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Cash Flow</div>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      ${hoveredPropertyData.cashFlow}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Cap Rate</div>
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {hoveredPropertyData.capRate}%
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Leased
                  </span>
                  {hoveredPropertyData.daysLeased && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400">
                      <Flame className="h-3 w-3" />
                      {hoveredPropertyData.daysLeased}d
                    </span>
                  )}
                  {hoveredPropertyData.leaseExpiry && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      Expires {hoveredPropertyData.leaseExpiry}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Users className="h-3 w-3" />
                    {hoveredPropertyData.units > 1 ? `${hoveredPropertyData.units} tenants` : '1 tenant'}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            // Grid of collapsed cards
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-2 gap-3"
            >
              {properties.map((property) => {
                const strokeDashoffset = circumference - (property.occupancy / 100) * circumference;

                return (
                  <div
                    key={property.id}
                    onMouseEnter={() => setHoveredProperty(property.id)}
                    className="p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{property.address}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{property.units} unit{property.units > 1 ? 's' : ''}</div>
                      </div>
                      {/* Occupancy Ring - Using viewBox for proper centering */}
                      <div className="relative w-11 h-11 flex items-center justify-center">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                          <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className="text-gray-200 dark:text-zinc-700"
                          />
                          <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className={property.occupancy === 100 ? 'text-emerald-500' : 'text-amber-500'}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-gray-900 dark:text-white">{property.occupancy}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Monthly</div>
                        <div className="font-semibold text-gray-900 dark:text-white">${property.rent.toLocaleString()}</div>
                      </div>
                      {property.leaseExpiry && (
                        <div className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/50 text-xs text-amber-700 dark:text-amber-400">
                          Expires {property.leaseExpiry}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ProjectManagementShowcase() {
  const [activeTab, setActiveTab] = useState('vendors');

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            Everything in One Place
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Stop texting contractors for updates. Stop hunting through spreadsheets. Every deal, every deadline, every dollar — tracked.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Tab Description */}
              <div className="text-center mb-6">
                {activeTab === 'vendors' && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Track vendor performance, job history, and invoices. <span className="font-semibold text-gray-900 dark:text-white">No more texting for updates.</span>
                  </p>
                )}
                {activeTab === 'renovations' && (
                  <p className="text-gray-600 dark:text-gray-400">
                    See every task, every vendor assignment, every dollar spent. <span className="font-semibold text-gray-900 dark:text-white">Real-time progress at a glance.</span>
                  </p>
                )}
                {activeTab === 'contracts' && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Every deadline visible. Urgent items flagged. <span className="font-semibold text-gray-900 dark:text-white">Nothing goes stale.</span>
                  </p>
                )}
                {activeTab === 'rentals' && (
                  <p className="text-gray-600 dark:text-gray-400">
                    Portfolio metrics, occupancy tracking, lease alerts. <span className="font-semibold text-gray-900 dark:text-white">Your buy-and-hold dashboard.</span>
                  </p>
                )}
              </div>

              {/* Demo Component */}
              {activeTab === 'vendors' && <VendorManagementDemo />}
              {activeTab === 'renovations' && <RenovationTrackingDemo />}
              {activeTab === 'contracts' && <ContractsDemo />}
              {activeTab === 'rentals' && <RentalPortfolioDemo />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
