
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Users,
  Target,
  Zap,
  Send,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Mail,
  Phone,
  MessageSquare,
  Building,
  Star,
  Download,
  Upload,
  Eye,
  Edit,
  Archive,
  UserCheck,
  Shield,
  Award,
  BarChart3,
  Home,
  BrainCircuit,
  Sparkles,
  HandshakeIcon,
  LayoutGrid,
  List
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type Buyer, type BuyerPerformance, type BuyBox, type BuyerDocument, type DispoListing, buyersSeedData } from "./seed-data";
import { exportToCSV, generateFilename, formatCurrencyForCSV, formatBooleanForCSV } from "@/lib/csv-export";
import { EmptyState } from "@/components/ui/empty-state";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Define API buyer type
interface ApiBuyer {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  propertyTypes: string[] | null;
  minPrice: number | null;
  maxPrice: number | null;
  targetMarkets: string[] | null;
  cashBuyer: boolean;
  dealsClosed: number;
  totalRevenue: number;
  reliability: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { assignments: number };
}

// Define API contract type for Active Listings
interface ApiContract {
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
  assignment: {
    id: string;
    buyerId: string;
    assignmentFee: number;
    status: string;
    buyer: ApiBuyer;
  } | null;
}

// Define API buyer offer type
interface ApiBuyerOffer {
  id: string;
  userId: string;
  contractId: string;
  buyerId: string;
  offerPrice: number;
  terms: string | null;
  earnestMoney: number | null;
  closingDays: number | null;
  contingencies: string[] | null;
  expiresAt: string | null;
  status: string;
  submittedAt: string;
  responseAt: string | null;
  responseNotes: string | null;
  counterAmount: number | null;
  counterTerms: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    purchasePrice: number;
    property: {
      id: string;
      address: string;
      city: string;
      state: string;
    };
  };
  buyer: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
}

// ============================================================================
// STAT CHIP COMPONENT
// ============================================================================

function StatChip({
  label,
  value,
  subValue,
  icon,
  trend,
  color = "blue"
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200/50 dark:border-blue-800/50 bg-blue-500/5",
    emerald: "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-500/5",
    purple: "border-purple-200/50 dark:border-purple-800/50 bg-purple-500/5",
    amber: "border-amber-200/50 dark:border-amber-800/50 bg-amber-500/5",
    rose: "border-rose-200/50 dark:border-rose-800/50 bg-rose-500/5",
    gray: "border-gray-200/50 dark:border-border/50 bg-gray-500/5"
  };

  const iconColorMap: Record<string, string> = {
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    purple: "text-purple-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    gray: "text-gray-500"
  };

  return (
    <div className={cn(
      "flex-shrink-0 flex items-center gap-1.5 sm:gap-3 rounded-lg sm:rounded-xl border px-2 sm:px-4 py-1.5 sm:py-2.5 min-w-fit",
      colorMap[color]
    )}>
      <div className={cn("p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/80 dark:bg-black/30 hidden sm:block", iconColorMap[color])}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[8px] sm:text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </span>
        <div className="flex items-baseline gap-1 sm:gap-1.5">
          <span className="text-xs sm:text-lg font-bold tracking-tight tabular-nums leading-tight">{value}</span>
          {subValue && (
            <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">{subValue}</span>
          )}
          {trend && (
            <span className={cn(
              "hidden sm:flex items-center gap-0.5 text-[10px] font-medium",
              trend.positive ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {trend.value}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BuyersPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null);
  const [showMatchingDemo, setShowMatchingDemo] = useState(false);
  const [selectedListing, setSelectedListing] = useState<DispoListing | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMethod, setImportMethod] = useState("csv");
  const [importData, setImportData] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedBuyers, setParsedBuyers] = useState<Array<{
    name: string;
    email: string;
    phone: string;
    company: string;
    targetMarkets: string[];
    propertyTypes: string[];
    minPrice: number | null;
    maxPrice: number | null;
    cashBuyer: boolean;
    notes: string;
  }>>([]);
  const [importingBuyers, setImportingBuyers] = useState(false);

  // API state
  const [apiBuyers, setApiBuyers] = useState<ApiBuyer[]>([]);
  const [apiContracts, setApiContracts] = useState<ApiContract[]>([]);
  const [apiBuyerOffers, setApiBuyerOffers] = useState<ApiBuyerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);

  // Smart matching state
  const [smartMatches, setSmartMatches] = useState<Array<{
    buyerId: string;
    buyerName: string;
    buyerCompany: string | null;
    buyerEmail: string | null;
    buyerPhone: string | null;
    score: number;
    reasons: string[];
    priceMatch: boolean;
    marketMatch: boolean;
    cashBuyer: boolean;
    reliability: string;
    dealsClosed: number;
  }>>([]);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Campaigns state
  const [apiCampaigns, setApiCampaigns] = useState<Array<{
    id: string;
    name: string;
    subject: string | null;
    message: string;
    method: string;
    buyerIds: string[];
    recipientCount: number;
    status: string;
    sentAt: string | null;
    openCount: number;
    clickCount: number;
    replyCount: number;
    offerCount: number;
    createdAt: string;
    contract: {
      id: string;
      property: { id: string; address: string; city: string; state: string; };
    } | null;
  }>>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    contractId: "",
    audience: "all",
    subject: "",
    message: "",
    sendEmail: true,
    sendSms: false,
  });

  // Transform contracts to DispoListing format for UI compatibility
  const listings: DispoListing[] = apiContracts.map(contract => {
    const daysOnMarket = Math.floor((new Date().getTime() - new Date(contract.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const status: DispoListing['status'] = contract.assignment
      ? (contract.assignment.status === 'closed' ? 'closed' : 'assigned')
      : (contract.status === 'pending' ? 'active' : contract.status === 'closed' ? 'closed' : 'active');

    return {
      id: contract.id,
      propertyId: contract.propertyId,
      address: `${contract.property.address}, ${contract.property.city}, ${contract.property.state} ${contract.property.zip}`,
      status,
      askPrice: contract.purchasePrice,
      arvEstimate: Math.round(contract.purchasePrice * 1.4), // Estimate ARV as 140% of purchase price
      repairEstimate: Math.round(contract.purchasePrice * 0.15), // Estimate repairs as 15% of purchase price
      netToSeller: Math.round(contract.purchasePrice * 0.9),
      blastSentDate: undefined,
      daysOnMarket,
      viewCount: 0,
      offerCount: 0,
      topOffer: undefined,
      assignedTo: contract.assignment?.buyerId,
      assignmentFee: contract.assignment?.assignmentFee,
      closingDate: contract.closingDate || undefined,
    };
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState([0, 100]);
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [buyerViewMode, setBuyerViewMode] = useState<"grid" | "list">("list");

  // Add/Edit Buyer Dialog state
  const [showAddBuyerDialog, setShowAddBuyerDialog] = useState(false);
  const [showEditBuyerDialog, setShowEditBuyerDialog] = useState(false);
  const [showViewBuyerDialog, setShowViewBuyerDialog] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<ApiBuyer | null>(null);
  const [savingBuyer, setSavingBuyer] = useState(false);

  // Buyer form state
  const [buyerForm, setBuyerForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    minPrice: "",
    maxPrice: "",
    targetMarkets: "",
    propertyTypes: "",
    cashBuyer: false,
    notes: "",
  });

  const resetBuyerForm = () => {
    setBuyerForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      minPrice: "",
      maxPrice: "",
      targetMarkets: "",
      propertyTypes: "",
      cashBuyer: false,
      notes: "",
    });
  };

  // Assignment Dialog state
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assigningContract, setAssigningContract] = useState<ApiContract | null>(null);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    buyerId: "",
    assignmentFee: "",
    notes: "",
  });

  const resetAssignmentForm = () => {
    setAssignmentForm({
      buyerId: "",
      assignmentFee: "",
      notes: "",
    });
  };

  // View Assignment Sheet state (read-only)
  const [showViewAssignmentSheet, setShowViewAssignmentSheet] = useState(false);
  const [viewingContract, setViewingContract] = useState<ApiContract | null>(null);

  // Prevent hydration mismatch by ensuring client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data from API on mount
  useEffect(() => {
    if (mounted) {
      fetchBuyersOnMount();
      fetchContractsOnMount();
      fetchBuyerOffersOnMount();
      fetchCampaignsOnMount();
    }
  }, [mounted]);

  const fetchBuyersOnMount = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/buyers');
      if (response.ok) {
        const data = await response.json();
        const buyers = data.buyers || [];
        // Use seed data if no real data
        setApiBuyers(buyers.length > 0 ? buyers : []);
      } else {
        console.warn('Failed to fetch buyers, using seed data');
        setApiBuyers([]);
      }
    } catch (error) {
      console.error('Error fetching buyers:', error);
      setApiBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchContractsOnMount = async () => {
    try {
      setContractsLoading(true);
      const response = await fetch('/api/contracts');
      if (response.ok) {
        const data = await response.json();
        setApiContracts(data.contracts || []);
      } else {
        console.warn('Failed to fetch contracts');
        setApiContracts([]);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
      setApiContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const fetchBuyerOffersOnMount = async () => {
    try {
      setOffersLoading(true);
      const response = await fetch('/api/buyer-offers');
      if (response.ok) {
        const data = await response.json();
        setApiBuyerOffers(data.buyerOffers || []);
      } else {
        console.warn('Failed to fetch buyer offers');
        setApiBuyerOffers([]);
      }
    } catch (error) {
      console.error('Error fetching buyer offers:', error);
      setApiBuyerOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  const fetchCampaignsOnMount = async () => {
    try {
      setCampaignsLoading(true);
      const response = await fetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        setApiCampaigns(data.campaigns || []);
      } else {
        console.warn('Failed to fetch campaigns');
        setApiCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setApiCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Convert API buyer to seed data format for compatibility.
  // Note: several legacy seed-data fields (blacklisted status, cashBuyer,
  // dealsClosedCount, avgAssignmentFee, priceMin/Max, bedsMin, rehabLevel)
  // are still referenced in scattered UI surfaces. We surface defaults here
  // rather than typecheck-failing — the UI shows the empty/zero state for
  // those panels until the API exposes those columns.
  const convertApiBuyer = (apiBuyer: ApiBuyer) => ({
    id: apiBuyer.id,
    name: apiBuyer.name,
    entity: apiBuyer.company || "Individual",
    type: "individual" as const,
    status: (apiBuyer.reliability === "reliable" ? "vip" :
            apiBuyer.reliability === "unreliable" ? "inactive" : "active") as "active" | "vip" | "inactive" | "blacklisted",
    markets: apiBuyer.targetMarkets || [],
    phone: apiBuyer.phone || "",
    email: apiBuyer.email || "",
    preferredContact: "email" as const,
    tags: apiBuyer.cashBuyer ? ["cash-buyer"] : [],
    score: Math.min(100, 50 + (apiBuyer.dealsClosed * 5)),
    joinedDate: apiBuyer.createdAt,
    lastActive: apiBuyer.updatedAt,
    notes: apiBuyer.notes || undefined,
    // Legacy-compat fields surfaced from the API; default zero/false until
    // the schema exposes them on the Buyer model.
    cashBuyer: apiBuyer.cashBuyer ?? false,
    dealsClosedCount: apiBuyer.dealsClosed ?? 0,
    avgAssignmentFee: 0,
    priceMin: 0,
    priceMax: 0,
    bedsMin: 0,
    rehabLevel: "any" as const,
  });

  // Effective buyers list comes ONLY from the API. Per user directive Q4
  // ("only real, scraped data"), the previous fallback to `buyersSeedData.buyers`
  // — which surfaced 8 fabricated buyers as if they were real — has been removed.
  // When there are no real buyers, the UI renders an <EmptyState/> instead.
  const effectiveBuyers = apiBuyers.map(convertApiBuyer);

  // Get buyer data with performance metrics (empty until APIs are built)
  const getBuyerWithMetrics = (buyerId: string) => {
    const buyer = effectiveBuyers.find(b => b.id === buyerId);
    // Performance and documents will be added in future API updates
    const performance: BuyerPerformance | undefined = undefined;
    const buyBox: BuyBox | undefined = undefined;
    const documents: BuyerDocument[] = [];
    return { buyer, performance, buyBox, documents };
  };

  // Get all unique markets for filter options
  const allMarkets = [...new Set(effectiveBuyers.flatMap(b => b.markets))];

  // Apply filters
  const filteredBuyers = effectiveBuyers.filter(buyer => {
    // Search filter
    const matchesSearch = buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      buyer.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      buyer.markets.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter === "all" || buyer.status === statusFilter;

    // Score filter
    const matchesScore = buyer.score >= scoreFilter[0] && buyer.score <= scoreFilter[1];

    // Market filter
    const matchesMarket = marketFilter.length === 0 ||
      buyer.markets.some(m => marketFilter.includes(m));

    // Performance filter - check API buyer dealsClosed
    const apiBuyer = apiBuyers.find(b => b.id === buyer.id);
    const dealCount = apiBuyer?.dealsClosed || 0;
    let matchesPerformance = true;
    if (performanceFilter === "high") {
      matchesPerformance = dealCount >= 20;
    } else if (performanceFilter === "medium") {
      matchesPerformance = dealCount >= 10 && dealCount < 20;
    } else if (performanceFilter === "low") {
      matchesPerformance = dealCount > 0 && dealCount < 10;
    } else if (performanceFilter === "none") {
      matchesPerformance = dealCount === 0;
    }

    // POF (Proof-of-Funds) filter. BuyerDocument is not yet persisted via the
    // API, so we approximate verified-POF status as: (a) the buyer has a
    // verified POF doc in the seed `documents` array, OR (b) the API buyer
    // is flagged cashBuyer (cash buyers must furnish POF before sending deals
    // in our flow). Once a BuyerDocument table lands, swap this to a real
    // verified-doc lookup.
    const seedPof = buyersSeedData.documents.some(
      (d) => d.buyerId === buyer.id && d.type === "pof" && d.verified,
    );
    // Note: `cashBuyer` isn't on the current Prisma Buyer model — cast through
    // unknown so we can read it from the API payload until the schema adds it.
    // TODO: remove the cast when BuyerDocument + verification fields land.
    const isPofVerified = seedPof || (apiBuyer as unknown as { cashBuyer?: boolean } | undefined)?.cashBuyer === true;
    let matchesDocument = true;
    if (documentFilter === "verified") {
      matchesDocument = isPofVerified;
    } else if (documentFilter === "unverified") {
      matchesDocument = !isPofVerified;
    }

    return matchesSearch && matchesStatus && matchesScore && matchesMarket &&
           matchesPerformance && matchesDocument;
  });

  // Run smart matching for a contract
  const runSmartMatching = async (contractId: string) => {
    try {
      setMatchingLoading(true);
      setSmartMatches([]);
      const response = await fetch(`/api/smart-matching?contractId=${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setSmartMatches(data.matches || []);
        setShowMatchingDemo(true);
      } else {
        toast.error('Failed to run smart matching');
      }
    } catch (error) {
      console.error('Error running smart matching:', error);
      toast.error('Error running smart matching');
    } finally {
      setMatchingLoading(false);
    }
  };

  // Handle Create Campaign
  const handleCreateCampaign = async () => {
    if (!campaignForm.contractId) {
      toast.error("Please select a listing");
      return;
    }
    if (!campaignForm.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!campaignForm.message.trim()) {
      toast.error("Message is required");
      return;
    }

    try {
      setSavingCampaign(true);

      // Get buyer IDs based on audience selection
      let buyerIds: string[] = [];
      if (campaignForm.audience === "all") {
        buyerIds = apiBuyers.map(b => b.id);
      } else if (campaignForm.audience === "vip") {
        buyerIds = apiBuyers.filter(b => b.reliability === "reliable").map(b => b.id);
      } else if (campaignForm.audience === "matched") {
        // Use smart matches if available
        buyerIds = smartMatches.map(m => m.buyerId);
      }

      // Determine method
      let method = "email";
      if (campaignForm.sendEmail && campaignForm.sendSms) {
        method = "both";
      } else if (campaignForm.sendSms) {
        method = "sms";
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignForm.subject,
          contractId: campaignForm.contractId,
          subject: campaignForm.subject,
          message: campaignForm.message,
          method,
          buyerIds,
        }),
      });

      if (response.ok) {
        toast.success('Campaign created successfully');
        setCampaignForm({
          contractId: "",
          audience: "all",
          subject: "",
          message: "",
          sendEmail: true,
          sendSms: true,
        });
        fetchCampaignsOnMount();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Error creating campaign');
    } finally {
      setSavingCampaign(false);
    }
  };

  // Handle Add Buyer
  const handleAddBuyer = async () => {
    if (!buyerForm.name.trim()) {
      toast.error("Buyer name is required");
      return;
    }

    try {
      setSavingBuyer(true);
      const response = await fetch('/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: buyerForm.name,
          email: buyerForm.email || null,
          phone: buyerForm.phone || null,
          company: buyerForm.company || null,
          minPrice: buyerForm.minPrice ? parseFloat(buyerForm.minPrice) : null,
          maxPrice: buyerForm.maxPrice ? parseFloat(buyerForm.maxPrice) : null,
          targetMarkets: buyerForm.targetMarkets ? buyerForm.targetMarkets.split(',').map(m => m.trim()).filter(Boolean) : null,
          propertyTypes: buyerForm.propertyTypes ? buyerForm.propertyTypes.split(',').map(p => p.trim()).filter(Boolean) : null,
          cashBuyer: buyerForm.cashBuyer,
          notes: buyerForm.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create buyer');
      }

      toast.success("Buyer added successfully!");
      setShowAddBuyerDialog(false);
      resetBuyerForm();
      fetchBuyersOnMount();
    } catch (error) {
      console.error('Error adding buyer:', error);
      toast.error(error instanceof Error ? error.message : "Failed to add buyer");
    } finally {
      setSavingBuyer(false);
    }
  };

  // Handle Edit Buyer
  const handleEditBuyer = async () => {
    if (!editingBuyer || !buyerForm.name.trim()) {
      toast.error("Buyer name is required");
      return;
    }

    try {
      setSavingBuyer(true);
      const response = await fetch(`/api/buyers/${editingBuyer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: buyerForm.name,
          email: buyerForm.email || null,
          phone: buyerForm.phone || null,
          company: buyerForm.company || null,
          minPrice: buyerForm.minPrice ? parseFloat(buyerForm.minPrice) : null,
          maxPrice: buyerForm.maxPrice ? parseFloat(buyerForm.maxPrice) : null,
          targetMarkets: buyerForm.targetMarkets ? buyerForm.targetMarkets.split(',').map(m => m.trim()).filter(Boolean) : null,
          propertyTypes: buyerForm.propertyTypes ? buyerForm.propertyTypes.split(',').map(p => p.trim()).filter(Boolean) : null,
          cashBuyer: buyerForm.cashBuyer,
          notes: buyerForm.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update buyer');
      }

      toast.success("Buyer updated successfully!");
      setShowEditBuyerDialog(false);
      setEditingBuyer(null);
      resetBuyerForm();
      fetchBuyersOnMount();
    } catch (error) {
      console.error('Error updating buyer:', error);
      toast.error(error instanceof Error ? error.message : "Failed to update buyer");
    } finally {
      setSavingBuyer(false);
    }
  };

  // Handle Delete Buyer
  const handleDeleteBuyer = async (buyerId: string) => {
    if (!confirm("Are you sure you want to delete this buyer?")) {
      return;
    }

    try {
      const response = await fetch(`/api/buyers/${buyerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete buyer');
      }

      toast.success("Buyer deleted successfully!");
      fetchBuyersOnMount();
    } catch (error) {
      console.error('Error deleting buyer:', error);
      toast.error(error instanceof Error ? error.message : "Failed to delete buyer");
    }
  };

  // Open Edit Dialog
  const openEditDialog = (buyer: ApiBuyer) => {
    setEditingBuyer(buyer);
    setBuyerForm({
      name: buyer.name,
      email: buyer.email || "",
      phone: buyer.phone || "",
      company: buyer.company || "",
      minPrice: buyer.minPrice?.toString() || "",
      maxPrice: buyer.maxPrice?.toString() || "",
      targetMarkets: buyer.targetMarkets?.join(", ") || "",
      propertyTypes: buyer.propertyTypes?.join(", ") || "",
      cashBuyer: buyer.cashBuyer,
      notes: buyer.notes || "",
    });
    setShowEditBuyerDialog(true);
  };

  // Open View Dialog
  const openViewDialog = (buyer: ApiBuyer) => {
    setEditingBuyer(buyer);
    setShowViewBuyerDialog(true);
  };

  // Open Assignment Dialog (optionally with a buyer pre-selected, e.g. from
  // the Smart Matching "Send Deal" button).
  const openAssignmentDialog = (contract: ApiContract, preselectedBuyerId?: string) => {
    setAssigningContract(contract);
    setAssignmentForm({
      buyerId: preselectedBuyerId ?? "",
      assignmentFee: "",
      notes: "",
    });
    setShowAssignmentDialog(true);
  };

  // Open read-only View Assignment Sheet for already-assigned contracts.
  const openViewAssignmentSheet = (contract: ApiContract) => {
    setViewingContract(contract);
    setShowViewAssignmentSheet(true);
  };

  // Handle Contract Assignment
  const handleAssignContract = async () => {
    if (!assigningContract || !assignmentForm.buyerId) {
      toast.error("Please select a buyer");
      return;
    }
    if (!assignmentForm.assignmentFee || parseFloat(assignmentForm.assignmentFee) <= 0) {
      toast.error("Please enter a valid assignment fee");
      return;
    }

    try {
      setSavingAssignment(true);
      const response = await fetch(`/api/contracts/${assigningContract.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: assignmentForm.buyerId,
          assignmentFee: parseFloat(assignmentForm.assignmentFee),
          notes: assignmentForm.notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign contract');
      }

      toast.success("Contract assigned successfully!");
      setShowAssignmentDialog(false);
      setAssigningContract(null);
      resetAssignmentForm();
      fetchContractsOnMount();
    } catch (error) {
      console.error('Error assigning contract:', error);
      toast.error(error instanceof Error ? error.message : "Failed to assign contract");
    } finally {
      setSavingAssignment(false);
    }
  };

  // Parse CSV/pasted data into buyer objects
  const parseCSVData = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 data row

    // Parse header row - normalize column names
    const headerRow = lines[0];
    const headers = headerRow.split(/[,\t]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Map common header variations to our field names
    const headerMap: Record<string, string> = {
      'name': 'name',
      'buyer name': 'name',
      'full name': 'name',
      'email': 'email',
      'email address': 'email',
      'phone': 'phone',
      'phone number': 'phone',
      'tel': 'phone',
      'company': 'company',
      'entity': 'company',
      'business': 'company',
      'markets': 'targetMarkets',
      'target markets': 'targetMarkets',
      'preferred markets': 'targetMarkets',
      'areas': 'targetMarkets',
      'types': 'propertyTypes',
      'property types': 'propertyTypes',
      'property type': 'propertyTypes',
      'budget': 'budget',
      'budget range': 'budget',
      'price range': 'budget',
      'min price': 'minPrice',
      'max price': 'maxPrice',
      'cash': 'cashBuyer',
      'cash buyer': 'cashBuyer',
      'notes': 'notes',
    };

    // Find indices for each field
    const fieldIndices: Record<string, number> = {};
    headers.forEach((h, i) => {
      const mappedField = headerMap[h];
      if (mappedField) fieldIndices[mappedField] = i;
    });

    // Parse data rows
    const buyers: typeof parsedBuyers = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles basic quoted fields)
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const getValue = (field: string) => {
        const idx = fieldIndices[field];
        return idx !== undefined ? values[idx]?.replace(/^["']|["']$/g, '') || '' : '';
      };

      const name = getValue('name');
      if (!name) continue; // Skip rows without name

      // Parse budget range like "200k-400k" or "200000-400000"
      let minPrice: number | null = null;
      let maxPrice: number | null = null;
      const budgetStr = getValue('budget');
      if (budgetStr) {
        const budgetMatch = budgetStr.match(/(\d+)[kK]?\s*[-–to]\s*(\d+)[kK]?/);
        if (budgetMatch) {
          minPrice = parseInt(budgetMatch[1]) * (budgetStr.toLowerCase().includes('k') ? 1000 : 1);
          maxPrice = parseInt(budgetMatch[2]) * (budgetStr.toLowerCase().includes('k') ? 1000 : 1);
        }
      }
      // Override with explicit min/max if present
      const minStr = getValue('minPrice');
      const maxStr = getValue('maxPrice');
      if (minStr) minPrice = parseInt(minStr.replace(/[^0-9]/g, '')) || null;
      if (maxStr) maxPrice = parseInt(maxStr.replace(/[^0-9]/g, '')) || null;

      buyers.push({
        name,
        email: getValue('email'),
        phone: getValue('phone'),
        company: getValue('company'),
        targetMarkets: getValue('targetMarkets').split(/[,;]/).map(m => m.trim()).filter(Boolean),
        propertyTypes: getValue('propertyTypes').split(/[,;]/).map(t => t.trim()).filter(Boolean),
        minPrice,
        maxPrice,
        cashBuyer: ['yes', 'true', '1', 'cash'].includes(getValue('cashBuyer').toLowerCase()),
        notes: getValue('notes'),
      });
    }
    return buyers;
  };

  // Handle CSV file upload
  const handleFileUpload = async (file: File) => {
    setImportFile(file);
    const text = await file.text();
    const parsed = parseCSVData(text);
    setParsedBuyers(parsed);
    if (parsed.length > 0) {
      toast.success(`Parsed ${parsed.length} buyers from file`);
    } else {
      toast.error("No valid buyers found in file. Check the format.");
    }
  };

  // Handle paste data parsing
  const handlePasteDataChange = (text: string) => {
    setImportData(text);
    if (text.trim()) {
      const parsed = parseCSVData(text);
      setParsedBuyers(parsed);
    } else {
      setParsedBuyers([]);
    }
  };

  // Import parsed buyers to database
  const handleImportBuyers = async () => {
    if (parsedBuyers.length === 0) {
      toast.error("No buyers to import. Upload a CSV or paste data first.");
      return;
    }

    setImportingBuyers(true);
    let successCount = 0;
    let errorCount = 0;

    for (const buyer of parsedBuyers) {
      try {
        const response = await fetch('/api/buyers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: buyer.name,
            email: buyer.email || null,
            phone: buyer.phone || null,
            company: buyer.company || null,
            minPrice: buyer.minPrice,
            maxPrice: buyer.maxPrice,
            targetMarkets: buyer.targetMarkets.length > 0 ? buyer.targetMarkets : null,
            propertyTypes: buyer.propertyTypes.length > 0 ? buyer.propertyTypes : null,
            cashBuyer: buyer.cashBuyer,
            notes: buyer.notes || null,
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setImportingBuyers(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} buyers${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      setShowImportDialog(false);
      setImportData("");
      setImportFile(null);
      setParsedBuyers([]);
      fetchBuyersOnMount();
    } else {
      toast.error("Failed to import buyers. Please try again.");
    }
  };

  // Get offers for listing from API data
  const getOffersForListing = (listingId: string) => {
    return apiBuyerOffers
      .filter(o => o.contractId === listingId)
      .sort((a, b) => b.offerPrice - a.offerPrice);
  };

  // Prevent hydration issues by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] bg-gray-50 dark:bg-black p-2 gap-3 overflow-hidden items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] bg-gray-50 dark:bg-black p-2 gap-3 overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col border border-gray-200 dark:border-border bg-white dark:bg-card rounded-lg overflow-hidden">
        {/* Header with Stats */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buyers & Disposition</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your buyer network and match deals</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Buyers
              </Button>
              <Button size="sm" onClick={() => { resetBuyerForm(); setShowAddBuyerDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Buyer
              </Button>
            </div>
          </div>

          {/* Key Metrics - Horizontal Stat Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            <StatChip
              label="Active Buyers"
              value={effectiveBuyers.filter(b => b.status !== 'inactive' && b.status !== 'blacklisted').length}
              subValue={`${effectiveBuyers.length} total`}
              icon={<Users className="h-4 w-4" />}
              color="blue"
            />
            <StatChip
              label="VIP Buyers"
              value={effectiveBuyers.filter(b => b.status === 'vip').length}
              subValue="top performers"
              icon={<Star className="h-4 w-4" />}
              color="amber"
            />
            <StatChip
              label="Active Listings"
              value={listings.filter(l => l.status === 'active').length}
              subValue={`${listings.filter(l => l.status === 'pending').length} pending`}
              icon={<Home className="h-4 w-4" />}
              color="purple"
            />
            <StatChip
              label="Pending Offers"
              value={apiBuyerOffers.filter(o => o.status === 'submitted' || o.status === 'countered').length}
              subValue={`${apiBuyerOffers.length} total`}
              icon={<HandshakeIcon className="h-4 w-4" />}
              color="emerald"
            />
            <StatChip
              label="Avg Assignment"
              value={apiBuyerOffers.length > 0 ? `$${(apiBuyerOffers.reduce((sum, o) => sum + (o.offerPrice || 0), 0) / apiBuyerOffers.length / 1000).toFixed(1)}K` : '$0'}
              subValue={`${apiBuyerOffers.length} offers`}
              icon={<DollarSign className="h-4 w-4" />}
              color="emerald"
            />
            <StatChip
              label="Cash Buyers"
              value={effectiveBuyers.filter(b => b.cashBuyer).length}
              subValue="fast close"
              icon={<Zap className="h-4 w-4" />}
              color="rose"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-black px-4 h-10">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="buyers" className="gap-2">
              <Users className="h-4 w-4" />
              Buyers
            </TabsTrigger>
            <TabsTrigger value="listings" className="gap-2">
              <Home className="h-4 w-4" />
              Active Listings
            </TabsTrigger>
            <TabsTrigger value="matching" className="gap-2">
              <BrainCircuit className="h-4 w-4" />
              Smart Matching
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Send className="h-4 w-4" />
              Blast Campaigns
            </TabsTrigger>
            <TabsTrigger value="offers" className="gap-2">
              <HandshakeIcon className="h-4 w-4" />
              Offers
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0">
                {effectiveBuyers.length === 0 && apiBuyerOffers.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-10 w-10" />}
                    title="No buyers yet"
                    description="Add cash buyers to start matching deals."
                    actionLabel="Add Buyer"
                    onAction={() => { resetBuyerForm(); setShowAddBuyerDialog(true); }}
                  />
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Performers — hidden entirely when no buyers exist */}
                  {effectiveBuyers.length > 0 && (
                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle>Top Performing Buyers</CardTitle>
                      <CardDescription>Based on volume, speed, and reliability</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[360px]">
                        <div className="space-y-2 p-6 pt-0">
                          {effectiveBuyers
                            .filter(b => b.status === 'vip' || b.score >= 85)
                            .map(buyer => {
                              const perf: BuyerPerformance | undefined = undefined;
                              return (
                                <div key={buyer.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-muted rounded-lg hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                      <AvatarFallback className="text-xs">{buyer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{buyer.name}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-gray-500 truncate">{buyer.entity}</p>
                                        {buyer.status === 'vip' && (
                                          <Badge variant="default" className="text-xs h-4 px-1">VIP</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="text-right">
                                      <p className="text-sm font-semibold">{perf?.dealsClosedCount || 0}</p>
                                      <p className="text-xs text-gray-500">deals</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">${((perf?.avgAssignmentFee || 0) / 1000).toFixed(0)}k</p>
                                      <p className="text-xs text-gray-500">avg fee</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                      <span className="text-sm font-medium">{buyer.score}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                  )}

                  {/* Recent Offers — hidden entirely when no offers exist */}
                  {apiBuyerOffers.length > 0 && (
                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle>Recent Offers</CardTitle>
                      <CardDescription>Latest buyer activity on your listings</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[360px]">
                        <div className="space-y-2 p-6 pt-0">
                          {apiBuyerOffers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center mb-3">
                                <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <p className="text-sm text-muted-foreground">No recent offers</p>
                            </div>
                          ) : (
                            apiBuyerOffers.slice(0, 10).map((offer: ApiBuyerOffer) => (
                              <div key={offer.id} className="p-3 border border-gray-200 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-sm font-medium truncate">{offer.buyer.name}</p>
                                      <Badge
                                        variant={
                                          offer.status === 'accepted' ? 'default' :
                                          offer.status === 'submitted' ? 'secondary' :
                                          'outline'
                                        }
                                        className="text-xs h-5"
                                      >
                                        {offer.status}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mb-2">{offer.contract.property.address}</p>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="font-semibold text-green-600 dark:text-green-400">${(offer.offerPrice / 1000).toFixed(0)}k</span>
                                      <span className="text-gray-500">{offer.closingDays || '—'}d close</span>
                                      <span className="text-gray-500">EMD: ${offer.earnestMoney ? (offer.earnestMoney / 1000).toFixed(1) : '0'}k</span>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                        <MoreVertical className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Accept
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Counter
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Phone className="h-4 w-4 mr-2" />
                                        Call
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600">
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Decline
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                  )}
                </div>
                )}
              </TabsContent>

              {/* Buyers Tab */}
              <TabsContent value="buyers" className="mt-0">
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search buyers by name, entity, or market..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[135px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
                    <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Filter className="h-4 w-4 mr-2" />
                          Filters
                          {(scoreFilter[0] > 0 || scoreFilter[1] < 100 || marketFilter.length > 0 || 
                            performanceFilter !== "all" || documentFilter !== "all") && (
                            <Badge variant="secondary" className="ml-2 h-5 px-1">
                              {marketFilter.length + (performanceFilter !== "all" ? 1 : 0) + 
                               (documentFilter !== "all" ? 1 : 0) + 
                               (scoreFilter[0] > 0 || scoreFilter[1] < 100 ? 1 : 0)}
                            </Badge>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-80 p-4">
                        <div className="space-y-4">
                          {/* Score Range */}
                          <div>
                            <Label className="text-sm font-medium">Reputation Score</Label>
                            <div className="flex items-center gap-2 mt-2">
                              <Input 
                                type="number" 
                                value={scoreFilter[0]} 
                                onChange={(e) => setScoreFilter([parseInt(e.target.value) || 0, scoreFilter[1]])}
                                className="w-20 h-8" 
                                min="0" 
                                max="100"
                              />
                              <span className="text-sm text-gray-500">to</span>
                              <Input 
                                type="number" 
                                value={scoreFilter[1]} 
                                onChange={(e) => setScoreFilter([scoreFilter[0], parseInt(e.target.value) || 100])}
                                className="w-20 h-8" 
                                min="0" 
                                max="100"
                              />
                            </div>
                          </div>

                          {/* Performance Level */}
                          <div>
                            <Label className="text-sm font-medium">Performance Level</Label>
                            <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                              <SelectTrigger className="w-full mt-2 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Performance</SelectItem>
                                <SelectItem value="high">High (20+ deals)</SelectItem>
                                <SelectItem value="medium">Medium (10-19 deals)</SelectItem>
                                <SelectItem value="low">Low (1-9 deals)</SelectItem>
                                <SelectItem value="none">No History</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Documents */}
                          <div>
                            <Label className="text-sm font-medium">Proof of Funds</Label>
                            <Select value={documentFilter} onValueChange={setDocumentFilter}>
                              <SelectTrigger className="w-full mt-2 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Buyers</SelectItem>
                                <SelectItem value="verified">POF Verified</SelectItem>
                                <SelectItem value="unverified">No POF</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Markets */}
                          <div>
                            <Label className="text-sm font-medium">Markets</Label>
                            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                              {allMarkets.map(market => (
                                <div key={market} className="flex items-center gap-2">
                                  <Checkbox 
                                    id={market}
                                    checked={marketFilter.includes(market)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setMarketFilter([...marketFilter, market]);
                                      } else {
                                        setMarketFilter(marketFilter.filter(m => m !== market));
                                      }
                                    }}
                                  />
                                  <Label htmlFor={market} className="text-sm font-normal cursor-pointer">
                                    {market}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Reset Filters */}
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setScoreFilter([0, 100]);
                                setMarketFilter([]);
                                setPerformanceFilter("all");
                                setDocumentFilter("all");
                                setStatusFilter("all");
                              }}
                            >
                              Reset All
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => setShowFilters(false)}
                            >
                              Apply Filters
                            </Button>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* View Toggle */}
                    <div className="flex rounded-lg border border-gray-200 dark:border-border p-0.5 bg-gray-100 dark:bg-muted">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2.5",
                          buyerViewMode === "grid" && "bg-white dark:bg-card shadow-sm"
                        )}
                        onClick={() => setBuyerViewMode("grid")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2.5",
                          buyerViewMode === "list" && "bg-white dark:bg-card shadow-sm"
                        )}
                        onClick={() => setBuyerViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Results count */}
                  {(searchQuery || statusFilter !== "all" || scoreFilter[0] > 0 || scoreFilter[1] < 100 || 
                    marketFilter.length > 0 || performanceFilter !== "all" || documentFilter !== "all") && (
                    <div className="flex items-center justify-between px-2">
                      <p className="text-sm text-gray-500">
                        Showing {filteredBuyers.length} of {effectiveBuyers.length} buyers
                      </p>
                      {filteredBuyers.length === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setScoreFilter([0, 100]);
                            setMarketFilter([]);
                            setPerformanceFilter("all");
                            setDocumentFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Buyers Grid/List View */}
                  {effectiveBuyers.length === 0 ? (
                    <EmptyState
                      icon={<Users className="h-10 w-10" />}
                      title="No buyers yet"
                      description="Add cash buyers to start matching deals."
                      actionLabel="Add Buyer"
                      onAction={() => { resetBuyerForm(); setShowAddBuyerDialog(true); }}
                    />
                  ) : buyerViewMode === "grid" ? (
                    <ScrollArea className="h-[495px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                        {filteredBuyers.map(buyer => {
                          const { performance, buyBox, documents } = getBuyerWithMetrics(buyer.id);
                          const apiBuyerData = apiBuyers.find(b => b.id === buyer.id);
                          const hasPof = documents.find(d => d.type === 'pof' && d.verified);

                          return (
                            <Card key={buyer.id} className={cn(
                              "overflow-hidden hover:shadow-md transition-shadow cursor-pointer",
                              buyer.status === 'blacklisted' && "opacity-60"
                            )}>
                              {/* Status bar at top */}
                              <div className={cn(
                                "h-1 w-full",
                                buyer.status === 'vip' && "bg-gradient-to-r from-amber-400 to-amber-500",
                                buyer.status === 'active' && "bg-gradient-to-r from-emerald-400 to-emerald-500",
                                buyer.status === 'inactive' && "bg-gradient-to-r from-gray-300 to-gray-400",
                                buyer.status === 'blacklisted' && "bg-gradient-to-r from-rose-400 to-rose-500"
                              )} />
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarFallback className="text-sm">{buyer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-semibold">{buyer.name}</p>
                                      <p className="text-sm text-muted-foreground">{buyer.entity}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {buyer.status === 'vip' && (
                                      <Badge variant="default" className="text-xs">VIP</Badge>
                                    )}
                                    {buyer.status === 'blacklisted' && (
                                      <Badge variant="destructive" className="text-xs">Blocked</Badge>
                                    )}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => apiBuyerData && openViewDialog(apiBuyerData)}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => apiBuyerData && openEditDialog(apiBuyerData)}>
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edit Buyer
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteBuyer(buyer.id)}>
                                          <Archive className="h-4 w-4 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                {/* Markets */}
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {buyer.markets.slice(0, 3).map(market => (
                                    <Badge key={market} variant="secondary" className="text-xs">{market}</Badge>
                                  ))}
                                  {buyer.markets.length > 3 && (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">+{buyer.markets.length - 3}</Badge>
                                  )}
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Score</p>
                                    <div className="flex items-center gap-1.5">
                                      <Progress value={buyer.score} className="w-10 h-1.5" />
                                      <span className="text-sm font-semibold">{buyer.score}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Deals</p>
                                    <p className="text-sm font-semibold">{performance?.dealsClosedCount || 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">POF</p>
                                    <p className={cn("text-sm font-semibold", hasPof ? "text-emerald-600" : "text-muted-foreground")}>
                                      {hasPof ? "Verified" : "No"}
                                    </p>
                                  </div>
                                </div>

                                {/* Contact buttons */}
                                <div className="flex gap-2 mt-3 pt-3 border-t">
                                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => buyer.email && window.open(`mailto:${buyer.email}`)}>
                                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                                    Email
                                  </Button>
                                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => buyer.phone && window.open(`tel:${buyer.phone}`)}>
                                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                                    Call
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <Card className="overflow-hidden">
                      <ScrollArea className="h-[495px]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white dark:bg-card z-10 border-b">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[225px]">Buyer</TableHead>
                              <TableHead className="w-[162px]">Markets</TableHead>
                              <TableHead className="w-[162px]">Buy Box</TableHead>
                              <TableHead className="w-[135px]">Performance</TableHead>
                              <TableHead className="w-[108px]">Documents</TableHead>
                              <TableHead className="w-[108px]">Score</TableHead>
                              <TableHead className="w-[45px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBuyers.map(buyer => {
                              const { performance, buyBox, documents } = getBuyerWithMetrics(buyer.id);
                              const apiBuyerData = apiBuyers.find(b => b.id === buyer.id);
                              return (
                                <TableRow key={buyer.id} className="hover:bg-muted/50">
                                  <TableCell className="w-[225px]">
                                    <div className="flex items-center gap-3">
                                      <Avatar>
                                        <AvatarFallback>{buyer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium">{buyer.name}</p>
                                        <p className="text-sm text-muted-foreground">{buyer.entity}</p>
                                        <div className="flex gap-1 mt-1">
                                          {buyer.status === 'vip' && (
                                            <Badge variant="default" className="text-xs">VIP</Badge>
                                          )}
                                          {buyer.status === 'blacklisted' && (
                                            <Badge variant="destructive" className="text-xs">Blacklisted</Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-[162px]">
                                    <div className="text-sm">
                                      {buyer.markets.slice(0, 2).join(', ')}
                                      {buyer.markets.length > 2 && (
                                        <span className="text-muted-foreground"> +{buyer.markets.length - 2}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-[162px]">
                                    {buyBox ? (
                                      <div className="text-sm space-y-1">
                                        <p>${(buyBox.priceMin / 1000).toFixed(0)}k-${(buyBox.priceMax / 1000).toFixed(0)}k</p>
                                        <p className="text-muted-foreground">{buyBox.bedsMin}+ beds, {buyBox.rehabLevel} rehab</p>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm italic">Not set</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="w-[135px]">
                                    {performance ? (
                                      <div className="text-sm space-y-1">
                                        <p>{performance.dealsClosedCount} deals</p>
                                        <p className="text-muted-foreground">${(performance.avgAssignmentFee / 1000).toFixed(1)}k avg</p>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-sm italic">No history</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="w-[108px]">
                                    <div className="flex items-center gap-2">
                                      {documents.find(d => d.type === 'pof' && d.verified) ? (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          POF
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          No POF
                                        </Badge>
                                      )}
                                      {documents.length > 1 && (
                                        <span className="text-xs text-muted-foreground">+{documents.length - 1}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-[108px]">
                                    <div className="flex items-center gap-2">
                                      <Progress value={buyer.score} className="w-16 h-2" />
                                      <span className="text-sm font-medium">{buyer.score}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-[45px]">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => apiBuyerData && openViewDialog(apiBuyerData)}>
                                          <Eye className="h-4 w-4 mr-2" />
                                          View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => apiBuyerData && openEditDialog(apiBuyerData)}>
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edit Buyer
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => buyer.email && window.open(`mailto:${buyer.email}`)}>
                                          <Mail className="h-4 w-4 mr-2" />
                                          Send Email
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => buyer.phone && window.open(`tel:${buyer.phone}`)}>
                                          <MessageSquare className="h-4 w-4 mr-2" />
                                          Call
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteBuyer(buyer.id)}>
                                          <Archive className="h-4 w-4 mr-2" />
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
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Listings Tab */}
              <TabsContent value="listings" className="mt-0">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                <div className="space-y-4 pr-4">
                  {contractsLoading ? (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                          <p>Loading contracts...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : listings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
                        <Home className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No Active Listings</h3>
                      <p className="text-muted-foreground max-w-md mb-6">
                        Create contracts from accepted offers in the Contracts page to see them here for disposition.
                      </p>
                      <Button asChild>
                        <a href="/app/contracts">
                          <FileText className="h-4 w-4 mr-2" />
                          View Contracts
                        </a>
                      </Button>
                    </div>
                  ) : (
                    listings.map(listing => {
                      const contract = apiContracts.find(c => c.id === listing.id);
                      const isAssigned = listing.status === 'assigned' || listing.status === 'closed';
                      const assignedBuyer = contract?.assignment?.buyer;
                      const listingOffers = getOffersForListing(listing.id);

                      return (
                        <Card key={listing.id} className={cn("overflow-hidden hover:shadow-md transition-shadow", isAssigned && 'opacity-75')}>
                          {/* Status bar at top */}
                          <div className={cn(
                            "h-1 w-full",
                            listing.status === 'active' && "bg-gradient-to-r from-emerald-400 to-emerald-500",
                            listing.status === 'assigned' && "bg-gradient-to-r from-blue-400 to-blue-500",
                            listing.status === 'pending' && "bg-gradient-to-r from-amber-400 to-amber-500",
                            listing.status === 'closed' && "bg-gradient-to-r from-gray-300 to-gray-400"
                          )} />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold">{listing.address}</h3>
                                  <Badge variant={
                                    listing.status === 'active' ? 'default' :
                                    listing.status === 'assigned' ? 'secondary' :
                                    listing.status === 'closed' ? 'outline' : 'secondary'
                                  }>
                                    {listing.status}
                                  </Badge>
                                  {isAssigned && assignedBuyer && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      {assignedBuyer.name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-5 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-500">Purchase Price</p>
                                    <p className="font-medium">${listing.askPrice.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Est. ARV</p>
                                    <p className="font-medium">${listing.arvEstimate.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Est. Repairs</p>
                                    <p className="font-medium">${listing.repairEstimate.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Days Under Contract</p>
                                    <p className="font-medium">{listing.daysOnMarket}</p>
                                  </div>
                                  {isAssigned && contract?.assignment && (
                                    <div>
                                      <p className="text-gray-500">Assignment Fee</p>
                                      <p className="font-medium text-green-600">${contract.assignment.assignmentFee.toLocaleString()}</p>
                                    </div>
                                  )}
                                </div>
                                {listingOffers.length > 0 && (
                                  <div className="mt-3 pt-3 border-t">
                                    <p className="text-sm text-gray-500 mb-2">Recent Offers:</p>
                                    <div className="flex gap-2">
                                      {listingOffers.slice(0, 3).map(offer => (
                                        <Badge key={offer.id} variant="outline">
                                          {offer.buyer?.name}: ${(offer.offerPrice / 1000).toFixed(0)}k
                                        </Badge>
                                      ))}
                                      {listingOffers.length > 3 && (
                                        <Badge variant="outline">+{listingOffers.length - 3} more</Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {!isAssigned ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedListing(listing);
                                        setActiveTab('matching');
                                      }}
                                    >
                                      <BrainCircuit className="h-4 w-4 mr-2" />
                                      Find Buyers
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => contract && openAssignmentDialog(contract)}
                                      disabled={!contract}
                                    >
                                      <HandshakeIcon className="h-4 w-4 mr-2" />
                                      Assign to Buyer
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => contract && openViewAssignmentSheet(contract)}
                                    disabled={!contract?.assignment}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Assignment
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
                </ScrollArea>
              </TabsContent>

              {/* Matching Tab */}
              <TabsContent value="matching" className="mt-0">
                <div className="space-y-6">
                  {!selectedListing ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-emerald-100 dark:from-blue-900/30 dark:to-emerald-900/30 flex items-center justify-center mb-4">
                        <BrainCircuit className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No Property Selected</h3>
                      <p className="text-muted-foreground max-w-md mb-6">
                        Select a property from the Active Listings tab to run AI-powered buyer matching.
                      </p>
                      <Button onClick={() => setActiveTab("listings")}>
                        <Home className="h-4 w-4 mr-2" />
                        View Active Listings
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Property to Match */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Property Details</CardTitle>
                          <CardDescription>AI will match this property with the best buyers</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4 mb-4">
                            <div>
                              <Label>Address</Label>
                              <p className="text-sm font-medium">{selectedListing.address}</p>
                            </div>
                            <div>
                              <Label>Ask Price</Label>
                              <p className="text-sm font-medium">${selectedListing.askPrice.toLocaleString()}</p>
                            </div>
                            <div>
                              <Label>ARV</Label>
                              <p className="text-sm font-medium">${selectedListing.arvEstimate.toLocaleString()}</p>
                            </div>
                            <div>
                              <Label>Repairs</Label>
                              <p className="text-sm font-medium">${selectedListing.repairEstimate.toLocaleString()}</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => runSmartMatching(selectedListing.id)}
                            disabled={matchingLoading}
                            className="w-full"
                          >
                            {matchingLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Running AI Matching...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Run AI Matching
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Matching Results */}
                      {showMatchingDemo && (
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle>AI Match Results</CardTitle>
                                <CardDescription>Buyers ranked by compatibility score</CardDescription>
                              </div>
                              <Badge variant="secondary">
                                {smartMatches.length} matches from {effectiveBuyers.length} buyers
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {smartMatches.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 dark:from-amber-900/30 dark:to-rose-900/30 flex items-center justify-center mb-4">
                                  <Target className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                                </div>
                                <h3 className="text-base font-semibold mb-1">No Matching Buyers</h3>
                                <p className="text-sm text-muted-foreground max-w-xs">
                                  Try adding more buyers or adjusting their buy box preferences to find matches.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {smartMatches.map(match => (
                                  <div key={match.buyerId} className="p-4 border border-gray-200 dark:border-border rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "text-2xl font-bold",
                                          match.score >= 70 ? "text-green-600 dark:text-green-400" :
                                          match.score >= 50 ? "text-yellow-600 dark:text-yellow-400" :
                                          "text-orange-600 dark:text-orange-400"
                                        )}>
                                          {match.score}%
                                        </div>
                                        <div>
                                          <p className="font-medium">{match.buyerName}</p>
                                          <p className="text-sm text-gray-500">{match.buyerCompany || 'Individual'}</p>
                                        </div>
                                        {match.cashBuyer && (
                                          <Badge variant="secondary" className="text-xs">Cash Buyer</Badge>
                                        )}
                                        {match.reliability === 'reliable' && (
                                          <Badge variant="default" className="text-xs">Reliable</Badge>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        {match.buyerPhone && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(`tel:${match.buyerPhone}`, '_self')}
                                          >
                                            <Phone className="h-4 w-4 mr-2" />
                                            Call
                                          </Button>
                                        )}
                                        {match.buyerEmail && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(`mailto:${match.buyerEmail}`, '_self')}
                                          >
                                            <Mail className="h-4 w-4 mr-2" />
                                            Email
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            // Send Deal opens the existing
                                            // assignment dialog with this
                                            // buyer pre-selected against the
                                            // currently-selected listing.
                                            // (Mass-blast goes through the
                                            // Blast Campaigns tab + the new
                                            // /api/buyer-blasts pipe.)
                                            if (!selectedListing) {
                                              toast.error("No listing selected");
                                              return;
                                            }
                                            const contract = apiContracts.find(
                                              (c) => c.id === selectedListing.id,
                                            );
                                            if (!contract) {
                                              toast.error("Contract not found for this listing");
                                              return;
                                            }
                                            openAssignmentDialog(contract, match.buyerId);
                                          }}
                                        >
                                          <Send className="h-4 w-4 mr-2" />
                                          Send Deal
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {match.reasons.map((reason, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          {reason}
                                        </Badge>
                                      ))}
                                      {match.dealsClosed > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          {match.dealsClosed} deals closed
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              {/* Campaigns Tab */}
              <TabsContent value="campaigns" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Campaign Builder */}
                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle>Create Blast Campaign</CardTitle>
                      <CardDescription>Send your listing to multiple buyers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Select Listing</Label>
                            <Select
                              value={campaignForm.contractId}
                              onValueChange={(value) => setCampaignForm({...campaignForm, contractId: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a listing" />
                              </SelectTrigger>
                              <SelectContent>
                                {listings.map(listing => (
                                  <SelectItem key={listing.id} value={listing.id}>
                                    {listing.address.split(',')[0]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Audience</Label>
                            <Select
                              value={campaignForm.audience}
                              onValueChange={(value) => setCampaignForm({...campaignForm, audience: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select audience" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="matched">
                                  AI Matched Buyers ({smartMatches.length})
                                </SelectItem>
                                <SelectItem value="vip">
                                  VIP Buyers ({apiBuyers.filter(b => b.reliability === 'reliable').length})
                                </SelectItem>
                                <SelectItem value="all">
                                  All Buyers ({apiBuyers.length})
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input
                            placeholder="e.g., HOT DEAL: 3/2 in Riverside - 65% ARV"
                            value={campaignForm.subject}
                            onChange={(e) => setCampaignForm({...campaignForm, subject: e.target.value})}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Message</Label>
                          <textarea
                            className="w-full h-32 px-3 py-2 border border-gray-200 dark:border-border rounded-md bg-white dark:bg-card text-sm resize-none"
                            placeholder="Property details and call to action..."
                            value={campaignForm.message}
                            onChange={(e) => setCampaignForm({...campaignForm, message: e.target.value})}
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="email-campaign"
                                checked={campaignForm.sendEmail}
                                onCheckedChange={(checked) => setCampaignForm({...campaignForm, sendEmail: checked === true})}
                              />
                              <Label htmlFor="email-campaign" className="cursor-pointer">Email</Label>
                            </div>
                            <div className="flex items-center gap-2 opacity-50">
                              <Checkbox
                                id="sms-campaign"
                                checked={false}
                                disabled={true}
                              />
                              <Label htmlFor="sms-campaign" className="cursor-pointer text-gray-400">SMS <span className="text-xs">(Coming Soon)</span></Label>
                            </div>
                          </div>

                          <Button
                            className="w-full"
                            onClick={handleCreateCampaign}
                            disabled={savingCampaign}
                          >
                            {savingCampaign ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                Creating Campaign...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Create Campaign
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Campaigns */}
                  <Card className="h-fit">
                    <CardHeader>
                      <CardTitle>Recent Campaigns</CardTitle>
                      <CardDescription>Track performance of your blast campaigns</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {campaignsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-2 text-muted-foreground">Loading campaigns...</span>
                        </div>
                      ) : apiCampaigns.length === 0 ? (
                        <div className="text-center py-12 px-6">
                          <Send className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-500 dark:text-gray-400">No campaigns yet</p>
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Create your first blast campaign to reach buyers
                          </p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[450px]">
                          <div className="space-y-3 p-6 pt-0">
                            {apiCampaigns.map(campaign => (
                              <div key={campaign.id} className="p-4 border border-gray-200 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{campaign.subject || campaign.name}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {campaign.contract?.property?.address || 'No listing linked'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge
                                      variant={campaign.status === 'sent' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {campaign.status}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {new Date(campaign.sentAt || campaign.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2 text-xs">
                                  <div>
                                    <p className="text-gray-500">Recipients</p>
                                    <p className="font-semibold">{campaign.recipientCount}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Opened</p>
                                    <p className="font-semibold text-green-600 dark:text-green-400">
                                      {campaign.recipientCount > 0
                                        ? Math.round(campaign.openCount / campaign.recipientCount * 100)
                                        : 0}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Clicked</p>
                                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                                      {campaign.recipientCount > 0
                                        ? Math.round(campaign.clickCount / campaign.recipientCount * 100)
                                        : 0}%
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Replied</p>
                                    <p className="font-semibold text-purple-600 dark:text-purple-400">
                                      {campaign.replyCount}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Offers</p>
                                    <p className="font-semibold text-orange-600 dark:text-orange-400">
                                      {campaign.offerCount}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-border">
                                  <Badge variant="secondary" className="text-xs">
                                    {campaign.method === 'both' ? 'Email + SMS' : campaign.method.toUpperCase()}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {campaign.buyerIds.length} buyers
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Offers Tab */}
              <TabsContent value="offers" className="mt-0">
                <div className="space-y-4">
                  {/* Active Offers */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Active Offers</CardTitle>
                      <CardDescription>Manage and respond to buyer offers on your contracts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {offersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-2 text-muted-foreground">Loading offers...</span>
                        </div>
                      ) : apiBuyerOffers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4">
                            <HandshakeIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <h3 className="text-base font-semibold mb-1">No Buyer Offers Yet</h3>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Run a blast campaign or share your listings to start receiving offers from buyers.
                          </p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Property</TableHead>
                              <TableHead>Buyer</TableHead>
                              <TableHead>Offer</TableHead>
                              <TableHead>Terms</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apiBuyerOffers.map(offer => {
                              const askPrice = offer.contract.purchasePrice;
                              return (
                                <TableRow key={offer.id}>
                                  <TableCell>
                                    <p className="font-medium text-sm">{offer.contract.property.address}</p>
                                    <p className="text-xs text-gray-500">Ask: ${askPrice.toLocaleString()}</p>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs">
                                          {offer.buyer.name.split(' ').map(n => n[0]).join('')}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="text-sm font-medium">{offer.buyer.name}</p>
                                        <p className="text-xs text-gray-500">{offer.buyer.company || 'Individual'}</p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <p className="font-semibold">${offer.offerPrice.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500">
                                      {((offer.offerPrice / askPrice) * 100).toFixed(1)}% of ask
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <p>{offer.closingDays || '—'} day close</p>
                                      <p className="text-xs text-gray-500">
                                        EMD: {offer.earnestMoney ? `$${offer.earnestMoney.toLocaleString()}` : '—'}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      offer.status === 'accepted' ? 'default' :
                                      offer.status === 'rejected' ? 'destructive' :
                                      offer.status === 'countered' ? 'outline' :
                                      'secondary'
                                    }>
                                      {offer.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={offer.status !== 'submitted'}
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/buyer-offers/${offer.id}`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ status: 'accepted' })
                                            });
                                            if (res.ok) {
                                              toast.success('Offer accepted');
                                              fetchBuyerOffersOnMount();
                                            } else {
                                              toast.error('Failed to accept offer');
                                            }
                                          } catch {
                                            toast.error('Failed to accept offer');
                                          }
                                        }}
                                      >
                                        Accept
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={offer.status !== 'submitted'}
                                        onClick={() => {
                                          const counterAmount = prompt('Enter counter offer amount:');
                                          if (counterAmount) {
                                            fetch(`/api/buyer-offers/${offer.id}`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                status: 'countered',
                                                counterAmount: parseFloat(counterAmount)
                                              })
                                            }).then(res => {
                                              if (res.ok) {
                                                toast.success('Counter offer sent');
                                                fetchBuyerOffersOnMount();
                                              } else {
                                                toast.error('Failed to send counter offer');
                                              }
                                            }).catch(() => {
                                              toast.error('Failed to send counter offer');
                                            });
                                          }
                                        }}
                                      >
                                        Counter
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={offer.status !== 'submitted'}
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/buyer-offers/${offer.id}`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ status: 'rejected' })
                                            });
                                            if (res.ok) {
                                              toast.success('Offer declined');
                                              fetchBuyerOffersOnMount();
                                            } else {
                                              toast.error('Failed to decline offer');
                                            }
                                          } catch {
                                            toast.error('Failed to decline offer');
                                          }
                                        }}
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Import Buyers Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Buyers</DialogTitle>
            <DialogDescription>
              Import buyer information from a CSV file or paste data directly
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Import Method Selection */}
            <div className="space-y-2">
              <Label>Import Method</Label>
              <RadioGroup value={importMethod} onValueChange={setImportMethod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv">Upload CSV File</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="paste" id="paste" />
                  <Label htmlFor="paste">Paste Data</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="crm" id="crm" />
                  <Label htmlFor="crm">Connect CRM</Label>
                </div>
              </RadioGroup>
            </div>

            {/* CSV Upload */}
            {importMethod === "csv" && (
              <div className="space-y-2">
                <Label htmlFor="csv-upload">Upload CSV File</Label>
                <div className="border-2 border-dashed border-gray-300 dark:border-border rounded-lg p-6 text-center">
                  {importFile ? (
                    <>
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{importFile.name}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {parsedBuyers.length} buyers ready to import
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setImportFile(null);
                          setParsedBuyers([]);
                        }}
                      >
                        Remove File
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Drag and drop your CSV file here, or click to browse
                      </p>
                      <Input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => document.getElementById('csv-upload')?.click()}
                      >
                        Select File
                      </Button>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Supported columns:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Name (required)</li>
                    <li>Email, Phone, Company</li>
                    <li>Markets / Target Markets</li>
                    <li>Types / Property Types</li>
                    <li>Budget / Price Range (e.g. 200k-400k)</li>
                    <li>Cash Buyer (yes/no)</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Paste Data */}
            {importMethod === "paste" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="paste-data">Paste Buyer Data</Label>
                  {parsedBuyers.length > 0 && (
                    <Badge variant="secondary" className="text-green-600">
                      {parsedBuyers.length} buyers parsed
                    </Badge>
                  )}
                </div>
                <Textarea
                  id="paste-data"
                  placeholder="Paste your buyer data here (CSV format or tab-separated)..."
                  className="min-h-[200px] font-mono text-xs"
                  value={importData}
                  onChange={(e) => handlePasteDataChange(e.target.value)}
                />
                <div className="text-xs text-gray-500">
                  <p className="font-medium">Format example:</p>
                  <code className="block bg-gray-100 dark:bg-muted p-2 rounded mt-1">
                    Name,Email,Phone,Markets,Types,Budget<br/>
                    John Doe,john@email.com,555-0123,"Phoenix, Tucson",SFH,200k-400k
                  </code>
                </div>
              </div>
            )}

            {/* CRM Connection */}
            {importMethod === "crm" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20">
                    <div className="text-center">
                      <Building className="h-8 w-8 mx-auto mb-1" />
                      <span className="text-xs">Salesforce</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-20">
                    <div className="text-center">
                      <Building className="h-8 w-8 mx-auto mb-1" />
                      <span className="text-xs">HubSpot</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-20">
                    <div className="text-center">
                      <Building className="h-8 w-8 mx-auto mb-1" />
                      <span className="text-xs">Pipedrive</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-20">
                    <div className="text-center">
                      <Building className="h-8 w-8 mx-auto mb-1" />
                      <span className="text-xs">Zoho CRM</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* Import Settings */}
            <div className="space-y-2">
              <Label>Import Settings</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="auto-score" defaultChecked />
                  <Label htmlFor="auto-score" className="text-sm">
                    Automatically calculate buyer scores based on history
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="send-welcome" />
                  <Label htmlFor="send-welcome" className="text-sm">
                    Send welcome email to new buyers
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="duplicate-check" defaultChecked />
                  <Label htmlFor="duplicate-check" className="text-sm">
                    Check for duplicate entries
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportData("");
              setImportFile(null);
              setParsedBuyers([]);
            }} disabled={importingBuyers}>
              Cancel
            </Button>
            <Button
              onClick={handleImportBuyers}
              disabled={importingBuyers || parsedBuyers.length === 0}
            >
              {importingBuyers ? "Importing..." : `Import ${parsedBuyers.length > 0 ? parsedBuyers.length : ''} Buyers`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Buyer Dialog */}
      <Dialog open={showAddBuyerDialog} onOpenChange={setShowAddBuyerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Buyer</DialogTitle>
            <DialogDescription>
              Add a new buyer to your network
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-name">Name *</Label>
                <Input
                  id="buyer-name"
                  placeholder="John Smith"
                  value={buyerForm.name}
                  onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-company">Company</Label>
                <Input
                  id="buyer-company"
                  placeholder="ABC Investments LLC"
                  value={buyerForm.company}
                  onChange={(e) => setBuyerForm({ ...buyerForm, company: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-email">Email</Label>
                <Input
                  id="buyer-email"
                  type="email"
                  placeholder="john@email.com"
                  value={buyerForm.email}
                  onChange={(e) => setBuyerForm({ ...buyerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-phone">Phone</Label>
                <Input
                  id="buyer-phone"
                  placeholder="(555) 123-4567"
                  value={buyerForm.phone}
                  onChange={(e) => setBuyerForm({ ...buyerForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyer-min-price">Min Price ($)</Label>
                <Input
                  id="buyer-min-price"
                  type="number"
                  placeholder="100000"
                  value={buyerForm.minPrice}
                  onChange={(e) => setBuyerForm({ ...buyerForm, minPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer-max-price">Max Price ($)</Label>
                <Input
                  id="buyer-max-price"
                  type="number"
                  placeholder="500000"
                  value={buyerForm.maxPrice}
                  onChange={(e) => setBuyerForm({ ...buyerForm, maxPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyer-markets">Target Markets (comma-separated)</Label>
              <Input
                id="buyer-markets"
                placeholder="Phoenix, Tucson, Mesa"
                value={buyerForm.targetMarkets}
                onChange={(e) => setBuyerForm({ ...buyerForm, targetMarkets: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyer-property-types">Property Types (comma-separated)</Label>
              <Input
                id="buyer-property-types"
                placeholder="SFH, Multi-family, Condo"
                value={buyerForm.propertyTypes}
                onChange={(e) => setBuyerForm({ ...buyerForm, propertyTypes: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="buyer-cash"
                checked={buyerForm.cashBuyer}
                onCheckedChange={(checked) => setBuyerForm({ ...buyerForm, cashBuyer: checked === true })}
              />
              <Label htmlFor="buyer-cash" className="cursor-pointer">Cash Buyer</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyer-notes">Notes</Label>
              <Textarea
                id="buyer-notes"
                placeholder="Additional notes about this buyer..."
                value={buyerForm.notes}
                onChange={(e) => setBuyerForm({ ...buyerForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBuyerDialog(false)} disabled={savingBuyer}>
              Cancel
            </Button>
            <Button onClick={handleAddBuyer} disabled={savingBuyer || !buyerForm.name.trim()}>
              {savingBuyer ? "Adding..." : "Add Buyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Buyer Dialog */}
      <Dialog open={showEditBuyerDialog} onOpenChange={setShowEditBuyerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Buyer</DialogTitle>
            <DialogDescription>
              Update buyer information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-name">Name *</Label>
                <Input
                  id="edit-buyer-name"
                  placeholder="John Smith"
                  value={buyerForm.name}
                  onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-company">Company</Label>
                <Input
                  id="edit-buyer-company"
                  placeholder="ABC Investments LLC"
                  value={buyerForm.company}
                  onChange={(e) => setBuyerForm({ ...buyerForm, company: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-email">Email</Label>
                <Input
                  id="edit-buyer-email"
                  type="email"
                  placeholder="john@email.com"
                  value={buyerForm.email}
                  onChange={(e) => setBuyerForm({ ...buyerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-phone">Phone</Label>
                <Input
                  id="edit-buyer-phone"
                  placeholder="(555) 123-4567"
                  value={buyerForm.phone}
                  onChange={(e) => setBuyerForm({ ...buyerForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-min-price">Min Price ($)</Label>
                <Input
                  id="edit-buyer-min-price"
                  type="number"
                  placeholder="100000"
                  value={buyerForm.minPrice}
                  onChange={(e) => setBuyerForm({ ...buyerForm, minPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-buyer-max-price">Max Price ($)</Label>
                <Input
                  id="edit-buyer-max-price"
                  type="number"
                  placeholder="500000"
                  value={buyerForm.maxPrice}
                  onChange={(e) => setBuyerForm({ ...buyerForm, maxPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-buyer-markets">Target Markets (comma-separated)</Label>
              <Input
                id="edit-buyer-markets"
                placeholder="Phoenix, Tucson, Mesa"
                value={buyerForm.targetMarkets}
                onChange={(e) => setBuyerForm({ ...buyerForm, targetMarkets: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-buyer-property-types">Property Types (comma-separated)</Label>
              <Input
                id="edit-buyer-property-types"
                placeholder="SFH, Multi-family, Condo"
                value={buyerForm.propertyTypes}
                onChange={(e) => setBuyerForm({ ...buyerForm, propertyTypes: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-buyer-cash"
                checked={buyerForm.cashBuyer}
                onCheckedChange={(checked) => setBuyerForm({ ...buyerForm, cashBuyer: checked === true })}
              />
              <Label htmlFor="edit-buyer-cash" className="cursor-pointer">Cash Buyer</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-buyer-notes">Notes</Label>
              <Textarea
                id="edit-buyer-notes"
                placeholder="Additional notes about this buyer..."
                value={buyerForm.notes}
                onChange={(e) => setBuyerForm({ ...buyerForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBuyerDialog(false)} disabled={savingBuyer}>
              Cancel
            </Button>
            <Button onClick={handleEditBuyer} disabled={savingBuyer || !buyerForm.name.trim()}>
              {savingBuyer ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Buyer Details Dialog */}
      <Dialog open={showViewBuyerDialog} onOpenChange={setShowViewBuyerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buyer Details</DialogTitle>
            <DialogDescription>
              View buyer information and history
            </DialogDescription>
          </DialogHeader>

          {editingBuyer && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">{editingBuyer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{editingBuyer.name}</h3>
                  {editingBuyer.company && (
                    <p className="text-sm text-gray-500">{editingBuyer.company}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {editingBuyer.cashBuyer && (
                      <Badge variant="default" className="text-xs">Cash Buyer</Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">{editingBuyer.reliability}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">Email</Label>
                  <p className="text-sm">{editingBuyer.email || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Phone</Label>
                  <p className="text-sm">{editingBuyer.phone || "Not provided"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">Price Range</Label>
                  <p className="text-sm">
                    {editingBuyer.minPrice || editingBuyer.maxPrice
                      ? `$${editingBuyer.minPrice?.toLocaleString() || '0'} - $${editingBuyer.maxPrice?.toLocaleString() || '∞'}`
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Deals Closed</Label>
                  <p className="text-sm">{editingBuyer.dealsClosed}</p>
                </div>
              </div>

              <div>
                <Label className="text-gray-500 text-xs">Target Markets</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {editingBuyer.targetMarkets && editingBuyer.targetMarkets.length > 0 ? (
                    editingBuyer.targetMarkets.map((market, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{market}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Not set</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-gray-500 text-xs">Property Types</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {editingBuyer.propertyTypes && editingBuyer.propertyTypes.length > 0 ? (
                    editingBuyer.propertyTypes.map((type, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{type}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Not set</p>
                  )}
                </div>
              </div>

              {editingBuyer.notes && (
                <div>
                  <Label className="text-gray-500 text-xs">Notes</Label>
                  <p className="text-sm mt-1">{editingBuyer.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <Label className="text-gray-500 text-xs">Total Revenue</Label>
                  <p className="text-sm font-semibold text-green-600">${editingBuyer.totalRevenue.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Assignments</Label>
                  <p className="text-sm">{editingBuyer._count?.assignments || 0}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewBuyerDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewBuyerDialog(false);
              if (editingBuyer) openEditDialog(editingBuyer);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Buyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Contract to Buyer Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Contract to Buyer</DialogTitle>
            <DialogDescription>
              Select a buyer and set the assignment fee for this contract
            </DialogDescription>
          </DialogHeader>

          {assigningContract && (
            <div className="space-y-4">
              {/* Property Info */}
              <div className="p-3 bg-gray-50 dark:bg-muted rounded-lg">
                <p className="font-medium">{assigningContract.property.address}</p>
                <p className="text-sm text-gray-500">
                  {assigningContract.property.city}, {assigningContract.property.state} {assigningContract.property.zip}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Purchase Price: ${assigningContract.purchasePrice.toLocaleString()}
                </p>
              </div>

              {/* Buyer Selection */}
              <div className="space-y-2">
                <Label htmlFor="assignment-buyer">Select Buyer *</Label>
                <Select
                  value={assignmentForm.buyerId}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, buyerId: value })}
                >
                  <SelectTrigger id="assignment-buyer">
                    <SelectValue placeholder="Choose a buyer" />
                  </SelectTrigger>
                  <SelectContent>
                    {apiBuyers.map(buyer => (
                      <SelectItem key={buyer.id} value={buyer.id}>
                        <div className="flex items-center gap-2">
                          <span>{buyer.name}</span>
                          {buyer.company && <span className="text-gray-500">({buyer.company})</span>}
                          {buyer.cashBuyer && <Badge variant="secondary" className="text-xs">Cash</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignment Fee */}
              <div className="space-y-2">
                <Label htmlFor="assignment-fee">Assignment Fee ($) *</Label>
                <Input
                  id="assignment-fee"
                  type="number"
                  placeholder="15000"
                  value={assignmentForm.assignmentFee}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, assignmentFee: e.target.value })}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="assignment-notes">Notes</Label>
                <Textarea
                  id="assignment-notes"
                  placeholder="Additional notes about this assignment..."
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentDialog(false)} disabled={savingAssignment}>
              Cancel
            </Button>
            <Button onClick={handleAssignContract} disabled={savingAssignment || !assignmentForm.buyerId || !assignmentForm.assignmentFee}>
              {savingAssignment ? "Assigning..." : "Assign Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Assignment Sheet (read-only details for already-assigned contracts) */}
      <Sheet open={showViewAssignmentSheet} onOpenChange={setShowViewAssignmentSheet}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>Assignment Details</SheetTitle>
            <SheetDescription>
              Read-only snapshot of the contract assignment.
            </SheetDescription>
          </SheetHeader>

          {viewingContract && viewingContract.assignment ? (
            <div className="mt-6 space-y-5">
              {/* Property */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs uppercase text-muted-foreground mb-1">Property</p>
                <p className="font-medium">{viewingContract.property.address}</p>
                <p className="text-sm text-muted-foreground">
                  {viewingContract.property.city}, {viewingContract.property.state} {viewingContract.property.zip}
                </p>
              </div>

              {/* Buyer */}
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Assigned To</p>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {viewingContract.assignment.buyer.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{viewingContract.assignment.buyer.name}</p>
                    {viewingContract.assignment.buyer.company && (
                      <p className="text-xs text-muted-foreground">{viewingContract.assignment.buyer.company}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignment Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">Assignment Fee</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    ${viewingContract.assignment.assignmentFee.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">Purchase Price</p>
                  <p className="text-lg font-semibold">
                    ${viewingContract.purchasePrice.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1">Status</p>
                <Badge variant={
                  viewingContract.assignment.status === "closed" ? "default" :
                  viewingContract.assignment.status === "signed" ? "secondary" :
                  "outline"
                }>
                  {viewingContract.assignment.status}
                </Badge>
              </div>

              {/* Dates */}
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Timeline</p>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract created</span>
                    <span>{new Date(viewingContract.createdAt).toLocaleDateString()}</span>
                  </div>
                  {viewingContract.signedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signed</span>
                      <span>{new Date(viewingContract.signedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {viewingContract.escrowOpenedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrow opened</span>
                      <span>{new Date(viewingContract.escrowOpenedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {viewingContract.closingDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closing scheduled</span>
                      <span>{new Date(viewingContract.closingDate).toLocaleDateString()}</span>
                    </div>
                  )}
                  {viewingContract.closedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closed</span>
                      <span>{new Date(viewingContract.closedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {viewingContract.assignment.id && (
                <p className="text-[11px] text-muted-foreground pt-2 border-t">
                  Assignment ID: <code>{viewingContract.assignment.id}</code>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-10 text-center text-sm text-muted-foreground">
              No assignment data available.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
