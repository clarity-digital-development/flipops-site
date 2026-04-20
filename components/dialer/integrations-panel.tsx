"use client";

import { useState } from "react";
import {
  Plug,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  ExternalLink,
  Key,
  Activity,
  Zap,
  PhoneCall,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// IntegrationsPanel — three third-party dialer integrations.
// FlipOps pushes selected leads out and pulls call logs + dispositions back
// via webhooks. CallTools is already webhook-connected; Mojo and smrtPhone
// ship once the user provides credentials.
// ---------------------------------------------------------------------------

type ConnectionStatus = "connected" | "ready" | "not_configured";

interface Integration {
  id: "mojo" | "calltools" | "smrtphone";
  name: string;
  tagline: string;
  type: string;
  status: ConnectionStatus;
  accent: string;
  features: string[];
  syncedToday?: {
    pushed: number;
    callsReceived: number;
    dispositions: number;
  };
  url: string;
  inboundWebhook?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "mojo",
    name: "Mojo Dialer",
    tagline: "Triple-line power dialer — best for hammering through a large list",
    type: "Power dialer · up to 3 concurrent lines",
    status: "not_configured",
    accent: "from-orange-500 to-red-500",
    features: [
      "Push leads to Mojo call list via API",
      "Pull dispositions + call recordings back",
      "Agent assignment per list",
    ],
    url: "https://www.mojosells.com",
  },
  {
    id: "calltools",
    name: "CallTools",
    tagline: "Predictive dialer with CRM sync — already webhook-wired",
    type: "Predictive dialer",
    status: "connected",
    accent: "from-blue-500 to-cyan-500",
    features: [
      "Webhook receiver at /api/webhooks/calltools (live)",
      "Auto-match caller → Property in DB",
      "Disposition → outreachStatus mapping + follow-up task creation",
    ],
    syncedToday: { pushed: 124, callsReceived: 88, dispositions: 72 },
    url: "https://calltools.com",
    inboundWebhook: "/api/webhooks/calltools",
  },
  {
    id: "smrtphone",
    name: "smrtPhone",
    tagline: "SMS + dialer hybrid, popular with wholesalers",
    type: "Softphone + SMS · multi-line",
    status: "not_configured",
    accent: "from-violet-500 to-fuchsia-500",
    features: [
      "Push leads to smrtPhone campaign",
      "Inbound SMS replies → FlipOps Inbox thread",
      "Call recordings linked back to Property",
    ],
    url: "https://smrtphone.io",
  },
];

export function IntegrationsPanel() {
  const [connecting, setConnecting] = useState<Integration | null>(null);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integ) => (
            <IntegrationCard
              key={integ.id}
              integ={integ}
              onConnect={() => setConnecting(integ)}
            />
          ))}

          {/* Empty slot — user mentioned a potential fourth dialer */}
          <Card className="p-0 gap-0 overflow-hidden border-dashed">
            <div className="px-5 py-4 flex flex-col items-center justify-center text-center h-full min-h-[220px] gap-2">
              <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
                <Plug className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Add another dialer</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Batch Dialer, PhoneBurner, Kixie, or a custom webhook-based integration.
              </p>
              <Button variant="outline" size="sm" className="mt-1">
                Request integration
              </Button>
            </div>
          </Card>
        </div>

        {/* Universal webhook section */}
        <Card className="mt-4 p-0 gap-0 overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              Universal webhook (generic receiver)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              For any dialer that can POST call events. Match payload fields to FlipOps disposition vocabulary in Settings → Integrations.
            </p>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="flex-1 font-mono text-xs bg-muted/50 rounded-md px-3 py-2 border border-border truncate">
              POST https://flipops.io/api/webhooks/dialer (coming)
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Key className="h-3.5 w-3.5" />
              Copy API key
            </Button>
          </div>
        </Card>
      </div>

      {/* Connect dialog */}
      <Dialog open={!!connecting} onOpenChange={(open) => !open && setConnecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect {connecting?.name}</DialogTitle>
            <DialogDescription>
              Paste the API credentials — we'll verify and flip the status to
              Connected. Keys are stored encrypted server-side.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="api-key" className="text-xs">
                API key
              </Label>
              <Input id="api-key" type="password" placeholder="••••••••••••" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-id" className="text-xs">
                Account / workspace ID
              </Label>
              <Input id="account-id" placeholder="e.g. acct_1a2b3c" className="h-9" />
            </div>
            <div className="rounded-md border border-amber-200/60 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                You're responsible for ensuring lists pushed to {connecting?.name} respect DNC and TCPA rules. FlipOps passes the consent flag with every lead; {connecting?.name} decides whether to dial.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConnecting(null)}>
              Cancel
            </Button>
            <Button>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IntegrationCard({
  integ,
  onConnect,
}: {
  integ: Integration;
  onConnect: () => void;
}) {
  return (
    <Card className="p-0 gap-0 overflow-hidden flex flex-col">
      <div className={cn("h-1 w-full bg-gradient-to-r", integ.accent)} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold truncate">{integ.name}</h3>
              <StatusPill status={integ.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{integ.type}</p>
          </div>
          <a
            href={integ.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Open vendor site"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {integ.tagline}
        </p>

        <ul className="space-y-1.5 flex-1">
          {integ.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs">
              <Circle className="h-1.5 w-1.5 mt-1.5 shrink-0 fill-muted-foreground text-muted-foreground" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>

        {integ.syncedToday && (
          <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
            <div>
              <div className="text-sm font-semibold tabular-nums">
                {integ.syncedToday.pushed}
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Pushed
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold tabular-nums">
                {integ.syncedToday.callsReceived}
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Calls
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold tabular-nums">
                {integ.syncedToday.dispositions}
              </div>
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Dispos
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          {integ.status === "connected" ? (
            <>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                Push leads
              </Button>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs">
                <Activity className="h-3 w-3" />
                Logs
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect} className="w-full gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const map = {
    connected: {
      label: "Connected",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
      icon: CheckCircle2,
    },
    ready: {
      label: "Ready",
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
      icon: MessageSquare,
    },
    not_configured: {
      label: "Not connected",
      className:
        "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/60 dark:text-gray-400 dark:border-gray-700",
      icon: Circle,
    },
  } as const;
  const meta = map[status];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] gap-1 font-medium", meta.className)}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </Badge>
  );
}
