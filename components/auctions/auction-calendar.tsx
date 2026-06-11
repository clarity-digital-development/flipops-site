"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Gavel,
  MapPin,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// AuctionCalendar (M3.4)
//
// Month-grid view over the upcoming foreclosure + tax-deed auctions
// materialized in AuctionSummary.nextAuctionDate across all counties. Month
// navigation, county filter, and a click-through from any cell's sale to the
// property signals timeline (via the virtual lead id). Renders REAL data with
// an honest empty state when a month has no scheduled sales.
// ---------------------------------------------------------------------------

interface CalendarSale {
  countyFips: string;
  countyName: string;
  apn: string;
  date: string;
  address: string | null;
  city: string | null;
  openingBid: number | null;
  judgmentAmount: number | null;
  grade: string | null;
  score: number | null;
  leadId: string;
}

interface CalendarPayload {
  month: string;
  days: Record<string, CalendarSale[]>;
  counties: { fips: string; name: string; count: number }[];
  monthsWithSales: string[];
  totalUpcoming: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "B":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-muted dark:text-gray-300";
  }
}

/** Build the 6-week (42-cell) grid of UTC dates for a YYYY-MM key. */
function buildGrid(key: string): { dayKey: string; inMonth: boolean; dayNum: number }[] {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startOffset = first.getUTCDay(); // 0=Sun
  const cells: { dayKey: string; inMonth: boolean; dayNum: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - startOffset + i));
    const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    cells.push({ dayKey, inMonth: d.getUTCMonth() === m - 1, dayNum: d.getUTCDate() });
  }
  return cells;
}

function SaleRow({ sale }: { sale: CalendarSale }) {
  const label = sale.address || `APN ${sale.apn}`;
  const bid = formatCurrency(sale.openingBid);
  return (
    <Link
      href={`/app/properties/${encodeURIComponent(sale.leadId)}`}
      className="block rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-gray-900 dark:text-white">{label}</span>
        {sale.grade ? (
          <span className={cn("rounded px-1 text-[10px] font-bold", gradeColor(sale.grade))}>
            {sale.grade}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-2.5 w-2.5" />
        <span className="truncate">{sale.countyName}{sale.city ? ` · ${sale.city}` : ""}</span>
        {bid ? <span className="ml-auto whitespace-nowrap tabular-nums">{bid}</span> : null}
      </div>
    </Link>
  );
}

export function AuctionCalendar() {
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [county, setCounty] = useState<string>("all");
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ month });
        if (county !== "all") qs.set("county", county);
        const res = await fetch(`/api/auctions/calendar?${qs.toString()}`);
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const payload = (await res.json()) as CalendarPayload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month, county]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const days = data?.days ?? {};
  const todayKey = (() => {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
  })();

  const monthHasSales = Object.values(days).reduce((s, arr) => s + arr.length, 0);
  const selectedSales = selectedDay ? days[selectedDay] ?? [] : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setMonth(shiftMonth(month, -1)); setSelectedDay(null); }} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[160px] text-center text-sm font-semibold text-gray-900 dark:text-white">
            {monthLabel(month)}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setMonth(shiftMonth(month, 1)); setSelectedDay(null); }} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {month !== currentMonthKey() ? (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => { setMonth(currentMonthKey()); setSelectedDay(null); }}>
              Today
            </Button>
          ) : null}
        </div>

        <Select value={county} onValueChange={(v) => { setCounty(v); setSelectedDay(null); }}>
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder="All counties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All counties{data ? ` (${data.totalUpcoming})` : ""}
            </SelectItem>
            {(data?.counties ?? []).map((c) => (
              <SelectItem key={c.fips} value={c.fips}>
                {c.name} ({c.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Gavel className="h-3.5 w-3.5 text-red-500" />
          <span className="tabular-nums">{monthHasSales} sale{monthHasSales === 1 ? "" : "s"} this month</span>
        </div>
      </div>

      {/* Grid */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0 gap-0">
        <div className="grid grid-cols-7 border-b text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="grid grid-cols-7 grid-rows-6 h-full">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div key={i} className="border-b border-r p-1.5 min-h-[92px]">
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 auto-rows-fr">
                {grid.map((cell) => {
                  const sales = days[cell.dayKey] ?? [];
                  const isToday = cell.dayKey === todayKey;
                  const isSelected = cell.dayKey === selectedDay;
                  return (
                    <button
                      key={cell.dayKey}
                      type="button"
                      onClick={() => sales.length > 0 && setSelectedDay(isSelected ? null : cell.dayKey)}
                      className={cn(
                        "flex flex-col gap-1 border-b border-r p-1.5 text-left align-top min-h-[96px] transition-colors",
                        !cell.inMonth && "bg-muted/30 text-muted-foreground",
                        sales.length > 0 ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
                        isSelected && "ring-2 ring-inset ring-red-400 dark:ring-red-600",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums",
                            isToday && "bg-red-600 font-bold text-white",
                            !isToday && cell.inMonth && "text-gray-900 dark:text-white",
                          )}
                        >
                          {cell.dayNum}
                        </span>
                        {sales.length > 0 ? (
                          <Badge className="border-0 bg-red-100 px-1.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                            {sales.length}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {sales.slice(0, 2).map((s) => (
                          <div
                            key={s.leadId}
                            className="truncate rounded bg-red-50 px-1 py-0.5 text-[10px] text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          >
                            {s.address || s.countyName}
                          </div>
                        ))}
                        {sales.length > 2 ? (
                          <div className="px-1 text-[10px] text-muted-foreground">+{sales.length - 2} more</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </Card>

      {/* Selected-day detail rail */}
      {selectedDay && selectedSales.length > 0 ? (
        <Card className="flex-shrink-0 py-0 gap-0">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <CalendarIcon className="h-4 w-4 text-red-500" />
              {new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
              <span className="text-xs font-normal text-muted-foreground">· {selectedSales.length} sale{selectedSales.length === 1 ? "" : "s"}</span>
            </div>
            <ScrollArea className="max-h-44">
              <div className="space-y-1 pr-2">
                {selectedSales.map((s) => (
                  <SaleRow key={s.leadId} sale={s} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {/* Honest empty state */}
      {!loading && monthHasSales === 0 ? (
        <p className="flex-shrink-0 text-center text-sm text-muted-foreground">
          No scheduled auctions in {monthLabel(month)}
          {county !== "all" ? " for this county" : ""}.
          {data && data.monthsWithSales.length > 0 ? (
            <>
              {" "}Next sales:{" "}
              <button
                className="font-medium text-red-600 hover:underline dark:text-red-400"
                onClick={() => setMonth(data.monthsWithSales[0])}
              >
                {monthLabel(data.monthsWithSales[0])}
              </button>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
