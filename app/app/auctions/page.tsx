"use client";

export const dynamic = "force-dynamic";

import { Gavel } from "lucide-react";
import { AuctionCalendar } from "@/components/auctions/auction-calendar";

// ---------------------------------------------------------------------------
// /app/auctions — M3.4 auction calendar
//
// Month-grid view over upcoming foreclosure + tax-deed auctions (the 14
// RealAuction counties' AuctionSummary.nextAuctionDate, already materialized).
// County filter, month nav, click any sale → property signals timeline.
// Viewport-fitting layout per CLAUDE.md (h-full flex column, no extra padding).
// ---------------------------------------------------------------------------

export default function AuctionsPage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex-shrink-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30">
            <Gavel className="h-5 w-5 text-red-600 dark:text-red-400" />
          </span>
          Auction Calendar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming foreclosure and tax-deed sales across all covered counties.
          Click any sale to open its full signals timeline.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <AuctionCalendar />
      </div>
    </div>
  );
}
