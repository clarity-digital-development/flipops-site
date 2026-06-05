"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Search,
  Edit,
  CheckCircle2,
  LayoutGrid,
  List,
  Phone,
  Mail,
  MapPin,
  Wrench,
  Receipt,
  FileText,
  Plus,
  ChevronRight,
  AlertTriangle,
  Banknote,
  PiggyBank,
  Percent,
  Timer,
  UserCircle,
  ArrowUpRight,
  ArrowDownRight,
  BedDouble,
  Bath,
  Square,
  Key,
  Send,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = 'force-dynamic';

// ============================================================================
// TYPES
// ============================================================================

interface Rental {
  id: string;
  propertyId: string;
  contractId: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  monthlyRent: number;
  deposit: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  status: "vacant" | "leased" | "maintenance" | "listed";
  purchasePrice: number;
  mortgagePayment: number | null;
  propertyTax: number | null;
  insurance: number | null;
  hoa: number | null;
  utilities: number | null;
  maintenanceReserve: number | null;
  currentMarketValue: number;
  occupancyRate: number;
  createdAt: string;
  tenants: Tenant[];
  maintenanceRequests: MaintenanceRequest[];
  paymentHistory: PaymentRecord[];
  isDemo?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  leaseStart: string;
  leaseEnd: string;
  rentAmount: number;
  depositPaid: number;
  paymentStatus: "current" | "late" | "delinquent";
  moveInDate: string;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
  cost: number | null;
  vendor: string | null;
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "late" | "partial";
  method: string;
}

interface Analytics {
  totalProperties: number;
  totalMonthlyRent: number;
  totalMonthlyExpenses: number;
  totalCashFlow: number;
  avgCapRate: number;
  avgOccupancyRate: number;
  vacantProperties: number;
  leasedProperties: number;
  totalPortfolioValue: number;
  avgCashOnCashReturn: number;
  totalEquity: number;
  pendingMaintenance: number;
  expiringLeases: number;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG = {
  vacant: {
    label: "Vacant",
    icon: Home,
    gradient: "from-gray-400 to-gray-500",
    bg: "bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-500/30"
  },
  leased: {
    label: "Leased",
    icon: CheckCircle2,
    gradient: "from-emerald-400 to-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30"
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    gradient: "from-amber-400 to-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30"
  },
  listed: {
    label: "Listed",
    icon: Building2,
    gradient: "from-blue-400 to-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/30"
  },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30" },
  medium: { label: "Medium", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  high: { label: "High", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  urgent: { label: "Urgent", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
};

const MAINTENANCE_STATUS_CONFIG = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (amount: number | null, compact = false) => {
  if (amount === null) return "—";
  if (compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDaysUntil = (dateString: string | null): number | null => {
  if (!dateString) return null;
  const target = new Date(dateString);
  const today = new Date();
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateMonthlyExpenses = (rental: Rental) => {
  return (
    (rental.mortgagePayment || 0) +
    (rental.propertyTax || 0) +
    (rental.insurance || 0) +
    (rental.hoa || 0) +
    (rental.utilities || 0) +
    (rental.maintenanceReserve || 0)
  );
};

const calculateMonthlyCashFlow = (rental: Rental) => {
  return rental.monthlyRent - calculateMonthlyExpenses(rental);
};

const calculateCapRate = (rental: Rental) => {
  const annualNOI = (rental.monthlyRent - calculateMonthlyExpenses(rental) + (rental.mortgagePayment || 0)) * 12;
  return rental.purchasePrice > 0 ? (annualNOI / rental.purchasePrice) * 100 : 0;
};

const calculateCashOnCash = (rental: Rental) => {
  const annualCashFlow = calculateMonthlyCashFlow(rental) * 12;
  const downPayment = rental.purchasePrice * 0.25; // Assume 25% down
  return downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatChip({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  color = "default",
  highlight = false
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: "default" | "emerald" | "rose" | "amber" | "blue" | "gold";
  highlight?: boolean;
}) {
  const colorClasses = {
    default: "border-border/50 bg-card",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
    rose: "border-rose-500/30 bg-rose-500/10",
    amber: "border-amber-500/30 bg-amber-500/10",
    blue: "border-blue-500/30 bg-blue-500/10",
    gold: "border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/10",
  };

  const iconColors = {
    default: "text-muted-foreground",
    emerald: "text-emerald-500",
    rose: "text-rose-500",
    amber: "text-amber-500",
    blue: "text-blue-500",
    gold: "text-amber-500",
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all flex-shrink-0",
      colorClasses[color],
      highlight && "ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10"
    )}>
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center",
        color === "gold" ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20" : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", iconColors[color])} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className={cn(
            "text-xl font-bold tabular-nums leading-tight text-foreground",
            color === "gold" && "text-amber-500 dark:text-amber-400"
          )}>
            {value}
          </p>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
          {trend && (
            <span className={cn(
              "flex items-center text-xs font-medium",
              trend === "up" && "text-emerald-500",
              trend === "down" && "text-rose-500",
              trend === "neutral" && "text-muted-foreground"
            )}>
              {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
              {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OccupancyGauge({ percentage, size = "md" }: { percentage: number; size?: "sm" | "md" | "lg" }) {
  const sizeConfig = {
    sm: { width: 48, stroke: 4, fontSize: "text-xs" },
    md: { width: 64, stroke: 5, fontSize: "text-sm" },
    lg: { width: 80, stroke: 6, fontSize: "text-base" },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 90) return { stroke: "#10b981", className: "text-emerald-500" };
    if (percentage >= 70) return { stroke: "#f59e0b", className: "text-amber-500" };
    return { stroke: "#ef4444", className: "text-rose-500" };
  };

  const { stroke: strokeColor, className } = getColor();

  return (
    <div className="relative" style={{ width: config.width, height: config.width }}>
      <svg className="transform -rotate-90" width={config.width} height={config.width}>
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-bold tabular-nums", config.fontSize, className)}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function LeaseCountdown({ leaseEnd }: { leaseEnd: string | null }) {
  const daysLeft = getDaysUntil(leaseEnd);

  if (daysLeft === null) {
    return <span className="text-muted-foreground text-sm">No lease</span>;
  }

  const getConfig = () => {
    if (daysLeft < 0) return { color: "text-muted-foreground", bg: "bg-muted", label: "Expired" };
    if (daysLeft <= 30) return { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", label: `${daysLeft}d` };
    if (daysLeft <= 60) return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: `${daysLeft}d` };
    if (daysLeft <= 90) return { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", label: `${Math.floor(daysLeft / 30)}mo` };
    return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: `${Math.floor(daysLeft / 30)}mo` };
  };

  const config = getConfig();

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium", config.bg, config.color)}>
      <Timer className="h-3 w-3" />
      {config.label}
    </div>
  );
}

function CashFlowIndicator({ amount }: { amount: number }) {
  const isPositive = amount >= 0;
  return (
    <div className={cn(
      "flex items-center justify-center gap-1 font-bold tabular-nums text-sm",
      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
    )}>
      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      <span>{formatCurrency(Math.abs(amount))}</span>
    </div>
  );
}

function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full bg-muted animate-pulse" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-16 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
        <div className="flex justify-between items-center pt-3 border-t">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function RentalCard({
  rental,
  onClick
}: {
  rental: Rental;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[rental.status];
  const StatusIcon = status.icon;
  const cashFlow = calculateMonthlyCashFlow(rental);
  const capRate = calculateCapRate(rental);

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer",
        "hover:shadow-lg hover:-translate-y-0.5",
        "transition-all duration-300 group"
      )}
      onClick={onClick}
    >
      {/* Status Gradient Bar */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", status.gradient)} />

      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {rental.address}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {rental.city}, {rental.state}
            </p>

            {/* Property Stats */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BedDouble className="h-3 w-3" /> {rental.beds}
              </span>
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" /> {rental.baths}
              </span>
              <span className="flex items-center gap-1">
                <Square className="h-3 w-3" /> {rental.sqft.toLocaleString()}
              </span>
            </div>
          </div>

          <OccupancyGauge percentage={rental.occupancyRate} size="md" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Rent</p>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(rental.monthlyRent)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Cash Flow</p>
            <CashFlowIndicator amount={cashFlow} />
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Cap Rate</p>
            <p className={cn(
              "text-sm font-bold tabular-nums",
              capRate >= 8 ? "text-emerald-600 dark:text-emerald-400" : capRate >= 5 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {capRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs border", status.bg, status.text, status.border)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {rental.status === "leased" && <LeaseCountdown leaseEnd={rental.leaseEnd} />}
          </div>

          <div className="flex items-center gap-1">
            {rental.tenants.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
                <Users className="h-3 w-3" />
                {rental.tenants.length}
              </div>
            )}
            {rental.maintenanceRequests.filter(m => m.status === "open" || m.status === "in_progress").length > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-500 mr-2">
                <Wrench className="h-3 w-3" />
                {rental.maintenanceRequests.filter(m => m.status === "open" || m.status === "in_progress").length}
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TenantCard({ tenant }: { tenant: Tenant }) {
  const paymentConfig = {
    current: { label: "Current", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    late: { label: "Late", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    delinquent: { label: "Delinquent", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  };

  const config = paymentConfig[tenant.paymentStatus];
  const daysUntilLeaseEnd = getDaysUntil(tenant.leaseEnd);

  return (
    <div className="p-4 rounded-xl bg-muted/50 border hover:bg-muted transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
          <UserCircle className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-foreground truncate">{tenant.name}</h4>
            <Badge className={cn("text-[10px] border", config.color)}>{config.label}</Badge>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{tenant.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{tenant.phone}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly Rent</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(tenant.rentAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lease Ends</p>
              <div className="flex items-center gap-1 text-xs">
                {daysUntilLeaseEnd !== null && daysUntilLeaseEnd <= 60 ? (
                  <span className="text-amber-600 dark:text-amber-400">{daysUntilLeaseEnd}d left</span>
                ) : (
                  <span className="text-muted-foreground">{formatDate(tenant.leaseEnd)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaintenanceCard({ request }: { request: MaintenanceRequest }) {
  const priorityConfig = PRIORITY_CONFIG[request.priority];
  const statusConfig = MAINTENANCE_STATUS_CONFIG[request.status];

  return (
    <div className="p-4 rounded-xl bg-muted/50 border hover:bg-muted transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn("text-[10px] border", priorityConfig.color)}>{priorityConfig.label}</Badge>
            <Badge className={cn("text-[10px]", statusConfig.color)}>{statusConfig.label}</Badge>
          </div>
          <h4 className="font-medium text-foreground">{request.title}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{request.description}</p>
        </div>
        {request.cost !== null && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(request.cost)}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
        <span>Created {formatDate(request.createdAt)}</span>
        {request.vendor && <span>Vendor: {request.vendor}</span>}
      </div>
    </div>
  );
}

function FinancialSummary({ rental }: { rental: Rental }) {
  const monthlyExpenses = calculateMonthlyExpenses(rental);
  const monthlyCashFlow = calculateMonthlyCashFlow(rental);
  const annualCashFlow = monthlyCashFlow * 12;
  const capRate = calculateCapRate(rental);
  const cashOnCash = calculateCashOnCash(rental);
  const equity = rental.currentMarketValue - (rental.purchasePrice * 0.75); // Assume 75% remaining loan

  const expenses = [
    { label: "Mortgage", value: rental.mortgagePayment },
    { label: "Property Tax", value: rental.propertyTax },
    { label: "Insurance", value: rental.insurance },
    { label: "HOA", value: rental.hoa },
    { label: "Utilities", value: rental.utilities },
    { label: "Maintenance", value: rental.maintenanceReserve },
  ].filter(e => e.value !== null && e.value > 0);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-amber-500" />
            <span className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400/70">Monthly Cash Flow</span>
          </div>
          <p className={cn(
            "text-2xl font-bold tabular-nums",
            monthlyCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {formatCurrency(monthlyCashFlow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{formatCurrency(annualCashFlow)}/year</p>
        </div>

        <div className="p-4 rounded-xl bg-muted/50 border">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-blue-500" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Cap Rate</span>
          </div>
          <p className={cn(
            "text-2xl font-bold tabular-nums",
            capRate >= 8 ? "text-emerald-600 dark:text-emerald-400" : capRate >= 5 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {capRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">CoC: {cashOnCash.toFixed(1)}%</p>
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="p-4 rounded-xl bg-muted/50 border">
        <h4 className="text-sm font-medium text-foreground mb-4">Monthly Breakdown</h4>

        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Income</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(rental.monthlyRent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{formatCurrency(monthlyExpenses)}</p>
          </div>
        </div>

        <div className="space-y-2">
          {expenses.map((expense, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{expense.label}</span>
              <span className="text-foreground tabular-nums">{formatCurrency(expense.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Property Value */}
      <div className="p-4 rounded-xl bg-muted/50 border">
        <h4 className="text-sm font-medium text-foreground mb-4">Property Value</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Purchase</p>
            <p className="text-base font-bold text-foreground tabular-nums">{formatCurrency(rental.purchasePrice, true)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current</p>
            <p className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(rental.currentMarketValue, true)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Equity</p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(equity, true)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RentalDetailSheet({
  rental,
  open,
  onClose,
  onRequestEdit,
  onRequestPayment,
}: {
  rental: Rental | null;
  open: boolean;
  onClose: () => void;
  onRequestEdit?: (rental: Rental) => void;
  onRequestPayment?: (rental: Rental) => void;
}) {
  const { toast } = useToast();

  if (!rental) return null;

  const status = STATUS_CONFIG[rental.status];
  const StatusIcon = status.icon;
  const openMaintenance = rental.maintenanceRequests.filter(m => m.status === "open" || m.status === "in_progress");
  const daysUntilExpiration = getDaysUntil(rental.leaseEnd);
  const showRenewalOption = rental.status === "leased" && daysUntilExpiration !== null && daysUntilExpiration <= 60 && daysUntilExpiration >= 0;

  const handleEdit = () => {
    // Wired in the parent via an onRequestEdit prop — opens the edit sheet.
    onRequestEdit?.(rental);
  };

  const handleRecordPayment = () => {
    // Wired in the parent via an onRequestPayment prop — opens the payment dialog.
    onRequestPayment?.(rental);
  };

  const handleSendRenewal = () => {
    // Phase 8: Documents backend ships in Phase 6 — this surface is
    // explicitly deferred until then. Toast "coming soon" instead of
    // pretending the contract was sent.
    // TODO: wire to /api/documents/templates/renewal once Phase 6 lands.
    toast({
      title: "Renewal contract coming soon",
      description: `Renewal docs ship with the Documents backend (Phase 6). Lease for ${rental.address} flagged with ${daysUntilExpiration} days remaining.`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[486px] p-0 flex flex-col bg-background"
      >
        <VisuallyHidden>
          <SheetTitle>Property Details: {rental.address}</SheetTitle>
        </VisuallyHidden>
        {/* Header with gradient */}
        <div className="relative pt-6 pb-4 px-6 bg-muted/50">
          <div className="flex items-start justify-between">
            <div>
              <Badge className={cn("text-xs border mb-2", status.bg, status.text, status.border)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <h2 className="text-xl font-bold text-foreground">{rental.address}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {rental.city}, {rental.state} {rental.zip}
              </p>
            </div>
            <OccupancyGauge percentage={rental.occupancyRate} size="lg" />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Beds</p>
              <p className="text-sm font-bold text-foreground">{rental.beds}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Baths</p>
              <p className="text-sm font-bold text-foreground">{rental.baths}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sqft</p>
              <p className="text-sm font-bold text-foreground">{rental.sqft.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Year</p>
              <p className="text-sm font-bold text-foreground">{rental.yearBuilt}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-lg"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="tenants"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-lg"
            >
              Tenants ({rental.tenants.length})
            </TabsTrigger>
            <TabsTrigger
              value="financials"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-lg"
            >
              Financials
            </TabsTrigger>
            <TabsTrigger
              value="maintenance"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-lg relative"
            >
              Maintenance
              {openMaintenance.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 rounded-full">
                  {openMaintenance.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <TabsContent value="overview" className="mt-0 p-6 space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
                    <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400/70 mb-1">Monthly Rent</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(rental.monthlyRent)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 border">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Cash Flow</p>
                    <CashFlowIndicator amount={calculateMonthlyCashFlow(rental)} />
                  </div>
                </div>

                {/* Lease Info */}
                {rental.status === "leased" && (
                  <div className="p-4 rounded-xl bg-muted/50 border">
                    <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-500" />
                      Lease Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Start Date</p>
                        <p className="text-sm text-foreground">{formatDate(rental.leaseStart)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">End Date</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground">{formatDate(rental.leaseEnd)}</p>
                          <LeaseCountdown leaseEnd={rental.leaseEnd} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Security Deposit</p>
                        <p className="text-sm text-foreground">{formatCurrency(rental.deposit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tenants</p>
                        <p className="text-sm text-foreground">{rental.tenants.length}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Recent Payments</h4>
                  {rental.paymentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payment history</p>
                  ) : (
                    <div className="space-y-2">
                      {rental.paymentHistory.slice(0, 3).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              payment.status === "paid" ? "bg-emerald-500" :
                              payment.status === "late" ? "bg-amber-500" : "bg-muted-foreground"
                            )} />
                            <span className="text-muted-foreground">{formatDate(payment.date)}</span>
                          </div>
                          <span className="text-foreground tabular-nums">{formatCurrency(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tenants" className="mt-0 p-6">
                {rental.tenants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                      <Users className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Tenants</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {rental.status === "vacant"
                        ? "This property is currently vacant. Add a tenant when you sign a lease."
                        : "No tenants have been added to this property yet."
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rental.tenants.map((tenant) => (
                      <TenantCard key={tenant.id} tenant={tenant} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financials" className="mt-0 p-6">
                <FinancialSummary rental={rental} />
              </TabsContent>

              <TabsContent value="maintenance" className="mt-0 p-6">
                {rental.maintenanceRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4">
                      <Wrench className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Maintenance Requests</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      All caught up! No maintenance requests for this property.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rental.maintenanceRequests.map((request) => (
                      <MaintenanceCard key={request.id} request={request} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div className="border-t p-4 space-y-2">
          {showRenewalOption && (
            <Button
              onClick={handleSendRenewal}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Renewal Contract
              <span className="ml-2 text-xs opacity-80">({daysUntilExpiration}d left)</span>
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button className="flex-1" onClick={handleRecordPayment}>
              <Receipt className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RentalsPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Fetch rentals — strictly real data, no seed fallback.
  useEffect(() => {
    const fetchRentals = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/rentals");
        if (!response.ok) throw new Error("Failed to fetch rentals");
        const data = await response.json();

        const apiRentals = (data.rentals || []).map((r: any) => ({ ...r, isDemo: false }));
        setRentals(apiRentals);
      } catch (error) {
        console.error("Error fetching rentals:", error);
        setRentals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRentals();
  }, []);

  // Filter rentals
  const filteredRentals = useMemo(() => {
    return rentals.filter((rental) => {
      if (statusFilter !== "all" && rental.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          rental.address.toLowerCase().includes(query) ||
          rental.city.toLowerCase().includes(query) ||
          rental.state.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [rentals, statusFilter, searchQuery]);

  // Calculate analytics
  const analytics = useMemo((): Analytics => {
    const totalMonthlyRent = rentals.reduce((sum, r) => sum + r.monthlyRent, 0);
    const totalMonthlyExpenses = rentals.reduce((sum, r) => sum + calculateMonthlyExpenses(r), 0);
    const totalCashFlow = totalMonthlyRent - totalMonthlyExpenses;
    const avgCapRate = rentals.length > 0
      ? rentals.reduce((sum, r) => sum + calculateCapRate(r), 0) / rentals.length
      : 0;
    const avgOccupancy = rentals.length > 0
      ? rentals.reduce((sum, r) => sum + r.occupancyRate, 0) / rentals.length
      : 0;
    const totalPortfolioValue = rentals.reduce((sum, r) => sum + r.currentMarketValue, 0);
    const totalEquity = rentals.reduce((sum, r) => sum + (r.currentMarketValue - r.purchasePrice * 0.75), 0);
    const pendingMaintenance = rentals.reduce(
      (sum, r) => sum + r.maintenanceRequests.filter(m => m.status === "open" || m.status === "in_progress").length,
      0
    );
    const expiringLeases = rentals.filter(r => {
      const days = getDaysUntil(r.leaseEnd);
      return days !== null && days > 0 && days <= 60;
    }).length;

    return {
      totalProperties: rentals.length,
      totalMonthlyRent,
      totalMonthlyExpenses,
      totalCashFlow,
      avgCapRate,
      avgOccupancyRate: avgOccupancy,
      vacantProperties: rentals.filter(r => r.status === "vacant").length,
      leasedProperties: rentals.filter(r => r.status === "leased").length,
      totalPortfolioValue,
      avgCashOnCashReturn: rentals.length > 0
        ? rentals.reduce((sum, r) => sum + calculateCashOnCash(r), 0) / rentals.length
        : 0,
      totalEquity,
      pendingMaintenance,
      expiringLeases,
    };
  }, [rentals]);

  const handleOpenDetail = (rental: Rental) => {
    setSelectedRental(rental);
    setDetailSheetOpen(true);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="h-full flex flex-col min-h-0">
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="flex-shrink-0 px-6 pb-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-40 flex-shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 px-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Rental Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage properties, track cash flow, and monitor tenants
            </p>
          </div>
          <Button asChild title="Rentals are created from closed contracts. Close a contract to start tracking rent.">
            <Link href="/app/contracts">
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 px-6 pb-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <StatChip
            label="Properties"
            value={analytics.totalProperties}
            icon={Building2}
            color="blue"
          />
          <StatChip
            label="Leased"
            value={analytics.leasedProperties}
            subValue={`${analytics.vacantProperties} vacant`}
            icon={CheckCircle2}
            color="emerald"
          />
          <StatChip
            label="Monthly Rent"
            value={formatCurrency(analytics.totalMonthlyRent, true)}
            icon={Banknote}
            color="gold"
            highlight
          />
          <StatChip
            label="Cash Flow"
            value={formatCurrency(analytics.totalCashFlow, true)}
            icon={analytics.totalCashFlow >= 0 ? TrendingUp : TrendingDown}
            trend={analytics.totalCashFlow >= 0 ? "up" : "down"}
            color={analytics.totalCashFlow >= 0 ? "emerald" : "rose"}
          />
          <StatChip
            label="Avg Cap Rate"
            value={`${analytics.avgCapRate.toFixed(1)}%`}
            icon={Percent}
            color={analytics.avgCapRate >= 8 ? "emerald" : analytics.avgCapRate >= 5 ? "amber" : "rose"}
          />
          <StatChip
            label="Portfolio Value"
            value={formatCurrency(analytics.totalPortfolioValue, true)}
            icon={PiggyBank}
            color="default"
          />
          {analytics.expiringLeases > 0 && (
            <StatChip
              label="Expiring Leases"
              value={analytics.expiringLeases}
              subValue="< 60 days"
              icon={AlertTriangle}
              color="amber"
            />
          )}
          {analytics.pendingMaintenance > 0 && (
            <StatChip
              label="Open Tickets"
              value={analytics.pendingMaintenance}
              icon={Wrench}
              color="amber"
            />
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex-shrink-0 px-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[144px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="leased">Leased</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border p-0.5 bg-muted">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-8 px-3",
                viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn(
                "h-8 px-3",
                viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 px-6 pb-6">
        <ScrollArea className="h-full">
          {filteredRentals.length === 0 ? (
            searchQuery || statusFilter !== "all" ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Results Found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            ) : (
              <EmptyState
                icon={<Building2 className="h-10 w-10" />}
                title="No Rental Properties"
                description="Convert a closed contract into a rental property to start tracking cash flow, tenants, and maintenance."
                actionLabel="View Closed Contracts"
                actionHref="/app/contracts?status=closed"
              />
            )
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pr-4">
              {filteredRentals.map((rental) => (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  onClick={() => handleOpenDetail(rental)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {filteredRentals.map((rental) => {
                const status = STATUS_CONFIG[rental.status];
                const cashFlow = calculateMonthlyCashFlow(rental);

                return (
                  <div
                    key={rental.id}
                    onClick={() => handleOpenDetail(rental)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border cursor-pointer",
                      "bg-card hover:bg-muted/50 hover:shadow-md",
                      "transition-all group"
                    )}
                  >
                    <div className={cn("w-1 h-12 rounded-full bg-gradient-to-b", status.gradient)} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {rental.address}
                        </h3>
                        <Badge className={cn("text-[10px] border", status.bg, status.text, status.border)}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rental.city}, {rental.state}</p>
                    </div>

                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rent</p>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(rental.monthlyRent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash Flow</p>
                        <CashFlowIndicator amount={cashFlow} />
                      </div>
                      <OccupancyGauge percentage={rental.occupancyRate} size="sm" />
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Sheet */}
      <RentalDetailSheet
        rental={selectedRental}
        open={detailSheetOpen}
        onClose={() => setDetailSheetOpen(false)}
      />
    </div>
  );
}
