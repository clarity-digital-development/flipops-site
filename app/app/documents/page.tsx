"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import {
  FileText,
  Plus,
  Search,
  Download,
  Send,
  Eye,
  Edit,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileSignature,
  FolderOpen,
  Users,
  GitBranch,
  Package,
  ChevronRight,
  ChevronDown,
  Copy,
  RefreshCw,
  Archive,
  FileCheck,
  FilePlus,
  History,
  Layers,
  LayoutGrid,
  List,
  Home,
  Lock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  documentsSeedData,
  type Document,
  type DocumentTemplate,
  type Folder as FolderType,
  type Packet,
  getTemplatesByCategory,
  getDocumentVersions,
  LEAD_EXPORTS_FOLDER_ID,
} from "./seed-data";
import { EmptyState } from "@/components/ui/empty-state";

type ViewMode = 'table' | 'kanban' | 'packets';
type DocumentStatus = Document['status'];

// Status configuration for consistent styling
const statusConfig: Record<DocumentStatus, {
  color: string;
  bgColor: string;
  gradient: string;
  icon: typeof FileText;
  label: string;
}> = {
  draft: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    gradient: 'from-slate-400 to-slate-500',
    icon: FileText,
    label: 'Draft'
  },
  sent: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    gradient: 'from-blue-400 to-blue-500',
    icon: Send,
    label: 'Awaiting Signature'
  },
  signed: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
    gradient: 'from-emerald-400 to-emerald-500',
    icon: CheckCircle,
    label: 'Signed'
  },
  void: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    gradient: 'from-red-400 to-red-500',
    icon: XCircle,
    label: 'Void'
  },
  expired: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
    gradient: 'from-amber-400 to-amber-500',
    icon: AlertCircle,
    label: 'Expired'
  },
};

// Document type icons
const docTypeIcons: Record<Document['docType'], typeof FileText> = {
  LOI: FileSignature,
  PSA: FileCheck,
  JV: Users,
  Assignment: GitBranch,
  NDA: Lock,
  Addendum: FilePlus,
  Other: FileText,
};

// Stat chip component for metrics display.
// `variant='platform'` signals platform-provided values (e.g. template library
// counts) — rendered with a dashed, muted treatment so they don't read as
// user-data zeros next to real metrics. Default 'data' keeps the solid look.
function StatChip({
  icon: Icon,
  label,
  value,
  color = 'gray',
  variant = 'data',
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
  color?: 'gray' | 'blue' | 'emerald' | 'amber' | 'purple';
  variant?: 'data' | 'platform';
}) {
  const colorClasses = {
    gray: 'text-gray-600 dark:text-gray-400',
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  const containerClasses =
    variant === 'platform'
      ? 'bg-transparent border-dashed border-gray-200 dark:border-gray-700/60'
      : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800';

  const valueClasses =
    variant === 'platform'
      ? 'text-sm font-semibold tabular-nums text-muted-foreground'
      : 'text-sm font-semibold tabular-nums';

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border', containerClasses)}>
      <Icon className={cn('h-4 w-4', colorClasses[color], variant === 'platform' && 'opacity-70')} />
      <div className="flex items-baseline gap-1.5">
        <span className={valueClasses}>{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

// Document card for kanban view
function DocumentCard({
  doc,
  onClick,
  onView,
  onDownload,
  onSend,
}: {
  doc: Document;
  onClick: () => void;
  onView: () => void;
  onDownload: () => void;
  onSend: () => void;
}) {
  const config = statusConfig[doc.status];
  const TypeIcon = docTypeIcons[doc.docType];

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
        "hover:-translate-y-0.5",
        "overflow-hidden"
      )}
      onClick={onClick}
    >
      {/* Status gradient bar */}
      <div className={cn("h-1 w-full bg-gradient-to-r", config.gradient)} />

      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className={cn("p-1.5 rounded-md", config.bgColor)}>
            <TypeIcon className={cn("h-4 w-4", config.color)} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              {doc.status === 'draft' && (
                <DropdownMenuItem onClick={onSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h4 className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {doc.title}
        </h4>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {doc.docType}
          </Badge>
          <span className="tabular-nums">v{doc.version}</span>
        </div>

        {doc.relatedName && (
          <div className="text-xs text-muted-foreground truncate mb-2">
            {doc.relatedName}
          </div>
        )}

        {doc.signerRoles.length > 0 && (
          <div className="flex -space-x-1.5">
            {doc.signerRoles.slice(0, 3).map((signer, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-medium",
                        signer.status === 'signed' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
                        signer.status === 'sent' && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
                        signer.status === 'viewed' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
                        signer.status === 'pending' && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {signer.role[0]}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <div className="font-medium">{signer.role}</div>
                      {signer.name && <div className="text-muted-foreground">{signer.name}</div>}
                      <div className="capitalize text-muted-foreground">{signer.status}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {doc.signerRoles.length > 3 && (
              <div className="h-6 w-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-400">
                +{doc.signerRoles.length - 3}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showPacketBuilder, setShowPacketBuilder] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | 'all'>('all');
  const [filterDocType, setFilterDocType] = useState<Document['docType'] | 'all'>('all');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['fld-1', 'fld-7']);
  // Live documents from /api/documents. Per user directive Q4 ("only real,
  // scraped data"), the Phase 6 fallback to seed-data has been removed: when
  // the API returns an empty list, the UI renders a real <EmptyState/> instead
  // of fabricated documents. `null` = not yet fetched, `[]` = fetched empty.
  const [liveDocuments, setLiveDocuments] = useState<Document[] | null>(null);
  const [newPacket, setNewPacket] = useState<Partial<Packet>>({
    packetType: 'Acquisition',
    status: 'draft',
    packetItems: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch live documents on mount. Always trusts the API response, including
  // the empty-array case. No more silent seed-data fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/documents', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setLiveDocuments([]);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setLiveDocuments(
          Array.isArray(json.documents) ? (json.documents as Document[]) : [],
        );
      } catch {
        // Network error — render an empty state, never fabricated documents.
        if (!cancelled) setLiveDocuments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // documentsSource = live whenever defined (even empty). Never seed.
  const documentsSource: Document[] = liveDocuments ?? [];

  const isLeadExports = filterFolder === LEAD_EXPORTS_FOLDER_ID;

  // Filter documents
  const filterDocuments = () => {
    return documentsSource.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.relatedName && doc.relatedName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      const matchesType = filterDocType === 'all' || doc.docType === filterDocType;
      const matchesFolder = filterFolder === 'all' || doc.folderId === filterFolder;

      return matchesSearch && matchesStatus && matchesType && matchesFolder;
    });
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  // Folder badge counts must reflect the LIVE document list, not the seed file.
  // Without this, an empty database still rendered "Awaiting Signature 2",
  // "Drafts 2", "NDAs 1", "Lead Exports 5" — pulled from the seed array.
  const liveDocCountByFolder = (folderId: string) =>
    documentsSource.filter((d) => d.folderId === folderId).length;

  // Cleanup D4: derive the visible folder list from the LIVE document set.
  // Before this, the sidebar always rendered the hardcoded seed tree
  // (DEAL-001, DEAL-002, NDAs, Templates, Archive, Lead Exports) even when
  // zero real documents existed — the badge counts were 0 but the folder
  // chrome itself was fake. Now: a folder is only included if at least one
  // live document references it (or one of its descendants does, so nesting
  // remains intact). Seed-data is used purely as a metadata lookup
  // (name / parentFolderId) — never as the source of truth for existence.
  const visibleFolderIds = (() => {
    const directIds = new Set(
      documentsSource
        .map((d) => d.folderId)
        .filter((id): id is string => Boolean(id))
    );
    const all = new Set<string>(directIds);
    // Walk each direct folder up its parent chain so ancestors render too.
    for (const id of directIds) {
      let cursor: string | undefined = id;
      while (cursor) {
        const node = documentsSeedData.folders.find((f) => f.id === cursor);
        if (!node) break;
        all.add(node.id);
        cursor = node.parentFolderId;
      }
    }
    return all;
  })();

  // Render folder tree (live-derived)
  const renderFolderTree = (parentId?: string, level = 0) => {
    const folders = documentsSeedData.folders.filter(
      (f) => f.parentFolderId === parentId && visibleFolderIds.has(f.id)
    );

    return folders.map(folder => {
      const hasChildren = documentsSeedData.folders.some(f => f.parentFolderId === folder.id);
      const isExpanded = expandedFolders.includes(folder.id);
      const isSelected = selectedFolder?.id === folder.id;
      const docCount = liveDocCountByFolder(folder.id);

      return (
        <div key={folder.id}>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              isSelected && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => {
              setSelectedFolder(folder);
              setFilterFolder(folder.id);
              if (hasChildren) toggleFolder(folder.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )
            ) : (
              <div className="w-3.5 shrink-0" />
            )}
            <FolderOpen className={cn(
              "h-4 w-4 shrink-0",
              isSelected ? "text-blue-500" : "text-muted-foreground"
            )} />
            <span className="flex-1 text-sm truncate">{folder.name}</span>
            {docCount > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {docCount}
              </span>
            )}
          </div>
          {hasChildren && isExpanded && renderFolderTree(folder.id, level + 1)}
        </div>
      );
    });
  };

  // ---- Document actions wired to /api/documents ---------------------------
  // Phase 6 — Send / Download / Use Template / Generate Packet stay as toasts
  // ("Coming soon") because email, file storage, the template library, and the
  // packet builder are all deferred. Void, Duplicate, Edit, Archive, and Resend
  // hit real endpoints (or move the user into a real editing context).
  //
  // After any mutation, we refresh from /api/documents so the table reflects
  // the new server state without a full page reload.

  const refetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setLiveDocuments(
        Array.isArray(json.documents) ? (json.documents as Document[]) : [],
      );
    } catch {
      // ignore
    }
  };

  // Tracks per-document "sending" state so the Send button can't double-fire
  // while the DocuSign envelope POST is in flight.
  const [sendingDocIds, setSendingDocIds] = useState<string[]>([]);

  const handleSendDocument = async (doc: Document) => {
    if (sendingDocIds.includes(doc.id)) return;
    setSendingDocIds((prev) => [...prev, doc.id]);
    try {
      const res = await fetch(`/api/documents/${doc.id}/envelope`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Could not send for signing",
          description: json?.error || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Sent for signing",
        description: json?.signerEmail
          ? `${doc.title} sent to ${json.signerEmail} via DocuSign.`
          : `${doc.title} sent via DocuSign.`,
      });
      await refetchDocuments();
    } catch (e) {
      toast({
        title: "Could not send for signing",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
    } finally {
      setSendingDocIds((prev) => prev.filter((id) => id !== doc.id));
    }
  };

  const handleDownloadDocument = (doc: Document) => {
    // Deferred: no file storage (S3 / Vercel Blob) configured yet.
    toast({
      title: "Coming soon",
      description: `Downloads aren't wired up yet — ${doc.title} has no stored file.`,
    });
  };

  const handleVoidDocument = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/void`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could not void document",
          description: err?.error || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Document voided",
        description: `${doc.title} has been voided.`,
        variant: "destructive",
      });
      await refetchDocuments();
    } catch (e) {
      toast({
        title: "Could not void document",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
    }
  };

  const handleNewVersion = (doc: Document) => {
    // Deferred: version-bump endpoint will land with template library.
    setSelectedDocument(doc);
    toast({
      title: "Coming soon",
      description: `Version bump isn't wired up yet — opening ${doc.title} as-is.`,
    });
  };

  const handleEditDocument = (doc: Document) => {
    // Edit = open the document viewer / details sheet. Inline field edits go
    // through PATCH /api/documents/[id] from inside the sheet (next phase).
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  };

  const handleDuplicateDocument = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could not duplicate",
          description: err?.error || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Document duplicated",
        description: `Created copy of ${doc.title}`,
      });
      await refetchDocuments();
    } catch (e) {
      toast({
        title: "Could not duplicate",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
    }
  };

  const handleArchiveDocument = async (doc: Document) => {
    // Archive == move to the Archive folder (fld-10) via PATCH.
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: 'fld-10' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could not archive",
          description: err?.error || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Document archived",
        description: `${doc.title} has been archived.`,
      });
      await refetchDocuments();
    } catch (e) {
      toast({
        title: "Could not archive",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
    }
  };

  const handleResendDocument = (doc: Document) => {
    // Deferred: depends on email provider.
    toast({
      title: "Coming soon",
      description: `Reminder emails aren't wired up yet — ${doc.title}.`,
    });
  };

  const handleViewDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  };

  const handleUseTemplate = (template: DocumentTemplate) => {
    // Deferred: template library / merge engine.
    toast({
      title: "Coming soon",
      description: `Templates aren't wired up yet — ${template.name}.`,
    });
    setShowTemplateLibrary(false);
  };

  const handleGeneratePacket = () => {
    // Deferred: packet builder.
    toast({
      title: "Coming soon",
      description: "Packet generation isn't wired up yet.",
    });
    setShowPacketBuilder(false);
  };

  const handleDeleteDocument = async (doc: Document) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Could not delete",
          description: err?.error || `Server returned ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Document deleted",
        description: `${doc.title} has been permanently removed.`,
        variant: "destructive",
      });
      await refetchDocuments();
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Network error",
        variant: "destructive",
      });
    }
  };

  // Metrics are now derived from `documentsSource` (the live array) instead of
  // the seed data — otherwise the sidebar Quick Access counts and the top
  // StatChip row continued to display the fabricated seed-document totals even
  // when no real documents existed.
  const metrics = (() => {
    const total = documentsSource.length;
    const byStatus = {
      draft: documentsSource.filter((d) => d.status === 'draft').length,
      sent: documentsSource.filter((d) => d.status === 'sent').length,
      signed: documentsSource.filter((d) => d.status === 'signed').length,
      expired: documentsSource.filter((d) => d.status === 'expired').length,
      void: documentsSource.filter((d) => d.status === 'void').length,
    };
    const signingDurations = documentsSource
      .filter((d) => d.signedAt && d.createdAt)
      .map(
        (d) =>
          (new Date(d.signedAt as unknown as string).getTime() -
            new Date(d.createdAt as unknown as string).getTime()) /
          (1000 * 60 * 60),
      );
    const avgSigningTimeHours = signingDurations.length
      ? Math.round(
          signingDurations.reduce((a, b) => a + b, 0) / signingDurations.length,
        )
      : 0;
    const templatesActive = documentsSeedData.templates.filter(
      (t) => t.isActive,
    ).length;
    return { total, byStatus, avgSigningTimeHours, templatesActive };
  })();

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span>Loading documents...</span>
        </div>
      </div>
    );
  }

  const filteredDocuments = filterDocuments();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 min-h-0 flex gap-3 p-3">
        {/* Left Sidebar - Folders */}
        <div className="w-56 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {/* New Document Button */}
          {!isLeadExports && (
            <div className="shrink-0 p-2 border-b">
              <Button
                className="w-full h-8 gap-2"
                size="sm"
                onClick={() => setShowTemplateLibrary(true)}
              >
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </div>
          )}

          {/* Quick Access */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1">
              {!isLeadExports && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Access
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                      "hover:bg-gray-100 dark:hover:bg-gray-800",
                      filterStatus === 'sent' && "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    )}
                    onClick={() => {
                      setFilterStatus('sent');
                      setFilterFolder('all');
                      setSelectedFolder(null);
                    }}
                  >
                    <Send className="h-4 w-4" />
                    <span className="flex-1 text-sm">Awaiting Signature</span>
                    <span className="text-xs tabular-nums text-muted-foreground bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
                      {metrics.byStatus.sent}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                      "hover:bg-gray-100 dark:hover:bg-gray-800",
                      filterStatus === 'draft' && "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    )}
                    onClick={() => {
                      setFilterStatus('draft');
                      setFilterFolder('all');
                      setSelectedFolder(null);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="flex-1 text-sm">Drafts</span>
                    <span className="text-xs tabular-nums text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                      {metrics.byStatus.draft}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setShowPacketBuilder(true)}
                  >
                    <Package className="h-4 w-4" />
                    <span className="flex-1 text-sm">Create Packet</span>
                  </div>

                  <Separator className="my-2" />
                </>
              )}

              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Folders
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  filterFolder === 'all' && !selectedFolder && "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                )}
                onClick={() => {
                  setFilterFolder('all');
                  setSelectedFolder(null);
                  setFilterStatus('all');
                }}
              >
                <Home className="h-4 w-4" />
                <span className="flex-1 text-sm">All Documents</span>
                <span className="text-xs tabular-nums text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  {documentsSource.length}
                </span>
              </div>
              {/* Cleanup D4: when no live documents reference any folder,
                  show a muted empty-state hint instead of the phantom
                  hardcoded tree (DEAL-001 / DEAL-002 / NDAs / Templates /
                  Archive / Lead Exports). Real folders appear here as soon
                  as a real document is filed against one. */}
              {visibleFolderIds.size === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground italic">
                  Folders appear here as you create documents.
                </div>
              ) : (
                renderFolderTree()
              )}
            </div>
          </ScrollArea>

          {/* Storage indicator — real-data only.
              Previously hard-coded to "6.5/10 GB" (65%) regardless of state.
              With no file storage backend wired up yet, the only honest value
              is 0 GB used. Hidden entirely until at least one document exists. */}
          {documentsSource.length > 0 && (
            <div className="shrink-0 p-3 border-t bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Storage</span>
                <span className="tabular-nums">0 / 10 GB</span>
              </div>
              <Progress value={0} className="h-1" />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {/* Header */}
          <div className="shrink-0 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold">{isLeadExports ? 'Lead Exports' : 'Documents'}</h1>
                <p className="text-xs text-muted-foreground">
                  {isLeadExports ? 'CSV exports from the Leads tab' : 'Manage contracts, agreements, and legal documents'}
                </p>
              </div>

              {!isLeadExports && (
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowTemplateLibrary(true)}>
                          <Layers className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Template Library</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowPacketBuilder(true)}>
                          <Package className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Packet Builder</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* View mode toggle */}
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-r-none h-8 px-2.5"
                      onClick={() => setViewMode('table')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-none border-x h-8 px-2.5"
                      onClick={() => setViewMode('kanban')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'packets' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-l-none h-8 px-2.5"
                      onClick={() => setViewMode('packets')}
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Metrics bar - horizontal StatChip pattern */}
            {!isLeadExports && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                <StatChip icon={FileText} label="total" value={metrics.total} color="gray" />
                <StatChip icon={Send} label="awaiting" value={metrics.byStatus.sent} color="blue" />
                <StatChip icon={CheckCircle} label="signed" value={metrics.byStatus.signed} color="emerald" />
                <StatChip icon={Clock} label="avg time" value={`${metrics.avgSigningTimeHours}h`} color="purple" />
                <StatChip icon={Layers} label="templates available" value={metrics.templatesActive} color="amber" variant="platform" />
              </div>
            )}
          </div>

          {/* Filters toolbar */}
          <div className="shrink-0 px-4 py-2 border-b bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {!isLeadExports && <Select value={filterStatus} onValueChange={(value: DocumentStatus | 'all') => setFilterStatus(value)}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>}

              {!isLeadExports && <Select value={filterDocType} onValueChange={(value: Document['docType'] | 'all') => setFilterDocType(value)}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="LOI">LOI</SelectItem>
                  <SelectItem value="PSA">PSA</SelectItem>
                  <SelectItem value="JV">JV Agreement</SelectItem>
                  <SelectItem value="Assignment">Assignment</SelectItem>
                  <SelectItem value="NDA">NDA</SelectItem>
                  <SelectItem value="Addendum">Addendum</SelectItem>
                </SelectContent>
              </Select>}

              {selectedDocuments.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Badge variant="secondary" className="tabular-nums">
                    {selectedDocuments.length} selected
                  </Badge>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedDocuments([])}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {documentsSource.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-10 w-10" />}
                    title="No documents yet"
                    description="Documents you generate (LOIs, contracts, NDAs) will appear here."
                    actionLabel="New Document"
                    onAction={() => setShowTemplateLibrary(true)}
                  />
                ) : viewMode === 'table' && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedDocuments.length === filteredDocuments.length && filteredDocuments.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDocuments(filteredDocuments.map(d => d.id));
                              } else {
                                setSelectedDocuments([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Document</TableHead>
                        {!isLeadExports && <TableHead className="w-24">Type</TableHead>}
                        {!isLeadExports && <TableHead className="w-28">Status</TableHead>}
                        {!isLeadExports && <TableHead>Related To</TableHead>}
                        <TableHead className="w-28">{isLeadExports ? 'Status' : 'Created'}</TableHead>
                        {!isLeadExports && <TableHead className="w-28">Signers</TableHead>}
                        <TableHead className="w-12 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map(doc => {
                        const config = statusConfig[doc.status];
                        const StatusIcon = config.icon;
                        const TypeIcon = docTypeIcons[doc.docType];

                        return (
                          <TableRow
                            key={doc.id}
                            className="group cursor-pointer"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowDocumentViewer(true);
                            }}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedDocuments.includes(doc.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDocuments([...selectedDocuments, doc.id]);
                                  } else {
                                    setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={cn("p-1.5 rounded-md shrink-0", config.bgColor)}>
                                  <TypeIcon className={cn("h-4 w-4", config.color)} />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {doc.title}
                                  </div>
                                  {doc.tags.length > 0 && (
                                    <div className="flex gap-1 mt-0.5">
                                      {doc.tags.slice(0, 2).map(tag => (
                                        <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {doc.tags.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          +{doc.tags.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            {!isLeadExports && (
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {doc.docType}
                                </Badge>
                              </TableCell>
                            )}
                            {!isLeadExports && (
                              <TableCell>
                                <Badge className={cn("gap-1", config.bgColor, config.color)}>
                                  <StatusIcon className="h-3 w-3" />
                                  <span className="capitalize">{doc.status}</span>
                                </Badge>
                              </TableCell>
                            )}
                            {!isLeadExports && (
                              <TableCell>
                                {doc.relatedName && (
                                  <div className="text-sm">
                                    <div className="font-medium truncate max-w-[135px]">{doc.relatedName}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{doc.relatedEntity}</div>
                                  </div>
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              {isLeadExports ? (() => {
                                const exportStatus = doc.tags.includes('export-initiated') ? 'initiated'
                                  : doc.tags.includes('export-pending') ? 'pending'
                                  : 'exported';
                                const pill = {
                                  initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
                                  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
                                  exported: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
                                }[exportStatus];
                                return (
                                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize", pill)}>
                                    {exportStatus}
                                  </span>
                                );
                              })() : (
                                <div className="text-sm">
                                  <div className="tabular-nums">{new Date(doc.createdAt).toLocaleDateString()}</div>
                                  <div className="text-xs text-muted-foreground">v{doc.version}</div>
                                </div>
                              )}
                            </TableCell>
                            {!isLeadExports && (
                              <TableCell>
                                {doc.signerRoles.length > 0 && (
                                  <div className="flex -space-x-2">
                                    {doc.signerRoles.slice(0, 3).map((signer, idx) => (
                                      <TooltipProvider key={idx}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Avatar className="h-7 w-7 border-2 border-white dark:border-gray-900">
                                              <AvatarFallback
                                                className={cn(
                                                  "text-xs",
                                                  signer.status === 'signed' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50",
                                                  signer.status === 'sent' && "bg-blue-100 text-blue-700 dark:bg-blue-900/50",
                                                  signer.status === 'viewed' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50",
                                                  signer.status === 'pending' && "bg-gray-100 text-gray-700 dark:bg-gray-800"
                                                )}
                                              >
                                                {signer.role[0]}
                                              </AvatarFallback>
                                            </Avatar>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs">
                                              <div className="font-medium">{signer.role}</div>
                                              {signer.name && <div>{signer.name}</div>}
                                              <div className="capitalize text-muted-foreground">{signer.status}</div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                    {doc.signerRoles.length > 3 && (
                                      <Avatar className="h-7 w-7 border-2 border-white dark:border-gray-900">
                                        <AvatarFallback className="text-xs bg-gray-100 dark:bg-gray-800">
                                          +{doc.signerRoles.length - 3}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedDocument(doc);
                                    setShowDocumentViewer(true);
                                  }}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  {doc.status === 'draft' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleEditDocument(doc)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleSendDocument(doc)}>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {doc.status === 'sent' && (
                                    <DropdownMenuItem onClick={() => handleResendDocument(doc)}>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Resend
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleDownloadDocument(doc)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleNewVersion(doc)}>
                                    <GitBranch className="h-4 w-4 mr-2" />
                                    New Version
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDuplicateDocument(doc)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleArchiveDocument(doc)}>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  {doc.status !== 'void' && (
                                    <DropdownMenuItem
                                      className="text-red-600 dark:text-red-400"
                                      onClick={() => handleVoidDocument(doc)}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Void
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400"
                                    onClick={() => handleDeleteDocument(doc)}
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
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
                )}

                {viewMode === 'kanban' && (
                  <div className="grid grid-cols-5 gap-4">
                    {(['draft', 'sent', 'signed', 'expired', 'void'] as DocumentStatus[]).map(status => {
                      const config = statusConfig[status];
                      const docsInStatus = filteredDocuments.filter(d => d.status === status);

                      return (
                        <div key={status} className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 mb-3 px-1">
                            <div className={cn("h-2 w-2 rounded-full bg-gradient-to-r", config.gradient)} />
                            <h3 className="text-sm font-medium capitalize">{status}</h3>
                            <span className="text-xs tabular-nums text-muted-foreground ml-auto">
                              {docsInStatus.length}
                            </span>
                          </div>
                          <div className="space-y-2 min-h-[180px]">
                            {docsInStatus.map(doc => (
                              <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onClick={() => handleViewDocument(doc)}
                                onView={() => handleViewDocument(doc)}
                                onDownload={() => handleDownloadDocument(doc)}
                                onSend={() => handleSendDocument(doc)}
                              />
                            ))}
                            {docsInStatus.length === 0 && (
                              <div className="h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                                No documents
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {viewMode === 'packets' && (
                  <div className="space-y-3">
                    {documentsSeedData.packets.map(packet => {
                      const config = statusConfig[packet.status as DocumentStatus] || statusConfig.draft;

                      return (
                        <Card key={packet.id} className="overflow-hidden">
                          <div className={cn("h-1 w-full bg-gradient-to-r", config.gradient)} />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                                  <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{packet.name}</h3>
                                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                    <Badge variant="outline" className="text-xs">{packet.packetType}</Badge>
                                    <span>{packet.relatedDealName}</span>
                                    <span className="tabular-nums">{new Date(packet.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="mt-3 space-y-1.5">
                                    {packet.packetItems.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-3 text-sm">
                                        <span className="text-xs font-medium text-muted-foreground w-5 tabular-nums">
                                          {item.order}.
                                        </span>
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{item.title}</span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] ml-auto",
                                            item.status === 'signed' && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                                            item.status === 'sent' && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                            item.status === 'pending' && "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                          )}
                                        >
                                          {item.status}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className={cn(config.bgColor, config.color)}>
                                  {packet.status}
                                </Badge>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      Actions
                                      <ChevronDown className="h-4 w-4 ml-2" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900">
                                    <DropdownMenuItem onClick={() => {
                                      toast({
                                        title: "Opening packet",
                                        description: `Viewing ${packet.name}`,
                                      });
                                    }}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Packet
                                    </DropdownMenuItem>
                                    {packet.status === 'draft' && (
                                      <DropdownMenuItem onClick={() => {
                                        toast({
                                          title: "Packet sent",
                                          description: `All documents in ${packet.name} have been sent for signature.`,
                                        });
                                      }}>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send All
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => {
                                      toast({
                                        title: "Download started",
                                        description: `Downloading all documents from ${packet.name}...`,
                                      });
                                    }}>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download All
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => {
                                      toast({
                                        title: "Packet duplicated",
                                        description: `Created copy of ${packet.name}`,
                                      });
                                    }}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicate Packet
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Template Library Dialog */}
      <Dialog open={showTemplateLibrary} onOpenChange={setShowTemplateLibrary}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Template Library</DialogTitle>
            <DialogDescription>
              Choose from ready-to-use templates or create your own
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="acquisition" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-5 shrink-0">
              <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="partnership">Partnership</TabsTrigger>
              <TabsTrigger value="legal">Legal</TabsTrigger>
              <TabsTrigger value="modification">Modification</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-4">
              <TabsContent value="acquisition" className="m-0">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {getTemplatesByCategory('Acquisition').map(template => {
                    const Icon = docTypeIcons[template.docType];
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-blue-500" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                                <Icon className="h-6 w-6 text-blue-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{template.docType}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{template.estimatedPages} pages</span>
                              <span>{template.rolesSchema.length} signers</span>
                            </div>
                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="assignment" className="m-0">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {getTemplatesByCategory('Assignment').map(template => {
                    const Icon = docTypeIcons[template.docType];
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                                <Icon className="h-6 w-6 text-emerald-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{template.docType}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{template.estimatedPages} pages</span>
                              <span>{template.rolesSchema.length} signers</span>
                            </div>
                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="partnership" className="m-0">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {getTemplatesByCategory('Partnership').map(template => {
                    const Icon = docTypeIcons[template.docType];
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-purple-500" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                                <Icon className="h-6 w-6 text-purple-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{template.docType}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{template.estimatedPages} pages</span>
                              <span>{template.rolesSchema.length} signers</span>
                            </div>
                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="legal" className="m-0">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {getTemplatesByCategory('Legal').map(template => {
                    const Icon = docTypeIcons[template.docType];
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                                <Icon className="h-6 w-6 text-amber-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{template.docType}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{template.estimatedPages} pages</span>
                              <span>{template.rolesSchema.length} signers</span>
                            </div>
                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="modification" className="m-0">
                <div className="grid grid-cols-2 gap-4 p-1">
                  {getTemplatesByCategory('Modification').map(template => {
                    const Icon = docTypeIcons[template.docType];
                    return (
                      <Card
                        key={template.id}
                        className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden group"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-rose-400 to-rose-500" />
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30">
                                <Icon className="h-6 w-6 text-rose-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{template.docType}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">v{template.version}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{template.estimatedPages} pages</span>
                              <span>{template.rolesSchema.length} signers</span>
                            </div>
                            <Button size="sm" onClick={() => handleUseTemplate(template)}>
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Sheet */}
      <Sheet open={showDocumentViewer} onOpenChange={setShowDocumentViewer}>
        <SheetContent className="w-[486px] sm:max-w-[486px] bg-white dark:bg-gray-900 p-0 flex flex-col">
          <VisuallyHidden.Root>
            <SheetTitle>Document Details</SheetTitle>
          </VisuallyHidden.Root>

          {selectedDocument && (
            <>
              {/* Status gradient header */}
              <div className={cn(
                "h-1.5 w-full bg-gradient-to-r shrink-0",
                statusConfig[selectedDocument.status].gradient
              )} />

              <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <SheetTitle className="text-lg">{selectedDocument.title}</SheetTitle>
                    <SheetDescription>
                      Version {selectedDocument.version} • {selectedDocument.docType}
                    </SheetDescription>
                  </div>
                  <Badge className={cn(
                    "gap-1",
                    statusConfig[selectedDocument.status].bgColor,
                    statusConfig[selectedDocument.status].color
                  )}>
                    {(() => {
                      const Icon = statusConfig[selectedDocument.status].icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    <span className="capitalize">{selectedDocument.status}</span>
                  </Badge>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownloadDocument(selectedDocument)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {selectedDocument.status === 'draft' && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSendDocument(selectedDocument)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send for Signature
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 min-h-0 overflow-hidden">
                <Tabs defaultValue="details" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-4 px-6 pt-3 shrink-0">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="signers">Signers</TabsTrigger>
                    <TabsTrigger value="versions">Versions</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                  </TabsList>

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-4">
                      <TabsContent value="details" className="m-0 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Related To</Label>
                            <div className="mt-1 font-medium">
                              {selectedDocument.relatedName || 'Not linked'}
                              {selectedDocument.relatedEntity && (
                                <Badge variant="outline" className="ml-2 text-xs capitalize">
                                  {selectedDocument.relatedEntity}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Created By</Label>
                            <div className="mt-1 font-medium">{selectedDocument.createdByUserName}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Created On</Label>
                            <div className="mt-1 font-medium tabular-nums">
                              {new Date(selectedDocument.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {selectedDocument.signedAt && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Signed On</Label>
                              <div className="mt-1 font-medium tabular-nums">
                                {new Date(selectedDocument.signedAt).toLocaleString()}
                              </div>
                            </div>
                          )}
                          {selectedDocument.expiresAt && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Expires On</Label>
                              <div className="mt-1 font-medium tabular-nums">
                                {new Date(selectedDocument.expiresAt).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tags</Label>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {selectedDocument.tags.map(tag => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="signers" className="m-0 space-y-3">
                        {selectedDocument.signerRoles.map((signer, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className={cn(
                                  signer.status === 'signed' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50",
                                  signer.status === 'sent' && "bg-blue-100 text-blue-700 dark:bg-blue-900/50",
                                  signer.status === 'viewed' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50",
                                  signer.status === 'pending' && "bg-gray-100 text-gray-700 dark:bg-gray-800"
                                )}>
                                  {signer.role[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{signer.role}</div>
                                <div className="text-sm text-muted-foreground">
                                  {signer.name || signer.email || 'Not assigned'}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                signer.status === 'signed' && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                                signer.status === 'sent' && "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                signer.status === 'viewed' && "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              )}
                            >
                              {signer.status}
                            </Badge>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="versions" className="m-0 space-y-3">
                        {getDocumentVersions(selectedDocument.id).map(version => (
                          <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">Version {version.version}</div>
                              <div className="text-sm text-muted-foreground">{version.changeLog}</div>
                              <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                                {new Date(version.createdAt).toLocaleString()} by {version.createdByUserName}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Viewing version",
                                  description: `Opening version ${version.version}`,
                                });
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        ))}
                        {getDocumentVersions(selectedDocument.id).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No version history available</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="audit" className="m-0">
                        <div className="space-y-3">
                          {selectedDocument.auditLog.map((event, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="shrink-0">
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center",
                                  event.action === 'created' && "bg-blue-100 dark:bg-blue-900/30",
                                  event.action === 'sent' && "bg-purple-100 dark:bg-purple-900/30",
                                  event.action === 'viewed' && "bg-amber-100 dark:bg-amber-900/30",
                                  event.action === 'signed' && "bg-emerald-100 dark:bg-emerald-900/30",
                                  event.action === 'updated' && "bg-gray-100 dark:bg-gray-800"
                                )}>
                                  {event.action === 'created' && <FilePlus className="h-4 w-4 text-blue-600" />}
                                  {event.action === 'sent' && <Send className="h-4 w-4 text-purple-600" />}
                                  {event.action === 'viewed' && <Eye className="h-4 w-4 text-amber-600" />}
                                  {event.action === 'signed' && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                                  {event.action === 'updated' && <Edit className="h-4 w-4 text-gray-600" />}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{event.userName}</div>
                                <div className="text-sm text-muted-foreground">{event.details || event.action}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  {new Date(event.timestamp).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </div>
                  </ScrollArea>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Packet Builder Dialog */}
      <Dialog open={showPacketBuilder} onOpenChange={setShowPacketBuilder}>
        <DialogContent className="max-w-2xl bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Packet Builder</DialogTitle>
            <DialogDescription>
              Create a bundle of documents for your deal
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Packet Type</Label>
              <Select
                value={newPacket.packetType}
                onValueChange={(value: Packet['packetType']) =>
                  setNewPacket({ ...newPacket, packetType: value })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900">
                  <SelectItem value="Acquisition">Acquisition Packet</SelectItem>
                  <SelectItem value="Assignment">Assignment Packet</SelectItem>
                  <SelectItem value="Disposition">Disposition Packet</SelectItem>
                  <SelectItem value="JV">JV Packet</SelectItem>
                  <SelectItem value="Custom">Custom Packet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Packet Name</Label>
              <Input
                placeholder="Enter packet name"
                value={newPacket.name || ''}
                onChange={(e) => setNewPacket({ ...newPacket, name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Related Deal</Label>
              <Select>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a deal" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900">
                  <SelectItem value="DEAL-001">123 Main St, Phoenix</SelectItem>
                  <SelectItem value="DEAL-002">456 Desert View, Scottsdale</SelectItem>
                  <SelectItem value="DEAL-003">789 University Dr, Tempe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Documents</Label>
              <div className="mt-2 space-y-2 border rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/50">
                {newPacket.packetType === 'Acquisition' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                      <div className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">LOI - Letter of Intent</span>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm">PSA - Purchase Agreement</span>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">NDA - Non-Disclosure</span>
                      </div>
                      <Checkbox />
                    </div>
                  </>
                )}
                {newPacket.packetType === 'Assignment' && (
                  <>
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm">Assignment Agreement</span>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Notice to Seller</span>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                  </>
                )}
                {!['Acquisition', 'Assignment'].includes(newPacket.packetType || '') && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Select a packet type to see available documents
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPacketBuilder(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePacket}>
              Generate Packet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
