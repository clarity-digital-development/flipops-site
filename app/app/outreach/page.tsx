"use client";
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { MessageSquare, Phone, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OutreachChannel {
  href: string;
  title: string;
  description: string;
  icon: typeof MessageSquare;
  iconColor: string;
  iconBg: string;
  accentBar: string;
  hoverBorder: string;
}

const CHANNELS: OutreachChannel[] = [
  {
    href: "/app/inbox",
    title: "Inbox",
    description:
      "Unified thread view for SMS, email, and dialer voicemails. Read, reply, and triage every conversation with a lead in one place.",
    icon: MessageSquare,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
    accentBar: "bg-gradient-to-r from-blue-500 to-cyan-500",
    hoverBorder: "hover:border-blue-300 dark:hover:border-blue-500/50",
  },
  {
    href: "/app/dialer",
    title: "Dialer",
    description:
      "Telnyx-powered outbound calling with Oppenheimer AI handling inbound. Queue leads, log contacts, and drop voicemails without leaving the app.",
    icon: Phone,
    iconColor: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-50 dark:bg-purple-500/10",
    accentBar: "bg-gradient-to-r from-purple-500 to-fuchsia-500",
    hoverBorder: "hover:border-purple-300 dark:hover:border-purple-500/50",
  },
];

export default function OutreachHubPage() {
  return (
    <div className="h-full flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg bg-card overflow-hidden">
      {/* Header — matches Tasks gold-standard shape */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Outreach
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Reach every lead, every channel. Pick a surface to start working.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/app/inbox">
                <Send className="h-4 w-4 mr-2" />
                Open Inbox
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Channel grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <Link
                key={channel.href}
                href={channel.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
              >
                <Card
                  className={cn(
                    "relative overflow-hidden border-zinc-200 dark:border-zinc-800 transition-all duration-200",
                    "hover:shadow-lg hover:-translate-y-0.5",
                    channel.hoverBorder
                  )}
                >
                  {/* Top accent bar */}
                  <div className={cn("absolute top-0 inset-x-0 h-1", channel.accentBar)} />

                  <CardHeader className="flex flex-row items-start gap-4 pt-7">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                        channel.iconBg
                      )}
                    >
                      <Icon className={cn("h-6 w-6", channel.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl tracking-tight">{channel.title}</CardTitle>
                      <CardDescription className="mt-1">{channel.description}</CardDescription>
                    </div>
                    <ArrowRight
                      className="h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground"
                    />
                  </CardHeader>

                  <CardContent>
                    <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Open {channel.title}
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
