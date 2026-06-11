import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { flCountyByFips } from '@/lib/data-sources/bulk/fl-counties';

// ---------------------------------------------------------------------------
// GET /api/auctions/calendar?month=YYYY-MM&county=12031
//
// M3.4 — powers the auction calendar month-grid. Aggregates UPCOMING (and the
// selected month's) auctions from the materialized AuctionSummary aggregate
// (one row per (countyFips, apn); nextAuctionDate already collapses the many
// per-parcel Foreclosure rows — including TAX_DEED applications that escalate
// into scheduled sales). Returns the sales for the requested month grouped by
// ISO date, plus the county filter list and the set of months that have any
// upcoming sales (so the UI can disable empty-month navigation).
//
// Every row carries countyFips+apn so the UI can deep-link to the property
// signals timeline via the virtual lead id (virt-fc-{fips}-{apn}).
//
// Read-only public county-distress facts (foreclosure/tax-deed sale calendars
// are public records, not tenant data) — served without an ownership gate, the
// same posture as the signals timeline's virtual-lead path. Reachable via the
// `/api/auctions/(.*)` public matcher in middleware.ts.
// ---------------------------------------------------------------------------

export interface CalendarSale {
  countyFips: string;
  countyName: string;
  apn: string;
  date: string; // ISO date (the auction date)
  address: string | null;
  city: string | null;
  openingBid: number | null;
  judgmentAmount: number | null;
  grade: string | null;
  score: number | null;
  /** virtual lead id for deep-linking to the property signals timeline */
  leadId: string;
}

export interface CalendarPayload {
  month: string; // "YYYY-MM" echoed back
  /** ISO-date string → sales on that day, for the requested month + county. */
  days: Record<string, CalendarSale[]>;
  /** county filter options (only counties that have any upcoming sales). */
  counties: { fips: string; name: string; count: number }[];
  /** "YYYY-MM" strings that contain ≥1 upcoming sale (for month nav hints). */
  monthsWithSales: string[];
  totalUpcoming: number;
}

/** Validate + normalize a `YYYY-MM` month param; default to current month. */
function parseMonth(raw: string | null): { year: number; month0: number; key: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let month0 = now.getUTCMonth();
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (m >= 1 && m <= 12) {
      year = y;
      month0 = m - 1;
    }
  }
  const key = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  return { year, month0, key };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { year, month0, key } = parseMonth(searchParams.get('month'));
    const countyParam = searchParams.get('county');
    const county = countyParam && /^\d{5}$/.test(countyParam) ? countyParam : null;

    // Month window [start, nextMonthStart) in UTC.
    const monthStart = new Date(Date.UTC(year, month0, 1));
    const monthEnd = new Date(Date.UTC(year, month0 + 1, 1));

    // -- Sales for the requested month (+ optional county) ------------------
    const monthRows = await prisma.$queryRawUnsafe<
      {
        countyFips: string;
        apn: string;
        nextAuctionDate: Date;
        openingBidMin: number | null;
        judgmentAmountMax: number | null;
        grade: string | null;
        score: number | null;
        situsAddress: string | null;
        situsCity: string | null;
      }[]
    >(
      `SELECT a."countyFips", a."apn", a."nextAuctionDate", a."openingBidMin",
              a."judgmentAmountMax", a."grade", a."score",
              p."situsAddress", p."situsCity"
       FROM flipops."AuctionSummary" a
       LEFT JOIN flipops."Parcel" p
         ON p."countyFips" = a."countyFips" AND p."apn" = a."apn"
       WHERE a."nextAuctionDate" >= $1 AND a."nextAuctionDate" < $2
         ${county ? 'AND a."countyFips" = $3' : ''}
       ORDER BY a."nextAuctionDate" ASC, a."score" DESC NULLS LAST
       LIMIT 2000`,
      ...(county ? [monthStart, monthEnd, county] : [monthStart, monthEnd]),
    );

    const days: Record<string, CalendarSale[]> = {};
    for (const r of monthRows) {
      const d = new Date(r.nextAuctionDate);
      const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const countyName = flCountyByFips(r.countyFips)?.name ?? r.countyFips;
      const sale: CalendarSale = {
        countyFips: r.countyFips,
        countyName,
        apn: r.apn,
        date: d.toISOString(),
        address: r.situsAddress,
        city: r.situsCity,
        openingBid: r.openingBidMin,
        judgmentAmount: r.judgmentAmountMax,
        grade: r.grade,
        score: r.score,
        leadId: `virt-fc-${r.countyFips}-${r.apn}`,
      };
      (days[dayKey] ??= []).push(sale);
    }

    // -- County filter options (all upcoming, regardless of selected month) -
    const countyAgg = await prisma.$queryRawUnsafe<{ countyFips: string; n: bigint }[]>(
      `SELECT "countyFips", COUNT(*)::bigint n
       FROM flipops."AuctionSummary"
       WHERE "nextAuctionDate" >= NOW()
       GROUP BY "countyFips"
       ORDER BY n DESC`,
    );
    const counties = countyAgg.map((c) => ({
      fips: c.countyFips,
      name: flCountyByFips(c.countyFips)?.name ?? c.countyFips,
      count: Number(c.n),
    }));
    const totalUpcoming = counties.reduce((s, c) => s + c.count, 0);

    // -- Months that contain upcoming sales (for nav affordances) -----------
    const monthAgg = await prisma.$queryRawUnsafe<{ ym: string }[]>(
      `SELECT DISTINCT to_char("nextAuctionDate", 'YYYY-MM') ym
       FROM flipops."AuctionSummary"
       WHERE "nextAuctionDate" >= NOW()
         ${county ? 'AND "countyFips" = $1' : ''}
       ORDER BY ym ASC`,
      ...(county ? [county] : []),
    );
    const monthsWithSales = monthAgg.map((m) => m.ym);

    return NextResponse.json({
      month: key,
      days,
      counties,
      monthsWithSales,
      totalUpcoming,
    } satisfies CalendarPayload);
  } catch (error) {
    console.error('Error fetching auction calendar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
