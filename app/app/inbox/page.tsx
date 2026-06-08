"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { GenerateOfferModal, OfferData } from "@/app/components/generate-offer-modal";
import { OfferWidget } from "@/app/components/offer-widget";
import {
  Search,
  Filter,
  Phone,
  Mail,
  Voicemail,
  MessageSquare,
  Send,
  Calendar,
  Paperclip,
  MoreVertical,
  CheckCheck,
  Check,
  AlertCircle,
  X,
  FileText,
  File,
  Image as ImageIcon,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  PhoneCall,
  RefreshCw,
  Clock,
  User,
  Star,
  Archive,
  MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Mock data types
interface Message {
  id: string;
  threadId: string;
  direction: "in" | "out";
  channel: "sms" | "email" | "voicemail";
  body: string;
  status: "queued" | "sent" | "delivered" | "failed" | "read";
  sentiment?: "positive" | "neutral" | "negative";
  timestamp: Date;
  sender?: string;
  attachments?: Array<{ name: string; url: string; type: string; size: string }>;
  offer?: OfferData;
}

interface Thread {
  id: string;
  leadId: string;
  leadName: string;
  leadAddress: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  channels: string[];
  sentiment?: "positive" | "neutral" | "negative";
  score: number;
  stage: string;
  tags: string[];
  phoneNumbers: string[];
  emails: string[];
  optInStatus: { sms: boolean; email: boolean };
}

// Phase 5: threads come from GET /api/threads (synthesized from
// Property.contactNotes — see app/api/threads/route.ts). The old mock generator
// and the per-thread mock-message generator below were deleted as part of the
// real-wiring migration.
//
// API shape:
//   { threads: Array<Thread & { messages: Message[] }> }
// where lastMessageTime + message.timestamp arrive as ISO strings.

type ApiMessage = Omit<Message, "timestamp"> & { timestamp: string };
type ApiThread = Omit<Thread, "lastMessageTime"> & {
  lastMessageTime: string;
  messages: ApiMessage[];
};

// Nylas message envelope (subset we care about). The full shape is in
// lib/nylas.ts EmailMessage but Nylas v3 returns date in *seconds*, not ms.
type NylasParticipant = { name?: string; email: string };
type NylasMessageRaw = {
  id: string;
  threadId?: string;
  thread_id?: string;
  subject?: string;
  from?: NylasParticipant[];
  to?: NylasParticipant[];
  date?: number; // unix seconds per Nylas v3
  body?: string;
  snippet?: string;
  unread?: boolean;
};

// Transform Nylas messages -> existing Thread+Message UI shape. We group by
// threadId so each Nylas thread becomes one row. The legacy `/api/threads`
// path returns the same shape; this lets the rest of the page stay unchanged.
function nylasMessagesToThreads(
  messages: NylasMessageRaw[],
  myEmailHint?: string,
): Array<Thread & { messages: Message[] }> {
  const byThread = new Map<string, NylasMessageRaw[]>();
  for (const m of messages) {
    const tid = m.threadId ?? m.thread_id ?? m.id;
    const bucket = byThread.get(tid);
    if (bucket) bucket.push(m);
    else byThread.set(tid, [m]);
  }

  const threads: Array<Thread & { messages: Message[] }> = [];
  for (const [tid, msgs] of byThread.entries()) {
    const sorted = [...msgs].sort((a, b) => (a.date ?? 0) - (b.date ?? 0));
    const last = sorted[sorted.length - 1];
    // "Lead" identity for the row: the non-me participant on the most recent
    // message. Nylas v3 dates arrive as unix seconds.
    const counterpart =
      (last.from?.find((p) => p.email !== myEmailHint) ?? last.from?.[0]) ??
      (last.to?.find((p) => p.email !== myEmailHint) ?? last.to?.[0]);
    const leadName = counterpart?.name?.trim() || counterpart?.email || "Unknown";
    const leadEmail = counterpart?.email ?? "";
    const lastMs = (last.date ?? Math.floor(Date.now() / 1000)) * 1000;

    const mapped: Message[] = sorted.map((m, i) => {
      const isInbound = !!m.from?.some((p) => p.email !== myEmailHint);
      return {
        id: m.id ?? `nylas-${tid}-${i}`,
        threadId: tid,
        direction: isInbound ? "in" : "out",
        channel: "email",
        body: m.snippet || m.body?.replace(/<[^>]+>/g, " ").slice(0, 800) || "",
        status: m.unread ? "sent" : "delivered",
        timestamp: new Date((m.date ?? 0) * 1000),
        sender: isInbound ? leadName.split(" ")[0] : "You",
      };
    });

    threads.push({
      id: `nylas-thread-${tid}`,
      leadId: leadEmail || tid,
      leadName,
      leadAddress: leadEmail,
      lastMessage: mapped[mapped.length - 1]?.body ?? "",
      lastMessageTime: new Date(lastMs),
      unreadCount: sorted.filter((m) => m.unread).length,
      channels: ["email"],
      sentiment: undefined,
      score: 0,
      stage: "New",
      tags: [],
      phoneNumbers: [],
      emails: leadEmail ? [leadEmail] : [],
      optInStatus: { sms: true, email: true },
      messages: mapped,
    });
  }

  // Most recent thread first
  threads.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  return threads;
}

async function fetchLegacyThreads(): Promise<Array<Thread & { messages: Message[] }>> {
  const res = await fetch("/api/threads", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /api/threads failed: ${res.status}`);
  }
  const json = (await res.json()) as { threads?: ApiThread[] };
  const raw = json.threads ?? [];
  return raw.map((t) => ({
    ...t,
    lastMessageTime: new Date(t.lastMessageTime),
    messages: (t.messages ?? []).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  }));
}

// Primary fetch: try Nylas via /api/email/messages first. If the user has not
// connected an email account, /api/email/messages returns 400 with
// { error: 'Email not connected' } — we treat that as a soft signal and fall
// back to the legacy contactNotes-synthesized path at /api/threads. Returns
// the threads and a `source` flag the header uses to render the "Connected
// via Nylas" pill.
async function fetchThreads(): Promise<{
  threads: Array<Thread & { messages: Message[] }>;
  source: "nylas" | "legacy";
  connectedEmail?: string;
}> {
  try {
    const [statusRes, messagesRes] = await Promise.all([
      fetch("/api/email/status", { cache: "no-store" }),
      fetch("/api/email/messages?limit=100", { cache: "no-store" }),
    ]);
    if (messagesRes.ok) {
      const status = statusRes.ok ? await statusRes.json().catch(() => ({})) : {};
      const body = (await messagesRes.json()) as { messages?: NylasMessageRaw[] };
      const threads = nylasMessagesToThreads(body.messages ?? [], status?.email);
      return { threads, source: "nylas", connectedEmail: status?.email };
    }
    // 400 = not connected, anything else = real error -> fall through
  } catch (err) {
    console.warn("[Inbox] Nylas path failed, falling back to /api/threads", err);
  }
  const legacy = await fetchLegacyThreads();
  return { threads: legacy, source: "legacy" };
}

// generateMockMessages() removed — messages now come bundled with each Thread
// from GET /api/threads. See ApiThread.messages above.

const messageTemplates = [
  { id: "1", name: "Initial Outreach", body: "Hi {{firstName}}, I noticed your property at {{address}}. We can make you a cash offer with a quick close. Interested?" },
  { id: "2", name: "Follow Up", body: "Hi {{firstName}}, following up on my message about {{address}}. We can close in 7 days. When can we discuss?" },
  { id: "3", name: "Offer Ready", body: "Hi {{firstName}}, we've prepared a cash offer for {{address}}. No agent fees. Can we review?" },
];

// Refined skeleton with subtle animation
function ThreadListSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-xl"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-10 rounded-md" />
          </div>
          <Skeleton className="h-3 w-full rounded-md mb-1.5" />
          <Skeleton className="h-3 w-3/4 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <Skeleton className={cn(
            "rounded-2xl",
            i % 2 === 0 ? "w-[252px] h-20" : "w-[288px] h-16"
          )} />
        </div>
      ))}
    </div>
  );
}

// Smart time formatter
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Score ring component
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size} viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="currentColor"
          className="text-gray-100 dark:text-gray-800"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

export default function InboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Array<Thread & { messages: Message[] }>>([]);
  const [selectedThread, setSelectedThread] = useState<(Thread & { messages: Message[] }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"sms" | "email" | "voicemail">("sms");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showComplianceWarning, setShowComplianceWarning] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [advancedFilters, setAdvancedFilters] = useState({
    channels: [] as string[],
    sentiment: [] as string[],
    stage: [] as string[],
    score: { min: 0, max: 100 },
    unreadOnly: false,
    optedOut: false,
    dateRange: "all" as "all" | "today" | "week" | "month",
  });

  // Real load: GET /api/threads. On failure we surface an EmptyState rather
  // than fabricate mock data (per the platform UX walkthrough).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const real = await fetchThreads();
        if (cancelled) return;
        setThreads(real);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("[Inbox] failed to load threads", err);
        setThreads([]);
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (selectedThread) {
      // Messages now travel with the Thread payload.
      setMessages(selectedThread.messages ?? []);
      setThreads(prev => prev.map(t =>
        t.id === selectedThread.id ? { ...t, unreadCount: 0 } : t
      ));
    }
  }, [selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const real = await fetchThreads();
      setThreads(real);
      setLoadError(null);
      toast.success("Inbox refreshed");
    } catch (err) {
      console.error("[Inbox] refresh failed", err);
      setLoadError(err instanceof Error ? err.message : "Failed to refresh");
      toast.error("Couldn't refresh inbox");
    } finally {
      setRefreshing(false);
    }
  };

  // ---- Phase 5 action wiring ----
  // Schedule Call -> dialer prefilled with this lead.
  const handleScheduleCall = (leadId: string) => {
    router.push(`/app/dialer?leadId=${encodeURIComponent(leadId)}`);
  };
  // View Lead Profile -> open the lead row in the Leads page.
  const handleViewLeadProfile = (leadId: string) => {
    router.push(`/app/leads?propertyId=${encodeURIComponent(leadId)}`);
  };
  // TODO(phase 6): real cadence enrollment via Nylas + Telnyx sequencing.
  const handleEnrollInCadence = () =>
    toast("Cadences ship with Nylas + Telnyx", { description: "Sequenced email + SMS outreach drops in Phase 6, when the Conversation model goes live." });
  // TODO(phase 6): real read-state requires a Conversation/Message model.
  const handleMarkUnread = () =>
    toast("Read state ships with the Conversation model", { description: "Mark unread, mark read, and inbox zero land together in Phase 6." });
  // TODO(phase 6): starring requires a per-user thread metadata table.
  const handleStar = () =>
    toast("Starring ships with thread metadata", { description: "Per-user pins and stars land in Phase 6 alongside read state." });
  // TODO(phase 6): archive requires soft-delete flag on the synthesized thread source.
  const handleArchive = () =>
    toast("Archive ships with the Conversation model", { description: "Soft-delete + bulk archive land in Phase 6 with the message store." });

  const sendMessage = () => {
    if ((!messageBody.trim() && attachments.length === 0) || !selectedThread) return;

    const currentHour = new Date().getHours();
    if (currentHour < 8 || currentHour > 21) {
      setShowComplianceWarning(true);
      return;
    }

    if (selectedChannel === "sms" && !selectedThread.optInStatus.sms) {
      toast.error("Contact has opted out of SMS messages");
      return;
    }

    const messageAttachments = attachments.length > 0
      ? attachments.map(file => ({
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        }))
      : undefined;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      threadId: selectedThread.id,
      direction: "out",
      channel: selectedChannel,
      body: messageBody,
      status: "queued",
      timestamp: new Date(),
      sender: "You",
      attachments: messageAttachments
    };

    setMessages([...messages, newMessage]);
    setMessageBody("");
    setAttachments([]);

    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === newMessage.id ? { ...m, status: "sent" } : m
      ));
    }, 1000);

    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === newMessage.id ? { ...m, status: "delivered" } : m
      ));
      toast.success("Message delivered");
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="h-3.5 w-3.5" />;
    return <File className="h-3.5 w-3.5" />;
  };

  const handleOfferGenerated = (offer: OfferData) => {
    if (!selectedThread) return;

    const offerMessage: Message = {
      id: `msg-${Date.now()}`,
      threadId: selectedThread.id,
      direction: "out",
      channel: selectedChannel,
      body: `Cash Offer: $${offer.offerPrice.toLocaleString()} - Closing in ${Math.ceil((offer.closingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`,
      status: "sent",
      timestamp: new Date(),
      sender: "You",
      offer: offer
    };

    setMessages([...messages, offerMessage]);
    setShowOfferModal(false);

    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === offerMessage.id ? { ...m, status: "delivered" } : m
      ));
    }, 1000);
  };

  const applyTemplate = (templateId: string) => {
    const template = messageTemplates.find(t => t.id === templateId);
    if (template && selectedThread) {
      let body = template.body;
      body = body.replace("{{firstName}}", selectedThread.leadName.split(" ")[0]);
      body = body.replace("{{address}}", selectedThread.leadAddress);
      setMessageBody(body);
      setShowTemplates(false);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive": return "text-emerald-500";
      case "negative": return "text-rose-500";
      case "neutral": return "text-amber-500";
      default: return "text-gray-400";
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "positive": return <TrendingUp className="h-3.5 w-3.5" />;
      case "negative": return <TrendingDown className="h-3.5 w-3.5" />;
      case "neutral": return <Minus className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const getChannelIcon = (channel: string, className = "h-3.5 w-3.5") => {
    switch (channel) {
      case "sms": return <MessageSquare className={className} />;
      case "email": return <Mail className={className} />;
      case "voicemail": return <Voicemail className={className} />;
      default: return null;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "New": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
      case "Contacted": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800";
      case "Engaged": return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800";
      case "Negotiating": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
      case "Under Contract": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
      case "Won": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
      case "Lost": return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-muted dark:text-gray-400 dark:border-border";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  // Filter and sort threads - unread first, then by date
  const filteredThreads = threads
    .filter(thread => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!thread.leadName.toLowerCase().includes(query) &&
            !thread.leadAddress.toLowerCase().includes(query) &&
            !thread.leadId.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (filter !== "all") {
        switch (filter) {
          case "unread":
            if (thread.unreadCount === 0) return false;
            break;
          case "sms":
            if (!thread.channels.includes("sms")) return false;
            break;
          case "email":
            if (!thread.channels.includes("email")) return false;
            break;
          case "positive":
            if (thread.sentiment !== "positive") return false;
            break;
          case "negative":
            if (thread.sentiment !== "negative") return false;
            break;
        }
      }

      if (advancedFilters.channels.length > 0) {
        if (!advancedFilters.channels.some(c => thread.channels.includes(c))) return false;
      }

      if (advancedFilters.sentiment.length > 0) {
        if (!thread.sentiment || !advancedFilters.sentiment.includes(thread.sentiment)) return false;
      }

      if (advancedFilters.stage.length > 0) {
        if (!advancedFilters.stage.includes(thread.stage)) return false;
      }

      if (thread.score < advancedFilters.score.min || thread.score > advancedFilters.score.max) {
        return false;
      }

      if (advancedFilters.unreadOnly && thread.unreadCount === 0) return false;

      return true;
    })
    .sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });

  const getActiveFilterCount = () => {
    let count = 0;
    if (filter !== "all") count++;
    if (advancedFilters.channels.length > 0) count++;
    if (advancedFilters.sentiment.length > 0) count++;
    if (advancedFilters.stage.length > 0) count++;
    if (advancedFilters.score.min > 0 || advancedFilters.score.max < 100) count++;
    if (advancedFilters.unreadOnly) count++;
    return count;
  };

  const resetFilters = () => {
    setFilter("all");
    setAdvancedFilters({
      channels: [],
      sentiment: [],
      stage: [],
      score: { min: 0, max: 100 },
      unreadOnly: false,
      optedOut: false,
      dateRange: "all",
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header — matches Tasks gold-standard shape */}
      <div className="shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every SMS, voicemail, and email thread with your leads — sorted by what needs you first.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
      {/* Left Panel - Thread List */}
      <div className="w-[306px] flex flex-col rounded-2xl border border-gray-200/80 dark:border-border bg-white dark:bg-card shadow-sm flex-shrink-0 min-h-0 overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-muted border-gray-200 dark:border-border rounded-xl text-sm shadow-sm focus-visible:ring-blue-500/20 focus-visible:ring-offset-0"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-white dark:hover:bg-gray-900"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 text-gray-500", refreshing && "animate-spin")} />
            </Button>
          </div>

          {/* Filter Row */}
          <div className="flex gap-2 mt-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="flex-1 h-8 text-xs rounded-lg bg-white dark:bg-muted border-gray-200 dark:border-border">
                <SelectValue placeholder="All conversations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conversations</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="sms">SMS only</SelectItem>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="positive">Positive sentiment</SelectItem>
                <SelectItem value="negative">Needs attention</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-lg border-gray-200 dark:border-border relative",
                    getActiveFilterCount() > 0 && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {getActiveFilterCount() > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-blue-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center shadow-sm">
                      {getActiveFilterCount()}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 rounded-xl" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filters</h4>
                    {getActiveFilterCount() > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700">
                        Reset all
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Channels</Label>
                    {["sms", "email", "voicemail"].map((channel) => (
                      <div key={channel} className="flex items-center space-x-3">
                        <Checkbox
                          id={`channel-${channel}`}
                          checked={advancedFilters.channels.includes(channel)}
                          onCheckedChange={(checked) => {
                            setAdvancedFilters(prev => ({
                              ...prev,
                              channels: checked
                                ? [...prev.channels, channel]
                                : prev.channels.filter(c => c !== channel)
                            }));
                          }}
                          className="rounded"
                        />
                        <Label htmlFor={`channel-${channel}`} className="text-sm font-normal capitalize cursor-pointer">
                          {channel === "sms" ? "SMS" : channel}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="unread-only"
                      checked={advancedFilters.unreadOnly}
                      onCheckedChange={(checked) =>
                        setAdvancedFilters(prev => ({ ...prev, unreadOnly: checked as boolean }))
                      }
                      className="rounded"
                    />
                    <Label htmlFor="unread-only" className="text-sm font-normal cursor-pointer">
                      Unread only
                    </Label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Thread List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {loading ? (
              <ThreadListSkeleton />
            ) : threads.length === 0 ? (
              // Hard empty state (no threads at all, or fetch failed). Per the
              // UX walkthrough, link to /app/leads as the next action.
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title="No conversations yet"
                description="Messages from leads will appear here once you reach out."
                actionLabel="Go to Leads"
                actionHref="/app/leads"
                compact
              />
            ) : filteredThreads.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-500">No conversations found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isRead = thread.unreadCount === 0;
                const isSelected = selectedThread?.id === thread.id;

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThread(thread)}
                    className={cn(
                      "group p-3 rounded-xl cursor-pointer transition-all duration-150 mb-1",
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 shadow-sm"
                        : "hover:bg-gray-50 dark:hover:bg-gray-900/50",
                      isRead && !isSelected && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Unread indicator */}
                      <div className="flex-shrink-0 w-2 mt-4 flex justify-center">
                        {!isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                        )}
                      </div>
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                        isSelected
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400"
                      )}>
                        {thread.leadName.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={cn(
                            "text-[13px] truncate",
                            !isRead ? "font-semibold text-gray-900 dark:text-white" : "font-medium text-gray-700 dark:text-gray-300"
                          )}>
                            {thread.leadName}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {thread.sentiment && (
                              <span className={cn(
                                "p-0.5 rounded",
                                thread.sentiment === "positive" && "bg-emerald-100 dark:bg-emerald-900/30",
                                thread.sentiment === "negative" && "bg-rose-100 dark:bg-rose-900/30",
                                thread.sentiment === "neutral" && "bg-amber-100 dark:bg-amber-900/30"
                              )}>
                                <span className={getSentimentColor(thread.sentiment)}>
                                  {getSentimentIcon(thread.sentiment)}
                                </span>
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400 font-medium tabular-nums">
                              {formatTime(thread.lastMessageTime)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mb-1">
                          {thread.leadAddress}
                        </p>
                        <p className={cn(
                          "text-[12px] line-clamp-2 leading-relaxed",
                          isRead ? "text-gray-400 dark:text-gray-500" : "text-gray-600 dark:text-gray-400"
                        )}>
                          {thread.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Center Panel - Conversation */}
      <div className="flex-1 flex flex-col rounded-2xl border border-gray-200/80 dark:border-border bg-white dark:bg-card shadow-sm min-w-0 min-h-0 overflow-hidden">
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold shadow-sm">
                    {selectedThread.leadName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {selectedThread.leadName}
                    </h2>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedThread.leadAddress} • {selectedThread.leadId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={cn(
                    "text-[11px] font-medium px-2.5 py-0.5 rounded-md border",
                    getStageColor(selectedThread.stage)
                  )}>
                    {selectedThread.stage}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem
                        className="rounded-lg"
                        onClick={() => handleViewLeadProfile(selectedThread.leadId)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        View Lead Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg" onClick={handleStar}>
                        <Star className="h-4 w-4 mr-2" />
                        Star Conversation
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg" onClick={handleMarkUnread}>
                        <Mail className="h-4 w-4 mr-2" />
                        Mark as Unread
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="rounded-lg text-rose-600" onClick={handleArchive}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-5 space-y-4">
                {messages.map((message, index) => {
                  const isOut = message.direction === "out";
                  const showDate = index === 0 ||
                    new Date(message.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <span className="text-[11px] text-gray-400 bg-gray-50 dark:bg-muted px-3 py-1 rounded-full">
                            {message.timestamp.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] group")}>
                          <div
                            className={cn(
                              "px-4 py-2.5 rounded-2xl shadow-sm",
                              isOut
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md"
                                : "bg-gray-100 dark:bg-muted text-gray-900 dark:text-white rounded-bl-md"
                            )}
                          >
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.body}</p>
                            {message.offer && (
                              <div className="mt-2">
                                <OfferWidget
                                  offer={message.offer}
                                  onViewDetails={() => console.log('View:', message.offer)}
                                  onAccept={() => console.log('Accept:', message.offer)}
                                  onReject={() => console.log('Reject:', message.offer)}
                                  onCounter={() => console.log('Counter:', message.offer)}
                                />
                              </div>
                            )}
                            {message.attachments && (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((att, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs opacity-80">
                                    <Paperclip className="h-3 w-3" />
                                    <span>{att.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={cn(
                            "flex items-center gap-1.5 mt-1 px-1",
                            isOut ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "p-0.5 rounded",
                              isOut ? "text-gray-400" : "text-gray-400"
                            )}>
                              {getChannelIcon(message.channel, "h-3 w-3")}
                            </span>
                            <span className="text-[10px] text-gray-400 tabular-nums">
                              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOut && (
                              <span className="text-gray-400">
                                {message.status === "delivered" && <CheckCheck className="h-3 w-3 text-blue-500" />}
                                {message.status === "sent" && <Check className="h-3 w-3" />}
                                {message.status === "queued" && <Clock className="h-3 w-3" />}
                                {message.status === "failed" && <AlertCircle className="h-3 w-3 text-rose-500" />}
                              </span>
                            )}
                            {message.sentiment && (
                              <span className={getSentimentColor(message.sentiment)}>
                                {getSentimentIcon(message.sentiment)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="p-4 border-t border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/50 flex-shrink-0">
              {showComplianceWarning && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Outside business hours</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Messages should be sent between 8 AM - 9 PM</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => { setShowComplianceWarning(false); sendMessage(); }}>
                          Send Anyway
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setShowComplianceWarning(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-3">
                <Select value={selectedChannel} onValueChange={(v: any) => setSelectedChannel(v)}>
                  <SelectTrigger className="w-28 h-8 text-xs rounded-lg bg-white dark:bg-muted border-gray-200 dark:border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <div className="h-5 w-px bg-gray-200 dark:bg-muted" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 rounded-lg", showTemplates && "bg-gray-100 dark:bg-muted")}
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
              </div>

              {showTemplates && (
                <div className="mb-3 p-3 bg-white dark:bg-muted rounded-xl border border-gray-200 dark:border-border shadow-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Quick Templates</p>
                  <div className="space-y-1">
                    {messageTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t.id)}
                        className="w-full text-left p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{t.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-muted rounded-lg border border-gray-200 dark:border-border text-xs shadow-sm">
                      {getFileIcon(file)}
                      <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-3">
                <Textarea
                  placeholder="Type a message..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="flex-1 min-h-[47px] max-h-[108px] resize-none text-sm rounded-xl bg-white dark:bg-muted border-gray-200 dark:border-border focus-visible:ring-blue-500/20 focus-visible:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      sendMessage();
                    }
                  }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!messageBody.trim() && attachments.length === 0}
                  className="self-end h-[47px] w-[47px] rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm shadow-blue-500/25"
                  size="icon"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-muted flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Select a conversation</p>
              <p className="text-xs text-gray-400 mt-1">Choose from the list on the left</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Lead Details */}
      {selectedThread && (
        <div className="w-[252px] flex flex-col gap-4 flex-shrink-0 overflow-y-auto min-h-0">
          {/* Score Card */}
          <Card className="rounded-2xl border-gray-200/80 dark:border-border shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Score</p>
                  <p className="text-xs text-gray-400 mt-0.5">Based on engagement</p>
                </div>
                <ScoreRing score={selectedThread.score} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {selectedThread.tags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-400"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contact Info Card */}
          <Card className="rounded-2xl border-gray-200/80 dark:border-border shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedThread.phoneNumbers[0]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedThread.emails[0]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Property</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedThread.leadAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="rounded-2xl border-gray-200/80 dark:border-border shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9 text-sm rounded-lg border-gray-200 dark:border-border hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:text-blue-400 transition-colors"
                onClick={() => handleScheduleCall(selectedThread.leadId)}
              >
                <PhoneCall className="h-4 w-4 mr-2.5" />
                Schedule Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9 text-sm rounded-lg border-gray-200 dark:border-border hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800 dark:hover:text-emerald-400 transition-colors"
                onClick={() => setShowOfferModal(true)}
              >
                <FileText className="h-4 w-4 mr-2.5" />
                Generate Offer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9 text-sm rounded-lg border-gray-200 dark:border-border hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 dark:hover:bg-purple-950/30 dark:hover:border-purple-800 dark:hover:text-purple-400 transition-colors"
                onClick={handleEnrollInCadence}
              >
                <Zap className="h-4 w-4 mr-2.5" />
                Enroll in Cadence
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <GenerateOfferModal
        open={showOfferModal}
        onOpenChange={setShowOfferModal}
        leadInfo={selectedThread ? {
          name: selectedThread.leadName,
          address: selectedThread.leadAddress,
          leadId: selectedThread.leadId
        } : null}
        onOfferGenerated={handleOfferGenerated}
      />
      </div>
    </div>
  );
}
