"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Phone, Bot, Plug, History, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlipPhone } from "@/components/dialer/flip-phone";
import { Oppenheimer } from "@/components/dialer/oppenheimer";
import { IntegrationsPanel } from "@/components/dialer/integrations-panel";
import { CallHistory } from "@/components/dialer/call-history";

// ---------------------------------------------------------------------------
// Dialer — replaces the old Campaigns page. Four tabs:
//   Flip Phone    — our WebRTC dialer, human-agent outbound
//   Oppenheimer   — AI voice dialer (Telnyx AI + ElevenLabs), consent-gated
//   Integrations  — Mojo, CallTools, smrtPhone, universal webhook
//   History       — unified call log across all sources
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

function DialerInner() {
  const params = useSearchParams();
  const initialTab = params?.get("tab") ?? "flip-phone";
  const [tab, setTab] = useState(initialTab);

  // Sync URL → state when user navigates via links (e.g. from Leads drawer)
  useEffect(() => {
    const t = params?.get("tab");
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="shrink-0 flex flex-col gap-3 border-b border-border bg-card/50 px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Dialer</h1>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                Humans make outbound calls. AI handles inbound + callbacks — never cold outbound.
              </p>
            </div>

            <TabsList className="shrink-0 gap-0.5">
              <TabsTrigger value="flip-phone" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Flip Phone
              </TabsTrigger>
              <TabsTrigger value="oppenheimer" className="gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Oppenheimer
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-1.5">
                <Plug className="h-3.5 w-3.5" />
                Integrations
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Tab content — each manages its own internal layout */}
        <TabsContent value="flip-phone" className="flex-1 min-h-0 mt-0 py-4">
          <FlipPhone />
        </TabsContent>
        <TabsContent value="oppenheimer" className="flex-1 min-h-0 mt-0 py-4">
          <Oppenheimer />
        </TabsContent>
        <TabsContent value="integrations" className="flex-1 min-h-0 mt-0 py-4 overflow-y-auto">
          <IntegrationsPanel />
        </TabsContent>
        <TabsContent value="history" className="flex-1 min-h-0 mt-0 py-4">
          <CallHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DialerPage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <DialerInner />
    </Suspense>
  );
}
