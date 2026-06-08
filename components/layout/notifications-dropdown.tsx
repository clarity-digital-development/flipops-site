"use client";
import * as React from "react";
import { Bell, Check, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; type: string; createdAt: string; readAt: string | null };

function rel(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

export function NotificationsDropdown() {
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications/me", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) { setUnread(0); setItems([]); return; }
      const d = await r.json();
      setUnread(d.unread ?? 0);
      setItems(Array.isArray(d.notifications) ? d.notifications : []);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { if (open) void load(); }, [open, load]);

  const markAll = React.useCallback(async () => {
    const r = await fetch("/api/notifications/me", { method: "PATCH", credentials: "same-origin" });
    if (r.ok) { setUnread(0); setItems((xs) => xs.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))); }
  }, []);

  const has = unread > 0;
  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {has && <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{badge}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications{has ? " (" + unread + ")" : ""}</span>
          <button type="button" onClick={markAll} disabled={!has} className={cn("inline-flex items-center gap-1 text-xs font-medium", has ? "text-blue-600" : "text-gray-400")}><Check className="h-3 w-3" />Mark all read</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 ? <div className="px-4 py-8 text-center text-xs text-gray-500">Loading...</div>
           : items.length === 0 ? (
             <div className="px-4 py-10 text-center"><Inbox className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-sm font-medium">You are all caught up</p><p className="mt-1 text-xs text-gray-500">New activity will show up here.</p></div>
           ) : (
             <ul className="divide-y">{items.map((n) => { const u = n.readAt === null; return (
               <li key={n.id} className={cn("px-4 py-3", u && "bg-blue-50/40")}><div className="flex items-start gap-3"><span className={cn("mt-1.5 h-2 w-2 rounded-full", u ? "bg-blue-500" : "bg-gray-300")} /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{n.title}</p>{n.body && <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{n.body}</p>}<p className="mt-1 text-[10px] uppercase text-gray-400">{rel(n.createdAt)}</p></div></div></li>
             ); })}</ul>
           )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
