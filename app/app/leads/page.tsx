"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Phone,
  Mail,
  ChevronRight,
  Plus,
  Calendar,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Download,
  Trash2,
  MapPin,
  Building,
  Loader2,
  CheckCircle,
  Users,
  Flame,
  Clock,
  Target,
  ChevronDown,
  X,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { seedProperties } from "./seed-data";

// =============================================================================
// Types
// =============================================================================

interface AttomProperty {
  attomId: string | null;
  apn: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  assessedValue: number | null;
  taxAmount: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  estimatedValue: number | null;
}

interface ReapiProperty {
  reapiId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  ownerName: string | null;
  mailingAddress: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSquareFeet: number | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  assessedValue: number | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  equityPercent: number | null;
  estimatedEquity: number | null;
  openMortgageBalance: number | null;
  preForeclosure: boolean;
  auction: boolean;
  foreclosure: boolean;
  vacant: boolean;
  absenteeOwner: boolean;
  outOfStateOwner: boolean;
  inStateOwner: boolean;
  inherited: boolean;
  death: boolean;
  taxLien: boolean;
  judgment: boolean;
  highEquity: boolean;
  freeClear: boolean;
  corporateOwned: boolean;
  investorBuyer: boolean;
  totalPropertiesOwned: string | null;
  yearsOwned: number | null;
  mlsActive: boolean;
  mlsPending: boolean;
  forSale: boolean;
  distressScore: number;
  distressGrade: string;
  motivation: string;
  distressSignals: string[];
}

type SearchProperty = AttomProperty | ReapiProperty;

function isReapiProperty(p: SearchProperty): p is ReapiProperty {
  return 'reapiId' in p;
}

// Score breakdown types for tooltip
interface ScoreSignal {
  signal: string;
  weight: number;
  present: boolean;
  description: string;
}

interface ScoreBreakdown {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  signals: ScoreSignal[];
  motivation: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName?: string;
  score?: number;
  scoreBreakdown?: string; // JSON string with ScoreBreakdown
  dataSource: string;
  outreachStatus?: string;
  lastContactDate?: string;
  lastContactMethod?: string;
  sentiment?: string;
  nextFollowUpDate?: string;
  phoneNumbers?: string;
  emails?: string;
  contactNotes?: string;
  foreclosure: boolean;
  preForeclosure: boolean;
  taxDelinquent: boolean;
  vacant: boolean;
  createdAt: string;
}

interface ContactNote {
  date: string;
  note: string;
  method: string;
  sentiment?: string;
}

// =============================================================================
// Sort Types
// =============================================================================

type SortColumn = 'score' | 'status' | 'signals' | 'lastContact' | null;
type SortDirection = 'asc' | 'desc';

// =============================================================================
// Sortable Header Component
// =============================================================================

function SortableHeader({
  label,
  column,
  currentColumn,
  currentDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentColumn: SortColumn;
  currentDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = currentColumn === column;

  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded",
        isActive ? "text-foreground font-medium" : "text-muted-foreground"
      )}
    >
      {label}
      {isActive ? (
        currentDirection === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}

// =============================================================================
// Score Visualization Component with Breakdown Tooltip
// =============================================================================

// Parse scoreBreakdown JSON safely
function parseScoreBreakdown(scoreBreakdownJson?: string): ScoreBreakdown | null {
  if (!scoreBreakdownJson) return null;
  try {
    return JSON.parse(scoreBreakdownJson) as ScoreBreakdown;
  } catch {
    return null;
  }
}

// Generate breakdown from property flags if no scoreBreakdown JSON exists
function generateBreakdownFromFlags(property: Property): ScoreSignal[] {
  const signals: ScoreSignal[] = [];

  if (property.preForeclosure) {
    signals.push({ signal: 'PRE_FORECLOSURE', weight: 25, present: true, description: 'Pre-foreclosure filing' });
  }
  if (property.foreclosure) {
    signals.push({ signal: 'FORECLOSURE', weight: 25, present: true, description: 'Active foreclosure' });
  }
  if (property.taxDelinquent) {
    signals.push({ signal: 'TAX_DELINQUENT', weight: 20, present: true, description: 'Tax delinquent property' });
  }
  if (property.vacant) {
    signals.push({ signal: 'VACANT', weight: 15, present: true, description: 'Property is vacant' });
  }

  return signals;
}

// Format signal name for display
function formatSignalName(signal: string): string {
  return signal
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function ScoreGauge({
  score,
  scoreBreakdown,
  property
}: {
  score: number | undefined;
  scoreBreakdown?: string;
  property?: Property;
}) {
  if (!score) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <span className="text-sm text-muted-foreground">-</span>
      </div>
    );
  }

  const getScoreColor = (s: number) => {
    if (s >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', grade: 'A' };
    if (s >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', grade: 'B' };
    if (s >= 35) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', grade: 'C' };
    if (s >= 20) return { bar: 'bg-red-400', text: 'text-red-500 dark:text-red-400', grade: 'D' };
    return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', grade: 'F' };
  };

  const colors = getScoreColor(score);

  // Try to parse score breakdown, or generate from property flags
  const breakdown = parseScoreBreakdown(scoreBreakdown);
  const signals = breakdown?.signals || (property ? generateBreakdownFromFlags(property) : []);
  const hasBreakdown = signals.length > 0;

  const scoreBar = (
    <div className="flex items-center gap-2 cursor-help">
      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", colors.text)}>
        {score}
      </span>
    </div>
  );

  if (!hasBreakdown) {
    return scoreBar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {scoreBar}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg p-0 max-w-xs"
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Distress Score Breakdown
            </span>
            <Badge
              className={cn(
                "text-[10px] px-1.5",
                score >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              )}
            >
              Grade {colors.grade}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {signals.slice(0, 5).map((signal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {formatSignalName(signal.signal)}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">
                  +{signal.weight}
                </span>
              </div>
            ))}
            {signals.length > 5 && (
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-gray-100 dark:border-gray-800">
                +{signals.length - 5} more signals
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs text-gray-500">Total Score</span>
            <span className={cn("text-sm font-bold", colors.text)}>{score}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// =============================================================================
// Stats Cards Component
// =============================================================================

function StatsCards({
  total,
  notContacted,
  hotLeads,
  followUps,
  loading
}: {
  total: number;
  notContacted: number;
  hotLeads: number;
  followUps: number;
  loading: boolean;
}) {
  const stats = [
    {
      label: 'Total Leads',
      value: total,
      icon: Users,
      color: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Not Contacted',
      value: notContacted,
      icon: Target,
      color: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'Hot Leads',
      value: hotLeads,
      icon: Flame,
      color: 'bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400',
      subtitle: 'Score 70+'
    },
    {
      label: 'Follow-ups Due',
      value: followUps,
      icon: Clock,
      color: 'bg-emerald-50 dark:bg-emerald-900/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.color)}>
                <stat.icon className={cn("w-5 h-5", stat.iconColor)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold tracking-tight">{stat.value.toLocaleString()}</p>
                {stat.subtitle && (
                  <p className="text-[10px] text-muted-foreground">{stat.subtitle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Bulk Actions Toolbar
// =============================================================================

function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onBulkUpdateStatus,
  onBulkDelete,
  onBulkExport,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkUpdateStatus: (status: string) => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
}) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-8 px-2">
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Update Status
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('contacted')}>
              Mark as Contacted
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('attempted')}>
              Mark as Attempted
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('negotiating')}>
              Mark as Negotiating
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onBulkUpdateStatus('dead')}>
              Mark as Dead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="h-8" onClick={onBulkExport}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button variant="destructive" size="sm" className="h-8" onClick={onBulkDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Table Skeleton
// =============================================================================

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
          <Skeleton className="h-5 w-5 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-16 h-2 rounded-full" />
            <Skeleton className="h-4 w-8" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Status Badge Component
// =============================================================================

function StatusBadge({ status }: { status?: string }) {
  const getStatusConfig = (s?: string) => {
    switch (s) {
      case 'contacted':
        return { label: 'Contacted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'attempted':
        return { label: 'Attempted', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
      case 'negotiating':
        return { label: 'Negotiating', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
      case 'offer_made':
        return { label: 'Offer Made', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
      case 'under_contract':
        return { label: 'Under Contract', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
      case 'closed':
        return { label: 'Closed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      case 'dead':
        return { label: 'Dead', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      default:
        return { label: 'Not Contacted', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      config.className
    )}>
      {config.label}
    </span>
  );
}

// =============================================================================
// Main Leads Page Component
// =============================================================================

export default function LeadsPage() {
  // Data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Sort state - default to highest score first
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Contact note form state
  const [newNote, setNewNote] = useState("");
  const [noteMethod, setNoteMethod] = useState("phone");
  const [noteSentiment, setNoteSentiment] = useState<string | undefined>();
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Property Search state
  const [searchDataSource, setSearchDataSource] = useState<'attom' | 'reapi'>('reapi');
  const [searchZipCode, setSearchZipCode] = useState("");
  const [searchMinPrice, setSearchMinPrice] = useState("");
  const [searchMaxPrice, setSearchMaxPrice] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchProperty[]>([]);
  const [selectedSearchProperties, setSelectedSearchProperties] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [reapiFilters, setReapiFilters] = useState({
    preForeclosure: false,
    vacant: false,
    absenteeOwner: false,
    highEquity: false,
    inherited: false,
    taxLien: false,
    death: false,
  });

  // ==========================================================================
  // Computed values
  // ==========================================================================

  // Helper function to count distress signals
  const countSignals = useCallback((property: Property): number => {
    let count = 0;
    if (property.foreclosure) count++;
    if (property.preForeclosure) count++;
    if (property.taxDelinquent) count++;
    if (property.vacant) count++;
    return count;
  }, []);

  // Helper function to get status priority for sorting
  const getStatusPriority = useCallback((status?: string): number => {
    // Lower number = contacted first, higher number = not contacted
    switch (status) {
      case 'under_contract':
      case 'closed':
        return 1;
      case 'offer_made':
        return 2;
      case 'negotiating':
        return 3;
      case 'hot':
        return 4;
      case 'contacted':
        return 5;
      case 'attempted':
        return 6;
      case 'follow-up':
        return 7;
      case 'new':
      case 'not_contacted':
      default:
        return 8;
      case 'dnc':
      case 'dead':
        return 9;
    }
  }, []);

  const filteredProperties = useMemo(() => {
    let filtered = properties;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.address.toLowerCase().includes(term) ||
        p.ownerName?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => (p.outreachStatus || 'not_contacted') === statusFilter);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter(p => p.dataSource === sourceFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;

        switch (sortColumn) {
          case 'score':
            // Higher score first when desc, lower first when asc
            comparison = (a.score || 0) - (b.score || 0);
            break;

          case 'signals':
            // More signals first when desc, fewer first when asc
            comparison = countSignals(a) - countSignals(b);
            break;

          case 'status':
            // Contacted (lower priority number) first when asc, not contacted first when desc
            comparison = getStatusPriority(a.outreachStatus) - getStatusPriority(b.outreachStatus);
            break;

          case 'lastContact':
            // Handle null/undefined dates - treat as oldest (sort to end when desc)
            const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
            const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
        }

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [properties, searchTerm, statusFilter, sourceFilter, sortColumn, sortDirection, countSignals, getStatusPriority]);

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: properties.length,
      notContacted: properties.filter(p => !p.outreachStatus || p.outreachStatus === 'not_contacted').length,
      hotLeads: properties.filter(p => (p.score || 0) >= 70).length,
      followUps: properties.filter(p => {
        if (!p.nextFollowUpDate) return false;
        return new Date(p.nextFollowUpDate) <= now;
      }).length,
    };
  }, [properties]);

  const allSelected = filteredProperties.length > 0 && selectedIds.size === filteredProperties.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredProperties.length;

  // Handle column sort click
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      // New column: set appropriate default direction
      setSortColumn(column);
      // Score and Signals default to desc (highest/most first)
      // Status defaults to asc (contacted first)
      // Last Contact defaults to desc (most recent first)
      setSortDirection(column === 'status' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  // ==========================================================================
  // Data fetching
  // ==========================================================================

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const response = await fetch('/api/properties');
      if (!response.ok) {
        // API not available - use seed data as fallback
        console.warn('Properties API not available, using demo data');
        setProperties(seedProperties);
        return;
      }

      const data = await response.json();
      // Use seed data for demo if user has no properties yet
      const props = data.properties || [];
      setProperties(props.length > 0 ? props : seedProperties);
    } catch (error) {
      console.error('Failed to fetch properties, using demo data:', error);
      // Use seed data as fallback instead of showing error
      setProperties(seedProperties);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ==========================================================================
  // Selection handlers
  // ==========================================================================

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProperties.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ==========================================================================
  // Property actions
  // ==========================================================================

  const updatePropertyStatus = async (propertyId: string, status: string) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreachStatus: status }),
      });

      if (response.ok) {
        setProperties(prev => prev.map(p =>
          p.id === propertyId ? { ...p, outreachStatus: status } : p
        ));
        if (selectedProperty?.id === propertyId) {
          setSelectedProperty({ ...selectedProperty, outreachStatus: status });
        }
      }
    } catch (error) {
      console.error('Failed to update property status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleBulkUpdateStatus = async (status: string) => {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(`/api/properties/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outreachStatus: status }),
        });
        if (response.ok) successCount++;
      } catch (error) {
        console.error(`Failed to update property ${id}:`, error);
      }
    }

    if (successCount > 0) {
      setProperties(prev => prev.map(p =>
        selectedIds.has(p.id) ? { ...p, outreachStatus: status } : p
      ));
      toast.success(`Updated ${successCount} properties`);
      clearSelection();
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;

    for (const id of ids) {
      try {
        const response = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
        if (response.ok) successCount++;
      } catch (error) {
        console.error(`Failed to delete property ${id}:`, error);
      }
    }

    if (successCount > 0) {
      setProperties(prev => prev.filter(p => !selectedIds.has(p.id)));
      toast.success(`Deleted ${successCount} properties`);
      clearSelection();
    }
    setBulkDeleteDialogOpen(false);
  };

  const handleBulkExport = () => {
    const selectedProperties = filteredProperties.filter(p => selectedIds.has(p.id));
    exportPropertiesToCSV(selectedProperties);
  };

  const deleteProperty = async () => {
    if (!selectedProperty) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/properties/${selectedProperty.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      toast.success("Property deleted successfully");
      setProperties(prev => prev.filter(p => p.id !== selectedProperty.id));
      setDeleteDialogOpen(false);
      setDrawerOpen(false);
      setSelectedProperty(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete property');
    } finally {
      setDeleting(false);
    }
  };

  const addContactNote = async () => {
    if (!selectedProperty || !newNote.trim()) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/properties/${selectedProperty.id}/contact-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: newNote,
          method: noteMethod,
          sentiment: noteSentiment,
          nextFollowUpDate: nextFollowUp || undefined,
          outreachStatus: 'contacted',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedProperty(data.property);
        setProperties(prev => prev.map(p =>
          p.id === selectedProperty.id ? data.property : p
        ));
        setNewNote("");
        setNoteSentiment(undefined);
        setNextFollowUp("");
        setContactDialogOpen(false);
        toast.success("Contact note added");
      }
    } catch (error) {
      console.error('Failed to add contact note:', error);
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // Search handlers
  // ==========================================================================

  const searchProperties = async () => {
    if (!searchZipCode || searchZipCode.length < 5) {
      toast.error("Please enter a valid ZIP code");
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setSelectedSearchProperties(new Set());

    try {
      if (searchDataSource === 'reapi') {
        const response = await fetch('/api/reapi/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zip: searchZipCode,
            minValue: searchMinPrice ? parseInt(searchMinPrice) : undefined,
            maxValue: searchMaxPrice ? parseInt(searchMaxPrice) : undefined,
            pageSize: 50,
            ...reapiFilters,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Search failed');
        }

        const data = await response.json();
        let results = data.properties || [];

        if (minScore > 0 && results.length > 0) {
          results = results.filter((p: ReapiProperty) => p.distressScore >= minScore);
        }

        setSearchResults(results);

        if (results.length === 0) {
          toast.info(minScore > 0
            ? `No properties found with score ${minScore}+`
            : "No properties found"
          );
        } else {
          const hotCount = results.filter((p: ReapiProperty) => p.distressScore >= 60).length;
          toast.success(`Found ${results.length} properties (${hotCount} hot)`);
        }
      } else {
        const response = await fetch('/api/attom/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zipCode: searchZipCode,
            minPrice: searchMinPrice ? parseInt(searchMinPrice) : undefined,
            maxPrice: searchMaxPrice ? parseInt(searchMaxPrice) : undefined,
            pageSize: 20,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Search failed');
        }

        const data = await response.json();
        setSearchResults(data.properties || []);

        if (data.properties?.length === 0) {
          toast.info("No properties found");
        } else {
          toast.success(`Found ${data.properties.length} properties`);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to search');
    } finally {
      setSearching(false);
    }
  };

  const getSelectionKey = (p: SearchProperty) => `${p.address}|${p.city}|${p.state}`;

  const toggleSearchSelection = (key: string) => {
    const newSelection = new Set(selectedSearchProperties);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedSearchProperties(newSelection);
  };

  const selectAllSearch = () => {
    if (selectedSearchProperties.size === searchResults.length) {
      setSelectedSearchProperties(new Set());
    } else {
      setSelectedSearchProperties(new Set(searchResults.map(p => getSelectionKey(p))));
    }
  };

  const importSelectedProperties = async () => {
    if (selectedSearchProperties.size === 0) {
      toast.error("Please select at least one property");
      return;
    }

    setImporting(true);
    try {
      const toImport = searchResults.filter(p => selectedSearchProperties.has(getSelectionKey(p)));

      const endpoint = searchDataSource === 'reapi' ? '/api/reapi/import' : '/api/attom/import';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: toImport,
          ...(searchDataSource === 'reapi' && { skipTrace: true }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const data = await response.json();
      toast.success(data.message);

      await fetchProperties();
      setSearchDialogOpen(false);
      setSearchResults([]);
      setSelectedSearchProperties(new Set());
      setSearchZipCode("");
      setSearchMinPrice("");
      setSearchMaxPrice("");
      setMinScore(0);
      setReapiFilters({
        preForeclosure: false,
        vacant: false,
        absenteeOwner: false,
        highEquity: false,
        inherited: false,
        taxLien: false,
        death: false,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

  // ==========================================================================
  // Utility functions
  // ==========================================================================

  const getDistressSignals = (property: Property): string[] => {
    const signals: string[] = [];
    if (property.foreclosure) signals.push('Foreclosure');
    if (property.preForeclosure) signals.push('Pre-Foreclosure');
    if (property.taxDelinquent) signals.push('Tax Delinquent');
    if (property.vacant) signals.push('Vacant');
    return signals;
  };

  const getContactNotes = (property: Property): ContactNote[] => {
    if (!property.contactNotes) return [];
    try {
      return JSON.parse(property.contactNotes);
    } catch {
      return [];
    }
  };

  const formatPhoneNumbers = (phoneNumbers?: string): string[] => {
    if (!phoneNumbers) return [];
    try {
      return JSON.parse(phoneNumbers);
    } catch {
      return [];
    }
  };

  const formatEmails = (emails?: string): string[] => {
    if (!emails) return [];
    try {
      return JSON.parse(emails);
    } catch {
      return [];
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'negative':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const exportPropertiesToCSV = (props: Property[]) => {
    if (props.length === 0) {
      toast.error("No properties to export");
      return;
    }

    let csvContent = "Address,City,State,ZIP,Owner,Score,Status,Data Source,Last Contact,Sentiment,Signals\n";

    props.forEach(p => {
      const signals = getDistressSignals(p).join("; ");
      csvContent += `"${p.address}",${p.city},${p.state},${p.zip || ""},"${p.ownerName || ""}",${p.score || ""},${p.outreachStatus || "not_contacted"},${p.dataSource},${p.lastContactDate || ""},${p.sentiment || ""},"${signals}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${props.length} leads to CSV`);
  };

  const openPropertyDrawer = (property: Property) => {
    setSelectedProperty(property);
    setDrawerOpen(true);
  };

  // ==========================================================================
  // Error state
  // ==========================================================================

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-red-200 dark:border-red-800">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to Load Leads</h3>
            <p className="text-sm text-muted-foreground mb-6">{fetchError}</p>
            <Button onClick={fetchProperties} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">
            Manage your property pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSearchDialogOpen(true)}>
            <MapPin className="h-4 w-4 mr-2" />
            Find Properties
          </Button>
          <Button
            variant="outline"
            onClick={() => exportPropertiesToCSV(filteredProperties)}
            disabled={filteredProperties.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 mb-6">
        <StatsCards
          total={stats.total}
          notContacted={stats.notContacted}
          hotLeads={stats.hotLeads}
          followUps={stats.followUps}
          loading={loading}
        />
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 mb-4">
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            onClearSelection={clearSelection}
            onBulkUpdateStatus={handleBulkUpdateStatus}
            onBulkDelete={() => setBulkDeleteDialogOpen(true)}
            onBulkExport={handleBulkExport}
          />
        </div>
      )}

      {/* Filters */}
      <Card className="flex-shrink-0 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address, owner, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[162px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_contacted">Not Contacted</SelectItem>
                <SelectItem value="attempted">Attempted</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="offer_made">Offer Made</SelectItem>
                <SelectItem value="under_contract">Under Contract</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full lg:w-[144px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="reapi">REAPI</SelectItem>
                <SelectItem value="attom">ATTOM</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchProperties}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table - shows 8 rows max before scrolling */}
      <Card className="shadow-sm overflow-hidden flex flex-col gap-0">
        {loading ? (
          <TableSkeleton />
        ) : filteredProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">
              {properties.length === 0 ? 'No leads yet' : 'No matching leads'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {properties.length === 0
                ? "Click 'Find Properties' to search for investment opportunities."
                : "Try adjusting your filters to see more results."}
            </p>
            {properties.length === 0 && (
              <Button onClick={() => setSearchDialogOpen(true)} className="mt-4">
                <MapPin className="h-4 w-4 mr-2" />
                Find Properties
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[446px] [&_[data-slot=scroll-area-viewport]>div]:!block" type="scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
                    />
                  </TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Signals"
                      column="signals"
                      currentColumn={sortColumn}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Score"
                      column="score"
                      currentColumn={sortColumn}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Status"
                      column="status"
                      currentColumn={sortColumn}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Last Contact"
                      column="lastContact"
                      currentColumn={sortColumn}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="w-12 pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredProperties.map((property) => {
                const signals = getDistressSignals(property);
                const isSelected = selectedIds.has(property.id);

                return (
                  <TableRow
                    key={property.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(property.id)}
                      />
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <div>
                        <p className="font-medium">{property.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <span className="text-sm">{property.ownerName || 'Unknown'}</span>
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <div className="flex gap-1 flex-wrap">
                        {signals.length > 0 ? signals.slice(0, 2).map((signal) => (
                          <Badge
                            key={signal}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          >
                            {signal}
                          </Badge>
                        )) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                        {signals.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{signals.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <ScoreGauge
                        score={property.score}
                        scoreBreakdown={property.scoreBreakdown}
                        property={property}
                      />
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <StatusBadge status={property.outreachStatus} />
                    </TableCell>
                    <TableCell onClick={() => openPropertyDrawer(property)}>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(property.lastContactDate)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPropertyDrawer(property)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updatePropertyStatus(property.id, 'contacted')}>
                            Mark Contacted
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedProperty(property);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        {/* Bottom status bar */}
        {!loading && filteredProperties.length > 0 && (
          <div className="flex-shrink-0 border-t px-3 py-0.5 text-[11px] text-muted-foreground">
            Showing {filteredProperties.length} of {properties.length} leads
            {selectedIds.size > 0 && (
              <span className="ml-2">· {selectedIds.size} selected</span>
            )}
          </div>
        )}
      </Card>

      {/* Property Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedProperty?.address || 'Property Details'}</SheetTitle>
            <SheetDescription>View and manage property details</SheetDescription>
          </SheetHeader>
          {selectedProperty && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="bg-card border-b p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight truncate">
                      {selectedProperty.address}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
                    </p>
                  </div>
                  {/* Score Badge */}
                  <div className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border-2",
                    (selectedProperty.score || 0) >= 70
                      ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20'
                      : (selectedProperty.score || 0) >= 50
                      ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/20'
                      : 'bg-muted border-muted-foreground/20'
                  )}>
                    <span className={cn(
                      "text-2xl font-bold",
                      (selectedProperty.score || 0) >= 70
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (selectedProperty.score || 0) >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                    )}>
                      {selectedProperty.score || '-'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</span>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="mt-4">
                  <Select
                    value={selectedProperty.outreachStatus || 'not_contacted'}
                    onValueChange={(value) => updatePropertyStatus(selectedProperty.id, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_contacted">Not Contacted</SelectItem>
                      <SelectItem value="attempted">Attempted</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="negotiating">Negotiating</SelectItem>
                      <SelectItem value="offer_made">Offer Made</SelectItem>
                      <SelectItem value="under_contract">Under Contract</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="dead">Dead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Contact Info */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Contact Information
                    </h3>

                    {(formatPhoneNumbers(selectedProperty.phoneNumbers).length > 0 ||
                      formatEmails(selectedProperty.emails).length > 0) ? (
                      <div className="space-y-2">
                        {formatPhoneNumbers(selectedProperty.phoneNumbers).map((phone, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                            <a href={`tel:${phone}`} className="text-primary hover:underline font-medium">
                              {phone}
                            </a>
                            <a
                              href={`sms:${phone}`}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Text
                            </a>
                          </div>
                        ))}
                        {formatEmails(selectedProperty.emails).map((email, idx) => (
                          <div key={idx} className="flex items-center gap-2 py-2 border-b last:border-0">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`mailto:${email}`} className="text-primary hover:underline truncate">
                              {email}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No contact info available</p>
                        <p className="text-xs text-muted-foreground mt-1">Needs skip tracing</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Notes */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        Contact Notes
                      </h3>
                      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="h-8 px-3">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Note
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Contact Note</DialogTitle>
                            <DialogDescription>
                              Record your interaction with the property owner
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Note</Label>
                              <Textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="What happened during this contact?"
                                className="mt-1"
                                rows={3}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Method</Label>
                                <Select value={noteMethod} onValueChange={setNoteMethod}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="sms">SMS</SelectItem>
                                    <SelectItem value="in_person">In Person</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Sentiment</Label>
                                <Select value={noteSentiment} onValueChange={setNoteSentiment}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="positive">Positive</SelectItem>
                                    <SelectItem value="neutral">Neutral</SelectItem>
                                    <SelectItem value="negative">Negative</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label>Next Follow-up</Label>
                              <Input
                                type="datetime-local"
                                value={nextFollowUp}
                                onChange={(e) => setNextFollowUp(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={addContactNote} disabled={saving || !newNote.trim()}>
                              {saving ? 'Saving...' : 'Save Note'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {getContactNotes(selectedProperty).length > 0 ? (
                      <div className="space-y-3">
                        {getContactNotes(selectedProperty).reverse().map((note, idx) => (
                          <div key={idx} className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {note.method}
                                </Badge>
                                {note.sentiment && (
                                  <Badge variant="outline" className={cn("text-xs", getSentimentColor(note.sentiment))}>
                                    {note.sentiment}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground">No contact notes yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Distress Signals */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      Distress Signals
                    </h3>

                    {getDistressSignals(selectedProperty).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {getDistressSignals(selectedProperty).map(signal => (
                          <Badge
                            key={signal}
                            className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          >
                            {signal}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No distress signals detected</p>
                    )}
                  </CardContent>
                </Card>

                {/* Follow-up Card */}
                {selectedProperty.nextFollowUpDate && (
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
                            Next Follow-up
                          </p>
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            {new Date(selectedProperty.nextFollowUpDate).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Footer */}
              <div className="bg-card border-t p-4">
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Property
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Property Search Dialog */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Find Properties
            </DialogTitle>
            <DialogDescription>
              Search for investment properties by ZIP code
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Data Source Tabs */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
              <button
                onClick={() => setSearchDataSource('reapi')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  searchDataSource === 'reapi'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                REAPI (Distress)
              </button>
              <button
                onClick={() => setSearchDataSource('attom')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  searchDataSource === 'attom'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                ATTOM (Legacy)
              </button>
            </div>

            {/* Search Form */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>ZIP Code *</Label>
                <Input
                  value={searchZipCode}
                  onChange={(e) => setSearchZipCode(e.target.value)}
                  placeholder="Enter ZIP code..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Min Value</Label>
                <Input
                  type="number"
                  value={searchMinPrice}
                  onChange={(e) => setSearchMinPrice(e.target.value)}
                  placeholder="$0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Value</Label>
                <Input
                  type="number"
                  value={searchMaxPrice}
                  onChange={(e) => setSearchMaxPrice(e.target.value)}
                  placeholder="No limit"
                  className="mt-1"
                />
              </div>
            </div>

            {/* REAPI Filters */}
            {searchDataSource === 'reapi' && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Minimum Distress Score</Label>
                    <span className={cn(
                      "text-sm font-bold px-2 py-0.5 rounded",
                      minScore >= 60 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      minScore >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      minScore > 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {minScore > 0 ? `${minScore}+` : 'Any'}
                    </span>
                  </div>
                  <Slider
                    value={[minScore]}
                    onValueChange={(values) => setMinScore(values[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Any</span>
                    <span>40+ Medium</span>
                    <span>60+ High</span>
                    <span>80+ Hot</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Distress Signals</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'preForeclosure', label: 'Pre-Foreclosure' },
                      { key: 'vacant', label: 'Vacant' },
                      { key: 'absenteeOwner', label: 'Absentee Owner' },
                      { key: 'highEquity', label: 'High Equity' },
                      { key: 'inherited', label: 'Inherited' },
                      { key: 'taxLien', label: 'Tax Lien' },
                      { key: 'death', label: 'Death/Probate' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={reapiFilters[key as keyof typeof reapiFilters]}
                          onCheckedChange={(checked) =>
                            setReapiFilters(f => ({ ...f, [key]: !!checked }))
                          }
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button onClick={searchProperties} disabled={searching || !searchZipCode}>
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSearchProperties.size === searchResults.length}
                    onCheckedChange={selectAllSearch}
                  />
                  <Label className="text-sm">
                    Select All ({selectedSearchProperties.size} of {searchResults.length})
                  </Label>
                </div>

                <ScrollArea className="h-[270px] border rounded-lg">
                  <div className="divide-y">
                    {searchResults.map((property, index) => {
                      const uniqueKey = isReapiProperty(property)
                        ? property.reapiId
                        : (property as AttomProperty).attomId || `${(property as AttomProperty).address}-${index}`;
                      const selectionKey = getSelectionKey(property);

                      return (
                        <div
                          key={uniqueKey}
                          className="flex items-start gap-3 p-3 hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedSearchProperties.has(selectionKey)}
                            onCheckedChange={() => toggleSearchSelection(selectionKey)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{property.address}</span>
                              {isReapiProperty(property) && property.distressScore > 0 && (
                                <Badge
                                  className={cn(
                                    "ml-auto",
                                    property.distressScore >= 60 ? 'bg-red-500' :
                                    property.distressScore >= 40 ? 'bg-amber-500' : ''
                                  )}
                                >
                                  {property.distressScore}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {property.city}, {property.state} {property.zip}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                              {property.bedrooms && <span>{property.bedrooms} bed</span>}
                              {property.bathrooms && <span>{property.bathrooms} bath</span>}
                              {property.squareFeet && <span>{property.squareFeet.toLocaleString()} sqft</span>}
                              {property.yearBuilt && <span>Built {property.yearBuilt}</span>}
                            </div>
                            <div className="flex gap-4 mt-1 text-xs">
                              {property.lastSalePrice && (
                                <span className="text-muted-foreground">
                                  Last: {formatCurrency(property.lastSalePrice)}
                                </span>
                              )}
                              {property.estimatedValue && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Est: {formatCurrency(property.estimatedValue)}
                                </span>
                              )}
                            </div>
                            {isReapiProperty(property) && property.distressSignals?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {property.distressSignals.slice(0, 3).map((signal) => (
                                  <Badge
                                    key={signal}
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  >
                                    {signal.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                                {property.distressSignals.length > 3 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    +{property.distressSignals.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSearchDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={importSelectedProperties}
              disabled={importing || selectedSearchProperties.size === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Import {selectedSearchProperties.size} Properties
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedProperty && (
            <div className="py-4">
              <p className="font-medium">{selectedProperty.address}</p>
              <p className="text-sm text-muted-foreground">
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProperty} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Properties</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All selected properties will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {selectedIds.size} Properties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
