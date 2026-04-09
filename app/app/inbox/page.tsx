"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
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

// Mock data generator
const generateMockThreads = (): Thread[] => {
  const sentiments: Array<"positive" | "neutral" | "negative" | undefined> = ["positive", "neutral", "negative", undefined];
  const stages = ["New", "Contacted", "Engaged", "Negotiating", "Under Contract", "Won", "Lost"];
  const channels = [["sms"], ["email"], ["sms", "email"], ["voicemail"], ["sms", "email", "voicemail"]];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `thread-${i + 1}`,
    leadId: `L-${1000 + i}`,
    leadName: [
      "John Smith", "Jane Doe", "Mike Johnson", "Sarah Williams", "Robert Brown",
      "Emily Davis", "Chris Miller", "Amanda Wilson", "David Moore", "Lisa Taylor"
    ][i % 10],
    leadAddress: `${100 + i * 10} ${["Main", "Oak", "Pine", "Elm", "Maple"][i % 5]} St, Jacksonville, FL`,
    lastMessage: [
      "Yes, I'm interested in selling. What's your offer?",
      "Can you send me more information about the process?",
      "I need to think about it and discuss with my spouse",
      "The property needs some repairs, does that matter?",
      "What's the timeline for closing?",
      "I'm not ready to sell right now",
      "Can we schedule a time to view the property?",
      "Your offer seems low compared to market value",
      "I have a mortgage, how does that work?",
      "Thanks for reaching out, but I'm not interested"
    ][i % 10],
    lastMessageTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    unreadCount: Math.random() > 0.6 ? Math.floor(Math.random() * 5) : 0,
    channels: channels[i % channels.length],
    sentiment: sentiments[i % 4],
    score: 60 + Math.floor(Math.random() * 40),
    stage: stages[i % stages.length],
    tags: [
      ["Distressed", "High Equity"],
      ["Pre-foreclosure"],
      ["Vacant", "Tax Delinquent"],
      ["Inherited"],
      ["Absentee Owner"],
    ][i % 5],
    phoneNumbers: [`(904) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`],
    emails: [`${["john", "jane", "mike", "sarah", "robert"][i % 5]}@example.com`],
    optInStatus: { sms: Math.random() > 0.2, email: Math.random() > 0.3 }
  }));
};

const generateMockMessages = (threadId: string): Message[] => {
  const threadIndex = parseInt(threadId.split('-')[1]) - 1;
  const addresses = [
    "123 Main St, Jacksonville, FL",
    "456 Oak Ave, Miami, FL",
    "789 Pine Rd, Orlando, FL",
    "321 Elm Dr, Tampa, FL",
    "654 Maple Ct, St. Petersburg, FL"
  ];
  const names = ["John", "Jane", "Mike", "Sarah", "Robert"];
  const address = addresses[threadIndex % 5];
  const firstName = names[threadIndex % 5];

  const conversations: { [key: string]: Message[] } = {
    "thread-1": [
      {
        id: "msg-1-1",
        threadId: "thread-1",
        direction: "out",
        channel: "sms",
        body: `Hi ${firstName}, I noticed your property at ${address} and I'm interested in making a cash offer. Are you still considering selling?`,
        status: "delivered",
        timestamp: new Date(Date.now() - 7200000),
        sender: "You"
      },
      {
        id: "msg-1-2",
        threadId: "thread-1",
        direction: "in",
        channel: "sms",
        body: "Yes, we've been thinking about it. The house needs a lot of work though. What kind of offer are you thinking?",
        status: "read",
        timestamp: new Date(Date.now() - 6900000),
        sender: firstName,
        sentiment: "neutral"
      },
      {
        id: "msg-1-3",
        threadId: "thread-1",
        direction: "out",
        channel: "sms",
        body: "We specialize in properties that need work and can close quickly with cash. Based on comparable sales in your area, I can offer around $285,000.",
        status: "delivered",
        timestamp: new Date(Date.now() - 6600000),
        sender: "You"
      },
      {
        id: "msg-1-4",
        threadId: "thread-1",
        direction: "in",
        channel: "sms",
        body: "That's lower than I was hoping for. We owe about $220,000 on the mortgage. Can you do $300,000?",
        status: "read",
        timestamp: new Date(Date.now() - 6300000),
        sender: firstName,
        sentiment: "negative"
      },
      {
        id: "msg-1-5",
        threadId: "thread-1",
        direction: "out",
        channel: "sms",
        body: "Let me review the numbers again. Could we schedule a quick walkthrough tomorrow?",
        status: "delivered",
        timestamp: new Date(Date.now() - 6000000),
        sender: "You"
      },
      {
        id: "msg-1-6",
        threadId: "thread-1",
        direction: "in",
        channel: "sms",
        body: "Sure, I'm available after 3pm tomorrow. The roof does leak in one spot and the AC doesn't work.",
        status: "read",
        timestamp: new Date(Date.now() - 5700000),
        sender: firstName,
        sentiment: "positive"
      }
    ],
    "thread-2": [
      {
        id: "msg-2-1",
        threadId: "thread-2",
        direction: "out",
        channel: "email",
        body: `Subject: Cash Offer for ${address}\n\nDear ${firstName},\n\nI'm a local real estate investor interested in your property.\n\nWe offer:\n• Quick cash sale (7-14 days)\n• No repairs needed\n• No realtor fees\n\nBest regards`,
        status: "delivered",
        timestamp: new Date(Date.now() - 86400000),
        sender: "You"
      },
      {
        id: "msg-2-2",
        threadId: "thread-2",
        direction: "in",
        channel: "email",
        body: "I might be interested but I'm not in a rush. What's your process?",
        status: "read",
        timestamp: new Date(Date.now() - 82800000),
        sender: firstName,
        sentiment: "neutral"
      }
    ],
    "thread-3": [
      {
        id: "msg-3-1",
        threadId: "thread-3",
        direction: "in",
        channel: "voicemail",
        body: `Hi, this is ${firstName}. I got your letter. I'm going through a divorce and need to sell quickly. Please call me back.`,
        status: "read",
        timestamp: new Date(Date.now() - 10800000),
        sender: firstName,
        sentiment: "negative"
      },
      {
        id: "msg-3-2",
        threadId: "thread-3",
        direction: "out",
        channel: "sms",
        body: `Hi ${firstName}, I just got your voicemail. I can help with a fast cash sale. When would be a good time to talk?`,
        status: "delivered",
        timestamp: new Date(Date.now() - 9000000),
        sender: "You"
      },
      {
        id: "msg-3-3",
        threadId: "thread-3",
        direction: "in",
        channel: "sms",
        body: "Can you call me now? I need to get this handled ASAP.",
        status: "read",
        timestamp: new Date(Date.now() - 8700000),
        sender: firstName,
        sentiment: "negative"
      }
    ]
  };

  if (conversations[threadId]) {
    return conversations[threadId];
  }

  return [
    {
      id: `msg-${threadId}-1`,
      threadId,
      direction: "out",
      channel: "sms",
      body: `Hi, is this the owner of ${address}? I'm interested in purchasing your property for cash.`,
      status: "delivered",
      timestamp: new Date(Date.now() - 3600000),
      sender: "You"
    },
    {
      id: `msg-${threadId}-2`,
      threadId,
      direction: "in",
      channel: "sms",
      body: "Yes, this is the owner. Who is this and how did you get my number?",
      status: "read",
      timestamp: new Date(Date.now() - 3300000),
      sender: firstName,
      sentiment: "neutral"
    },
    {
      id: `msg-${threadId}-3`,
      threadId,
      direction: "out",
      channel: "sms",
      body: "I'm with FlipOps Investment. We use public records. Would you be interested in a cash offer?",
      status: "delivered",
      timestamp: new Date(Date.now() - 3000000),
      sender: "You"
    }
  ];
};

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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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

  useEffect(() => {
    setTimeout(() => {
      setThreads(generateMockThreads());
      setLoading(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (selectedThread) {
      setMessages(generateMockMessages(selectedThread.id));
      setThreads(prev => prev.map(t =>
        t.id === selectedThread.id ? { ...t, unreadCount: 0 } : t
      ));
    }
  }, [selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setThreads(generateMockThreads());
      setRefreshing(false);
      toast.success("Inbox refreshed");
    }, 500);
  };

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
    <div className="flex h-full gap-4">
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
                      <DropdownMenuItem className="rounded-lg">
                        <User className="h-4 w-4 mr-2" />
                        View Lead Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg">
                        <Star className="h-4 w-4 mr-2" />
                        Star Conversation
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg">
                        <Mail className="h-4 w-4 mr-2" />
                        Mark as Unread
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="rounded-lg text-rose-600">
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
  );
}
