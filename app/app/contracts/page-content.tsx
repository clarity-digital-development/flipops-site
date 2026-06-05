"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PipelineBreadcrumb } from "@/components/shared/pipeline-breadcrumb";
import {
  FileSignature,
  Clock,
  CheckCircle2,
  XCircle,
  Home,
  Calendar,
  DollarSign,
  Filter,
  Search,
  MoreVertical,
  Eye,
  Edit,
  AlertCircle,
  UserCheck,
  Hammer,
  Building2,
  Download,
  ChevronRight,
  TrendingUp,
  CalendarDays,
  ArrowRight,
  LayoutList,
  Columns3,
  FileText,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { exportToCSV, generateFilename, formatCurrencyForCSV, formatDateForCSV } from "@/lib/csv-export";
import { cn } from "@/lib/utils";
import { trackLeadEvent, type LeadEventType } from "@/lib/behavior/client";

interface Contract {
  id: string;
  propertyId: string;
  offerId: string;
  purchasePrice: number;
  status: string;
  closingDate: string | null;
  signedAt: string | null;
  escrowOpenedAt: string | null;
  closedAt: string | null;
  notes: string | null;
  documentUrls: string[];
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  offer: {
    id: string;
    amount: number;
    status: string;
  };
  assignment?: {
    id: string;
    buyerId: string;
    assignmentFee: number;
    status: string;
    buyer: {
      id: string;
      name: string;
      email: string | null;
    };
  };
  renovation?: {
    id: string;
    status: string;
    maxExposureUsd: number;
    targetRoiPct: number;
    arv: number | null;
    _count?: {
      scopeNodes: number;
      bids: number;
      changeOrders: number;
      tasks: number;
    };
  };
  rental?: {
    id: string;
    status: string;
    monthlyRent: number;
    totalIncome: number;
    totalExpenses: number;
    _count?: {
      tenants: number;
      income: number;
      expenses: number;
    };
  };
}

interface Buyer {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  cashBuyer: boolean;
}

// Enhanced status configuration with comprehensive colors
const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-amber-100 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    iconColor: "text-amber-500",
    border: "border-amber-200 dark:border-amber-800/50"
  },
  signed: {
    label: "Signed",
    icon: FileSignature,
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    iconColor: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800/50"
  },
  escrow: {
    label: "In Escrow",
    icon: AlertCircle,
    bg: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-400",
    iconColor: "text-purple-500",
    border: "border-purple-200 dark:border-purple-800/50"
  },
  closed: {
    label: "Closed",
    icon: CheckCircle2,
    bg: "bg-emerald-100 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    iconColor: "text-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800/50"
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    bg: "bg-red-100 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    iconColor: "text-red-500",
    border: "border-red-200 dark:border-red-800/50"
  },
};

const PIPELINE_STAGES = ["pending", "signed", "escrow", "closed"] as const;

// Urgency badge configuration for milestone dates
type UrgencyLevel = "urgent" | "soon" | "normal" | "overdue" | "none";

function getClosingUrgency(closingDate: string | null, status: string): { level: UrgencyLevel; daysUntil: number | null; label: string } {
  // Only show urgency for active contracts
  if (!closingDate || status === "closed" || status === "cancelled") {
    return { level: "none", daysUntil: null, label: "" };
  }

  const closing = new Date(closingDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  closing.setHours(0, 0, 0, 0);

  const diffMs = closing.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return { level: "overdue", daysUntil, label: `${Math.abs(daysUntil)}d overdue` };
  } else if (daysUntil <= 3) {
    return { level: "urgent", daysUntil, label: daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d left` };
  } else if (daysUntil <= 7) {
    return { level: "soon", daysUntil, label: `${daysUntil}d left` };
  } else {
    return { level: "normal", daysUntil, label: `${daysUntil}d` };
  }
}

const URGENCY_CONFIG = {
  urgent: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-300 dark:border-red-700",
    icon: "text-red-500",
    pulse: true,
  },
  overdue: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-300 dark:border-red-700",
    icon: "text-red-500",
    pulse: false,
  },
  soon: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-700",
    icon: "text-amber-500",
    pulse: false,
  },
  normal: {
    bg: "bg-gray-100 dark:bg-muted",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-border",
    icon: "text-gray-400",
    pulse: false,
  },
  none: {
    bg: "",
    text: "text-muted-foreground",
    border: "",
    icon: "text-gray-400",
    pulse: false,
  },
};

// Urgency badge component for milestone dates
function ClosingUrgencyBadge({
  closingDate,
  status,
  showDate = true,
  compact = false,
}: {
  closingDate: string | null;
  status: string;
  showDate?: boolean;
  compact?: boolean;
}) {
  const { level, daysUntil, label } = getClosingUrgency(closingDate, status);
  const config = URGENCY_CONFIG[level];

  if (level === "none" || !closingDate) {
    return (
      <span className="text-sm text-muted-foreground">Not set</span>
    );
  }

  const formattedDate = new Date(closingDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: compact ? undefined : "numeric",
  });

  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
      {!compact && showDate && (
        <span className="text-sm">{formattedDate}</span>
      )}
      <Badge
        className={cn(
          config.bg,
          config.text,
          "border",
          config.border,
          config.pulse && "animate-pulse",
          compact ? "text-[10px] px-1.5 py-0" : "text-xs"
        )}
      >
        {level === "urgent" && <AlertCircle className={cn("h-3 w-3 mr-1", config.icon)} />}
        {level === "overdue" && <AlertCircle className={cn("h-3 w-3 mr-1", config.icon)} />}
        {level === "soon" && <Clock className={cn("h-3 w-3 mr-1", config.icon)} />}
        {label}
      </Badge>
      {compact && showDate && (
        <span className="text-xs text-muted-foreground">{formattedDate}</span>
      )}
    </div>
  );
}

// Seed contracts data for demo/fallback - varied closing dates to demo urgency badges
const seedContracts: Contract[] = [
  {
    id: "seed-contract-1",
    propertyId: "seed-prop-1",
    offerId: "seed-offer-1",
    purchasePrice: 185000,
    status: "escrow",
    closingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days - URGENT
    signedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    escrowOpenedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    closedAt: null,
    notes: "Clear title, waiting on final walkthrough",
    documentUrls: [],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    property: {
      id: "seed-prop-1",
      address: "1234 Oak Street",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
    offer: {
      id: "seed-offer-1",
      amount: 185000,
      status: "accepted",
    },
    assignment: {
      id: "seed-assign-1",
      buyerId: "seed-buyer-1",
      assignmentFee: 15000,
      status: "pending",
      buyer: {
        id: "seed-buyer-1",
        name: "Marcus Johnson",
        email: "marcus@mjcapital.com",
      },
    },
  },
  {
    id: "seed-contract-2",
    propertyId: "seed-prop-2",
    offerId: "seed-offer-2",
    purchasePrice: 225000,
    status: "signed",
    closingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days - Soon
    signedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    escrowOpenedAt: null,
    closedAt: null,
    notes: null,
    documentUrls: [],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    property: {
      id: "seed-prop-2",
      address: "567 Maple Avenue",
      city: "Dallas",
      state: "TX",
      zip: "75201",
    },
    offer: {
      id: "seed-offer-2",
      amount: 225000,
      status: "accepted",
    },
  },
  {
    id: "seed-contract-3",
    propertyId: "seed-prop-3",
    offerId: "seed-offer-3",
    purchasePrice: 165000,
    status: "closed",
    closingDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    escrowOpenedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    closedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Successful close, buyer happy",
    documentUrls: [],
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    property: {
      id: "seed-prop-3",
      address: "890 Pine Road",
      city: "Houston",
      state: "TX",
      zip: "77001",
    },
    offer: {
      id: "seed-offer-3",
      amount: 165000,
      status: "accepted",
    },
    assignment: {
      id: "seed-assign-2",
      buyerId: "seed-buyer-2",
      assignmentFee: 12000,
      status: "completed",
      buyer: {
        id: "seed-buyer-2",
        name: "Sarah Chen",
        email: "sarah@flipsisters.com",
      },
    },
  },
  {
    id: "seed-contract-4",
    propertyId: "seed-prop-4",
    offerId: "seed-offer-4",
    purchasePrice: 195000,
    status: "pending",
    closingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days - Normal
    signedAt: null,
    escrowOpenedAt: null,
    closedAt: null,
    notes: "Waiting on seller signature",
    documentUrls: [],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    property: {
      id: "seed-prop-4",
      address: "321 Cedar Lane",
      city: "San Antonio",
      state: "TX",
      zip: "78201",
    },
    offer: {
      id: "seed-offer-4",
      amount: 195000,
      status: "accepted",
    },
  },
  {
    id: "seed-contract-5",
    propertyId: "seed-prop-5",
    offerId: "seed-offer-5",
    purchasePrice: 145000,
    status: "escrow",
    closingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago - OVERDUE
    signedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    escrowOpenedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    closedAt: null,
    notes: "Extension requested - waiting on buyer's lender",
    documentUrls: [],
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    property: {
      id: "seed-prop-5",
      address: "789 Elm Boulevard",
      city: "Fort Worth",
      state: "TX",
      zip: "76102",
    },
    offer: {
      id: "seed-offer-5",
      amount: 145000,
      status: "accepted",
    },
  },
];

// Compact stat chip component
function StatChip({
  label,
  value,
  icon: Icon,
  iconColor = "text-gray-500",
  onClick,
  active = false
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-white dark:bg-muted border-gray-200 dark:border-border transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        active && "ring-2 ring-blue-500 ring-offset-1"
      )}
      onClick={onClick}
    >
      <CardContent className="px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              {label}
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">
              {value}
            </p>
          </div>
          <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

// Status pipeline visualization
function StatusPipeline({
  contracts,
  activeStatus,
  onStatusClick
}: {
  contracts: Contract[];
  activeStatus: string;
  onStatusClick: (status: string) => void;
}) {
  const counts = {
    pending: contracts.filter(c => c.status === "pending").length,
    signed: contracts.filter(c => c.status === "signed").length,
    escrow: contracts.filter(c => c.status === "escrow").length,
    closed: contracts.filter(c => c.status === "closed").length,
  };

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-muted/50 rounded-lg p-3 border border-gray-200 dark:border-border">
      {PIPELINE_STAGES.map((stage, index) => {
        const config = STATUS_CONFIG[stage];
        const Icon = config.icon;
        const isActive = activeStatus === stage;
        const count = counts[stage];

        return (
          <div key={stage} className="flex items-center flex-1">
            <button
              onClick={() => onStatusClick(isActive ? "all" : stage)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center",
                isActive
                  ? cn(config.bg, config.border, "border")
                  : "hover:bg-gray-100 dark:hover:bg-muted"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? config.iconColor : "text-gray-400")} />
              <div className="text-center">
                <p className={cn(
                  "text-xl font-bold tabular-nums",
                  isActive ? config.text : "text-gray-700 dark:text-gray-300"
                )}>
                  {count}
                </p>
                <p className={cn(
                  "text-[10px] uppercase tracking-wider",
                  isActive ? config.text : "text-gray-500 dark:text-gray-400"
                )}>
                  {config.label}
                </p>
              </div>
            </button>
            {index < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-1 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Kanban card for pipeline board
function ContractCard({
  contract,
  onClick,
  formatCurrency,
  formatDate
}: {
  contract: Contract;
  onClick: () => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string | null) => string;
}) {
  const config = STATUS_CONFIG[contract.status as keyof typeof STATUS_CONFIG];
  const daysInStage = Math.floor((Date.now() - new Date(contract.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card
      className="bg-white dark:bg-muted hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-gray-200 dark:border-border"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                {contract.property.address}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {contract.property.city}, {contract.property.state}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(contract.purchasePrice)}
            </span>
            <span className="text-xs text-gray-500 tabular-nums">
              {daysInStage}d in stage
            </span>
          </div>

          {contract.closingDate && (
            <ClosingUrgencyBadge
              closingDate={contract.closingDate}
              status={contract.status}
              compact={true}
            />
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {contract.assignment && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <UserCheck className="h-3 w-3 mr-1" />
                {contract.assignment.buyer.name}
              </Badge>
            )}
            {contract.renovation && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                <Hammer className="h-3 w-3 mr-1" />
                Reno
              </Badge>
            )}
            {contract.rental && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600">
                <Building2 className="h-3 w-3 mr-1" />
                Rental
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContractsPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Detail panel state
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  // Dialog states
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [assignmentFee, setAssignmentFee] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [assigningContract, setAssigningContract] = useState(false);

  // Renovation state
  const [renovationDialogOpen, setRenovationDialogOpen] = useState(false);
  const [renovationBudget, setRenovationBudget] = useState("");
  const [renovationTargetRoi, setRenovationTargetRoi] = useState("20");
  const [renovationArv, setRenovationArv] = useState("");
  const [renovationStartDate, setRenovationStartDate] = useState("");
  const [startingRenovation, setStartingRenovation] = useState(false);

  // Rental state
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false);
  const [rentalMonthlyRent, setRentalMonthlyRent] = useState("");
  const [rentalDeposit, setRentalDeposit] = useState("");
  const [rentalMortgagePayment, setRentalMortgagePayment] = useState("");
  const [rentalPropertyTax, setRentalPropertyTax] = useState("");
  const [rentalInsurance, setRentalInsurance] = useState("");
  const [startingRental, setStartingRental] = useState(false);

  // Fetch contracts and buyers
  useEffect(() => {
    fetchContracts();
    fetchBuyers();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/contracts");
      if (!response.ok) {
        // API unavailable — fall back to seed data silently
        setContracts(seedContracts);
        setFilteredContracts(seedContracts);
        return;
      }
      const data = await response.json();
      const contractsData = data.contracts || [];
      // Use seed data if no real contracts exist
      if (contractsData.length > 0) {
        setContracts(contractsData);
        setFilteredContracts(contractsData);
      } else {
        setContracts(seedContracts);
        setFilteredContracts(seedContracts);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      // Use seed data as fallback on error
      setContracts(seedContracts);
      setFilteredContracts(seedContracts);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyers = async () => {
    // Pre-launch: /app(.*) is public but /api/buyers is gated, so Clerk
    // returns 404 for anon users. Fail silently to empty — UI handles that.
    try {
      const response = await fetch("/api/buyers");
      if (!response.ok) {
        setBuyers([]);
        return;
      }
      const data = await response.json();
      setBuyers(data.buyers || []);
    } catch {
      setBuyers([]);
    }
  };

  // Filter contracts
  useEffect(() => {
    let filtered = contracts;

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.property.address.toLowerCase().includes(query) ||
          c.property.city.toLowerCase().includes(query) ||
          c.property.state.toLowerCase().includes(query)
      );
    }

    setFilteredContracts(filtered);
  }, [contracts, statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
      label: status,
      icon: Clock,
      bg: "bg-gray-100 dark:bg-muted",
      text: "text-gray-700 dark:text-gray-300",
      iconColor: "text-gray-500"
    };
    const Icon = config.icon;

    return (
      <Badge className={cn(config.bg, config.text, "border-0")}>
        <Icon className={cn("mr-1 h-3 w-3", config.iconColor)} />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  const handleViewDetails = (contract: Contract) => {
    setSelectedContract(contract);
    setDetailTab("overview");
    setDetailPanelOpen(true);
  };

  const handleUpdateStatus = (contract: Contract) => {
    setSelectedContract(contract);
    setNewStatus(contract.status);
    setClosingDate(contract.closingDate || "");
    setNotes(contract.notes || "");
    setUpdateStatusDialogOpen(true);
  };

  const submitStatusUpdate = async () => {
    if (!selectedContract) return;

    try {
      setUpdatingStatus(true);
      const response = await fetch(`/api/contracts/${selectedContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          closingDate: closingDate || null,
          notes: notes || null,
          ...(newStatus === "signed" && !selectedContract.signedAt && { signedAt: new Date().toISOString() }),
          ...(newStatus === "escrow" && !selectedContract.escrowOpenedAt && { escrowOpenedAt: new Date().toISOString() }),
          ...(newStatus === "closed" && !selectedContract.closedAt && { closedAt: new Date().toISOString() }),
        }),
      });

      if (!response.ok) throw new Error("Failed to update contract");

      // Behavioral: contract status transitions are the OUTCOME labels for
      // the lead-scoring model. signed/closed are the strongest positives
      // (a 'closed' deal is exactly what users want more of); cancelled is
      // a negative outcome AFTER pursuit (different signal than a list-stage
      // 'skipped'). leadSnapshot is intentionally thin here — the rich
      // snapshot was captured upstream at 'offer_made' time; this event
      // labels the same propertyId with the final outcome.
      const outcomeMap: Record<string, LeadEventType | undefined> = {
        signed: "contract_signed",
        closed: "closed",
        cancelled: "marked_dead",
      };
      const outcomeEvent = outcomeMap[newStatus];
      if (outcomeEvent && selectedContract.propertyId) {
        void trackLeadEvent(
          outcomeEvent,
          {
            id: selectedContract.propertyId,
            city: selectedContract.property?.city,
            state: selectedContract.property?.state,
            zip: selectedContract.property?.zip,
          },
          {
            contractId: selectedContract.id,
            purchasePrice: selectedContract.purchasePrice,
            offerAmount: selectedContract.offer?.amount,
            closingDate: closingDate || null,
            previousStatus: selectedContract.status,
          },
        );
      }

      toast({
        title: "Contract Updated",
        description: `Contract status updated to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`,
      });

      fetchContracts();
      setUpdateStatusDialogOpen(false);
      setSelectedContract(null);
      setDetailPanelOpen(false);
    } catch (error) {
      console.error("Error updating contract:", error);
      toast({
        title: "Error",
        description: "Failed to update contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignContract = (contract: Contract) => {
    setSelectedContract(contract);
    setSelectedBuyerId("");
    setAssignmentFee("");
    setAssignmentDate(contract.closingDate || "");
    setAssignmentNotes("");
    setAssignDialogOpen(true);
  };

  const submitAssignment = async () => {
    if (!selectedContract || !selectedBuyerId || !assignmentFee) {
      toast({
        title: "Missing Information",
        description: "Please select a buyer and enter an assignment fee.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAssigningContract(true);
      const response = await fetch(`/api/contracts/${selectedContract.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: selectedBuyerId,
          assignmentFee: parseFloat(assignmentFee),
          assignmentDate: assignmentDate || null,
          notes: assignmentNotes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign contract");
      }

      toast({
        title: "Contract Assigned",
        description: "Contract successfully assigned to buyer.",
      });

      fetchContracts();
      setAssignDialogOpen(false);
      setSelectedContract(null);
    } catch (error) {
      console.error("Error assigning contract:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssigningContract(false);
    }
  };

  const handleStartRenovation = (contract: Contract) => {
    setSelectedContract(contract);
    setRenovationBudget("");
    setRenovationTargetRoi("20");
    setRenovationArv("");
    setRenovationStartDate("");
    setRenovationDialogOpen(true);
  };

  const submitRenovation = async () => {
    if (!selectedContract || !renovationBudget || !renovationTargetRoi) {
      toast({
        title: "Missing Information",
        description: "Please enter budget and target ROI.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStartingRenovation(true);
      const response = await fetch("/api/renovations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContract.id,
          propertyId: selectedContract.propertyId,
          maxExposureUsd: parseFloat(renovationBudget),
          targetRoiPct: parseFloat(renovationTargetRoi),
          arv: renovationArv ? parseFloat(renovationArv) : null,
          startAt: renovationStartDate || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start renovation");
      }

      const created = await response.json();
      const newRenovationId: string | undefined = created?.renovation?.id ?? created?.id;

      toast({
        title: "Renovation Started",
        description: "Taking you to Renovations to set up scope and bids.",
      });

      fetchContracts();
      setRenovationDialogOpen(false);
      setSelectedContract(null);
      // Pipeline handoff: navigate to /app/renovations highlighting the
      // newly created project so the user can immediately set up scope.
      if (newRenovationId) {
        router.push(`/app/renovations?highlight=${newRenovationId}`);
      } else {
        router.push('/app/renovations');
      }
    } catch (error) {
      console.error("Error starting renovation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start renovation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingRenovation(false);
    }
  };

  const handleStartRental = (contract: Contract) => {
    setSelectedContract(contract);
    setRentalMonthlyRent("");
    setRentalDeposit("");
    setRentalMortgagePayment("");
    setRentalPropertyTax("");
    setRentalInsurance("");
    setRentalDialogOpen(true);
  };

  const submitRental = async () => {
    if (!selectedContract || !rentalMonthlyRent) {
      toast({
        title: "Missing Information",
        description: "Please enter monthly rent.",
        variant: "destructive",
      });
      return;
    }

    try {
      setStartingRental(true);
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: selectedContract.id,
          propertyId: selectedContract.propertyId,
          monthlyRent: parseFloat(rentalMonthlyRent),
          deposit: rentalDeposit ? parseFloat(rentalDeposit) : null,
          purchasePrice: selectedContract.purchasePrice,
          mortgagePayment: rentalMortgagePayment ? parseFloat(rentalMortgagePayment) : null,
          propertyTax: rentalPropertyTax ? parseFloat(rentalPropertyTax) : null,
          insurance: rentalInsurance ? parseFloat(rentalInsurance) : null,
          status: "vacant",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start rental");
      }

      const created = await response.json();
      const newRentalId: string | undefined = created?.rental?.id ?? created?.id;

      toast({
        title: "Rental Started",
        description: "Taking you to Rentals.",
      });

      fetchContracts();
      setRentalDialogOpen(false);
      setSelectedContract(null);
      // Pipeline handoff: navigate to /app/rentals.
      if (newRentalId) {
        router.push(`/app/rentals?highlight=${newRentalId}`);
      } else {
        router.push('/app/rentals');
      }
    } catch (error) {
      console.error("Error starting rental:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start rental. Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingRental(false);
    }
  };

  // CSV Export handler
  const handleExportCSV = () => {
    const exportData = filteredContracts.map((contract) => ({
      "Property Address": `${contract.property.address}, ${contract.property.city}, ${contract.property.state} ${contract.property.zip}`,
      "Purchase Price": formatCurrencyForCSV(contract.purchasePrice),
      "Status": contract.status.charAt(0).toUpperCase() + contract.status.slice(1),
      "Closing Date": formatDateForCSV(contract.closingDate),
      "Signed Date": formatDateForCSV(contract.signedAt),
      "Escrow Opened": formatDateForCSV(contract.escrowOpenedAt),
      "Closed Date": formatDateForCSV(contract.closedAt),
      "Created Date": formatDateForCSV(contract.createdAt),
      "Notes": contract.notes || "",
    }));

    exportToCSV(exportData, generateFilename("flipops-contracts"));

    toast({
      title: "Export Successful",
      description: `Exported ${exportData.length} contract${exportData.length !== 1 ? "s" : ""} to CSV`,
    });
  };

  // Calculate stats
  const stats = {
    total: contracts.length,
    pending: contracts.filter((c) => c.status === "pending").length,
    signed: contracts.filter((c) => c.status === "signed").length,
    escrow: contracts.filter((c) => c.status === "escrow").length,
    closed: contracts.filter((c) => c.status === "closed").length,
    cancelled: contracts.filter((c) => c.status === "cancelled").length,
    totalValue: contracts.reduce((sum, c) => sum + c.purchasePrice, 0),
    closedThisMonth: contracts.filter((c) => {
      if (c.status !== "closed" || !c.closedAt) return false;
      const closedDate = new Date(c.closedAt);
      const now = new Date();
      return closedDate.getMonth() === now.getMonth() && closedDate.getFullYear() === now.getFullYear();
    }).length,
  };

  // Calculate average days to close
  const closedContracts = contracts.filter(c => c.status === "closed" && c.closedAt && c.createdAt);
  const avgDaysToClose = closedContracts.length > 0
    ? Math.round(closedContracts.reduce((sum, c) => {
        const days = (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0) / closedContracts.length)
    : 0;

  if (!isMounted) {
    return <div>Loading...</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contracts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Contracts</h1>
            <p className="text-sm text-muted-foreground">Manage property contracts and track closing progress</p>
          </div>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={filteredContracts.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Compact Stats Bar */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          <StatChip
            label="Total"
            value={stats.total}
            icon={FileSignature}
            iconColor="text-gray-500"
            onClick={() => setStatusFilter("all")}
            active={statusFilter === "all"}
          />
          <StatChip
            label="Pending"
            value={stats.pending}
            icon={Clock}
            iconColor="text-amber-500"
            onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
            active={statusFilter === "pending"}
          />
          <StatChip
            label="Signed"
            value={stats.signed}
            icon={FileSignature}
            iconColor="text-blue-500"
            onClick={() => setStatusFilter(statusFilter === "signed" ? "all" : "signed")}
            active={statusFilter === "signed"}
          />
          <StatChip
            label="Escrow"
            value={stats.escrow}
            icon={AlertCircle}
            iconColor="text-purple-500"
            onClick={() => setStatusFilter(statusFilter === "escrow" ? "all" : "escrow")}
            active={statusFilter === "escrow"}
          />
          <StatChip
            label="Closed"
            value={stats.closed}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            onClick={() => setStatusFilter(statusFilter === "closed" ? "all" : "closed")}
            active={statusFilter === "closed"}
          />
          <StatChip
            label="Total Value"
            value={formatCompactCurrency(stats.totalValue)}
            icon={DollarSign}
            iconColor="text-green-500"
          />
          <StatChip
            label="Avg Days"
            value={avgDaysToClose}
            icon={TrendingUp}
            iconColor="text-blue-500"
          />
          <StatChip
            label="This Month"
            value={stats.closedThisMonth}
            icon={CalendarDays}
            iconColor="text-indigo-500"
          />
        </div>

        {/* Pipeline Visualization */}
        <StatusPipeline
          contracts={contracts}
          activeStatus={statusFilter}
          onStatusClick={setStatusFilter}
        />
      </div>

      {/* Main Content */}
      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as "table" | "kanban")}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[126px] h-9">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="escrow">In Escrow</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsList className="h-9">
            <TabsTrigger value="table" className="gap-1.5 px-3">
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5 px-3">
              <Columns3 className="h-4 w-4" />
              <span className="hidden sm:inline">Board</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Table View */}
        <TabsContent value="table" className="flex-1 min-h-0 mt-0">
          <Card className="h-full py-0 gap-0">
            <ScrollArea className="h-full">
              {filteredContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[360px] gap-3">
                  <FileSignature className="h-12 w-12 text-gray-400" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No contracts found</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {contracts.length === 0
                        ? "Create contracts from accepted offers to get started."
                        : "Try adjusting your filters."}
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-card z-10 first:rounded-tl-xl">Property</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Purchase Price</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Status</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Closing</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Workflows</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10 text-right last:rounded-tr-xl">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => {
                      const daysInStage = Math.floor((Date.now() - new Date(contract.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

                      return (
                        <TableRow
                          key={contract.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          onClick={() => handleViewDetails(contract)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-md bg-gray-100 dark:bg-muted flex items-center justify-center flex-shrink-0">
                                <Home className="h-5 w-5 text-gray-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white truncate">
                                  {contract.property.address}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {contract.property.city}, {contract.property.state} {contract.property.zip}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold tabular-nums">{formatCurrency(contract.purchasePrice)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(contract.status)}
                              <span className="text-[10px] text-muted-foreground">{daysInStage}d in stage</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ClosingUrgencyBadge
                              closingDate={contract.closingDate}
                              status={contract.status}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {contract.assignment && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Assigned
                                </Badge>
                              )}
                              {contract.renovation && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                                  <Hammer className="h-3 w-3" />
                                </Badge>
                              )}
                              {contract.rental && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600">
                                  <Building2 className="h-3 w-3" />
                                </Badge>
                              )}
                              {!contract.assignment && !contract.renovation && !contract.rental && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(contract); }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUpdateStatus(contract); }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Update Status
                                </DropdownMenuItem>
                                {!contract.assignment && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAssignContract(contract); }}>
                                      <UserCheck className="mr-2 h-4 w-4" />
                                      Assign Contract
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {!contract.renovation && contract.status === "closed" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartRenovation(contract); }}>
                                      <Hammer className="mr-2 h-4 w-4" />
                                      Start Renovation
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {!contract.rental && contract.status === "closed" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartRental(contract); }}>
                                      <Building2 className="mr-2 h-4 w-4" />
                                      Start Rental
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link href={`/app/properties/${contract.propertyId}`} onClick={(e) => e.stopPropagation()}>
                                    <Home className="mr-2 h-4 w-4" />
                                    View Property
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Kanban View */}
        <TabsContent value="kanban" className="flex-1 min-h-0 mt-0">
          <div className="h-full flex gap-3 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage) => {
              const config = STATUS_CONFIG[stage];
              const stageContracts = filteredContracts.filter(c => c.status === stage);
              const Icon = config.icon;

              return (
                <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0",
                    config.bg, config.border
                  )}>
                    <Icon className={cn("h-4 w-4", config.iconColor)} />
                    <span className={cn("font-medium text-sm", config.text)}>{config.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {stageContracts.length}
                    </Badge>
                  </div>
                  <Card className="flex-1 rounded-t-none py-0 gap-0 border-t-0 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="p-2 space-y-2">
                        {stageContracts.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No contracts
                          </div>
                        ) : (
                          stageContracts.map((contract) => (
                            <ContractCard
                              key={contract.id}
                              contract={contract}
                              onClick={() => handleViewDetails(contract)}
                              formatCurrency={formatCurrency}
                              formatDate={formatDate}
                            />
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Panel (Sheet) */}
      <Sheet open={detailPanelOpen} onOpenChange={setDetailPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[486px] p-0 flex flex-col">
          {selectedContract && (
            <>
              <SheetHeader className="p-4 border-b flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{selectedContract.property.address}</SheetTitle>
                    <SheetDescription>
                      {selectedContract.property.city}, {selectedContract.property.state} {selectedContract.property.zip}
                    </SheetDescription>
                  </div>
                  {getStatusBadge(selectedContract.status)}
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(selectedContract.purchasePrice)}
                  </span>
                </div>
                <div className="mt-3">
                  <PipelineBreadcrumb
                    currentStage={
                      selectedContract.status === "closed" ? "closed" : "under_contract"
                    }
                    variant="compact"
                  />
                </div>
              </SheetHeader>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="flex-shrink-0 grid w-full grid-cols-5 rounded-none border-b bg-transparent h-auto p-0">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="buyers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5">
                    Buyers
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5">
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-2.5">
                    Actions
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  <TabsContent value="overview" className="m-0 p-4 space-y-4">
                    {/* Property Info */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Property</h4>
                      <Card className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-muted flex items-center justify-center">
                            <Home className="h-6 w-6 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium">{selectedContract.property.address}</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedContract.property.city}, {selectedContract.property.state} {selectedContract.property.zip}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Key Dates */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Key Dates</h4>
                      <Card className="py-0 gap-0">
                        <div className="divide-y dark:divide-gray-800">
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Created</span>
                            <span className="text-sm font-medium">{formatDate(selectedContract.createdAt)}</span>
                          </div>
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Signed</span>
                            <span className="text-sm font-medium">{formatDate(selectedContract.signedAt)}</span>
                          </div>
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Escrow Opened</span>
                            <span className="text-sm font-medium">{formatDate(selectedContract.escrowOpenedAt)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Closing Date</span>
                            <ClosingUrgencyBadge
                              closingDate={selectedContract.closingDate}
                              status={selectedContract.status}
                              compact={true}
                            />
                          </div>
                          <div className="flex justify-between py-2.5 px-4">
                            <span className="text-sm text-muted-foreground">Closed</span>
                            <span className="text-sm font-medium">{formatDate(selectedContract.closedAt)}</span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Assignment Info */}
                    {selectedContract.assignment && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Assignment</h4>
                        <Card className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                                <UserCheck className="h-5 w-5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-medium">{selectedContract.assignment.buyer.name}</p>
                                <p className="text-sm text-muted-foreground">{selectedContract.assignment.buyer.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedContract.assignment.assignmentFee)}</p>
                              <p className="text-xs text-muted-foreground">Assignment Fee</p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    )}

                    {/* Workflows */}
                    {(selectedContract.renovation || selectedContract.rental) && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Active Workflows</h4>
                        <div className="space-y-2">
                          {selectedContract.renovation && (
                            <Card className="py-3 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                                    <Hammer className="h-5 w-5 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">Renovation</p>
                                    <p className="text-sm text-muted-foreground capitalize">{selectedContract.renovation.status}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(selectedContract.renovation.maxExposureUsd)}</p>
                                  <p className="text-xs text-muted-foreground">Budget</p>
                                </div>
                              </div>
                            </Card>
                          )}
                          {selectedContract.rental && (
                            <Card className="py-3 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">Rental</p>
                                    <p className="text-sm text-muted-foreground capitalize">{selectedContract.rental.status}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatCurrency(selectedContract.rental.monthlyRent)}/mo</p>
                                  <p className="text-xs text-muted-foreground">Rent</p>
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedContract.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</h4>
                        <Card className="py-3 px-4">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedContract.notes}</p>
                        </Card>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="timeline" className="m-0 p-4">
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="space-y-6">
                        {[
                          { label: "Contract Created", date: selectedContract.createdAt, icon: FileSignature, color: "bg-gray-500" },
                          { label: "Contract Signed", date: selectedContract.signedAt, icon: FileSignature, color: "bg-blue-500" },
                          { label: "Escrow Opened", date: selectedContract.escrowOpenedAt, icon: AlertCircle, color: "bg-purple-500" },
                          { label: "Contract Closed", date: selectedContract.closedAt, icon: CheckCircle2, color: "bg-emerald-500" },
                        ].map((event, index) => {
                          const Icon = event.icon;
                          const isComplete = !!event.date;

                          return (
                            <div key={index} className="relative flex items-start gap-4 pl-8">
                              <div className={cn(
                                "absolute left-2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center",
                                isComplete ? event.color : "bg-gray-200 dark:bg-gray-700"
                              )}>
                                <Icon className={cn("h-3 w-3", isComplete ? "text-white" : "text-gray-400")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-medium text-sm",
                                  isComplete ? "text-gray-900 dark:text-white" : "text-gray-400"
                                )}>
                                  {event.label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {isComplete ? formatDate(event.date) : "Pending"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="buyers" className="m-0 p-4 space-y-3">
                    {selectedContract.assignment ? (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Assigned Buyer
                        </h4>
                        <Card className="py-3 px-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {selectedContract.assignment.buyer.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Status: {selectedContract.assignment.status}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-muted-foreground">Assignment Fee</p>
                              <p className="font-semibold">
                                {formatCurrency(selectedContract.assignment.assignmentFee)}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <UserCheck className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          No buyer assigned
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                          If this is a wholesale deal, assign a buyer from your database
                          to collect an assignment fee.
                        </p>
                      </div>
                    )}

                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Buyer Offers
                      </h4>
                      <div className="text-center py-6 border border-dashed border-border rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Buyer offer tracking ships with the Campaigns → Contracts wire-up.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="m-0 p-4">
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <h4 className="font-medium text-gray-900 dark:text-white">No documents yet</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Document management coming soon
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="actions" className="m-0 p-4 space-y-3">
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => { setDetailPanelOpen(false); handleUpdateStatus(selectedContract); }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Update Status
                    </Button>

                    {!selectedContract.assignment && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailPanelOpen(false); handleAssignContract(selectedContract); }}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Assign to Buyer
                      </Button>
                    )}

                    {!selectedContract.renovation && selectedContract.status === "closed" && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailPanelOpen(false); handleStartRenovation(selectedContract); }}
                      >
                        <Hammer className="mr-2 h-4 w-4" />
                        Start Renovation
                      </Button>
                    )}

                    {!selectedContract.rental && selectedContract.status === "closed" && (
                      <Button
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => { setDetailPanelOpen(false); handleStartRental(selectedContract); }}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        Start Rental
                      </Button>
                    )}

                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      asChild
                    >
                      <Link href={`/app/properties/${selectedContract.propertyId}`}>
                        <Home className="mr-2 h-4 w-4" />
                        View Property
                      </Link>
                    </Button>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Contract Status</DialogTitle>
            <DialogDescription>Update the status and details of this contract</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="escrow">In Escrow</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="closingDate">Closing Date</Label>
              <Input
                id="closingDate"
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this contract..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitStatusUpdate} disabled={updatingStatus}>
              {updatingStatus ? "Updating..." : "Update Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Contract Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contract to Buyer</DialogTitle>
            <DialogDescription>
              Select a buyer and set the assignment fee for this wholesale deal
            </DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Contract Details</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedContract.property.address}, {selectedContract.property.city}, {selectedContract.property.state}
                </p>
                <p className="text-lg font-bold mt-1">{formatCurrency(selectedContract.purchasePrice)}</p>
              </div>

              <div>
                <Label htmlFor="buyer">Select Buyer *</Label>
                <Select value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
                  <SelectTrigger id="buyer">
                    <SelectValue placeholder="Choose a buyer" />
                  </SelectTrigger>
                  <SelectContent>
                    {buyers.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        No buyers found. <Link href="/app/buyers" className="text-blue-600 hover:underline">Add buyers</Link> first.
                      </div>
                    ) : (
                      buyers.map((buyer) => (
                        <SelectItem key={buyer.id} value={buyer.id}>
                          {buyer.name} {buyer.cashBuyer && "(Cash)"} {buyer.company && `- ${buyer.company}`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignmentFee">Assignment Fee *</Label>
                <Input
                  id="assignmentFee"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="10000"
                  value={assignmentFee}
                  onChange={(e) => setAssignmentFee(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="assignmentDate">Assignment Date</Label>
                <Input
                  id="assignmentDate"
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="assignmentNotes">Notes</Label>
                <Textarea
                  id="assignmentNotes"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Add notes about this assignment..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assigningContract}>
              Cancel
            </Button>
            <Button onClick={submitAssignment} disabled={assigningContract || !selectedBuyerId || !assignmentFee}>
              {assigningContract ? "Assigning..." : "Assign Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Renovation Dialog */}
      <Dialog open={renovationDialogOpen} onOpenChange={setRenovationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Renovation Project</DialogTitle>
            <DialogDescription>
              Create a renovation project for this closed contract
            </DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Property</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedContract.property.address}, {selectedContract.property.city}, {selectedContract.property.state}
                </p>
                <p className="text-lg font-bold mt-1">{formatCurrency(selectedContract.purchasePrice)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="renovationBudget">Renovation Budget *</Label>
                  <Input
                    id="renovationBudget"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="50000"
                    value={renovationBudget}
                    onChange={(e) => setRenovationBudget(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="renovationTargetRoi">Target ROI (%) *</Label>
                  <Input
                    id="renovationTargetRoi"
                    type="number"
                    min="0"
                    step="5"
                    placeholder="20"
                    value={renovationTargetRoi}
                    onChange={(e) => setRenovationTargetRoi(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="renovationArv">After Repair Value (ARV)</Label>
                  <Input
                    id="renovationArv"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="300000"
                    value={renovationArv}
                    onChange={(e) => setRenovationArv(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="renovationStartDate">Start Date</Label>
                  <Input
                    id="renovationStartDate"
                    type="date"
                    value={renovationStartDate}
                    onChange={(e) => setRenovationStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Tip:</strong> After creating the renovation, you can add scope items, request bids from contractors, and track progress.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenovationDialogOpen(false)} disabled={startingRenovation}>
              Cancel
            </Button>
            <Button onClick={submitRenovation} disabled={startingRenovation || !renovationBudget || !renovationTargetRoi}>
              {startingRenovation ? "Creating..." : "Start Renovation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Rental Dialog */}
      <Dialog open={rentalDialogOpen} onOpenChange={setRentalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Rental Property</DialogTitle>
            <DialogDescription>
              Add this property to your rental portfolio
            </DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Property</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedContract.property.address}, {selectedContract.property.city}, {selectedContract.property.state}
                </p>
                <p className="text-lg font-bold mt-1">
                  Purchase Price: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(selectedContract.purchasePrice)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rentalMonthlyRent">Monthly Rent *</Label>
                  <Input
                    id="rentalMonthlyRent"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="2000"
                    value={rentalMonthlyRent}
                    onChange={(e) => setRentalMonthlyRent(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="rentalDeposit">Security Deposit</Label>
                  <Input
                    id="rentalDeposit"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="2000"
                    value={rentalDeposit}
                    onChange={(e) => setRentalDeposit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rentalMortgagePayment">Monthly Mortgage</Label>
                  <Input
                    id="rentalMortgagePayment"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="1200"
                    value={rentalMortgagePayment}
                    onChange={(e) => setRentalMortgagePayment(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="rentalPropertyTax">Monthly Tax</Label>
                  <Input
                    id="rentalPropertyTax"
                    type="number"
                    min="0"
                    step="50"
                    placeholder="200"
                    value={rentalPropertyTax}
                    onChange={(e) => setRentalPropertyTax(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rentalInsurance">Monthly Insurance</Label>
                <Input
                  id="rentalInsurance"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="150"
                  value={rentalInsurance}
                  onChange={(e) => setRentalInsurance(e.target.value)}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Tip:</strong> After creating the rental, you can add tenants, record rent payments, and track cash flow.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRentalDialogOpen(false)} disabled={startingRental}>
              Cancel
            </Button>
            <Button onClick={submitRental} disabled={startingRental || !rentalMonthlyRent}>
              {startingRental ? "Creating..." : "Start Rental"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
