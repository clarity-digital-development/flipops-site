import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/signals
//
// M3.4 — the Property Signals Timeline data source. Merges every dated event
// tied to a parcel into ONE chronological stream:
//   - ParcelSale          → sale events (sale $ + date)
//   - Mortgage            → recording-date nodes (records adapters)
//   - Lien (non-tax)      → judgment / lis_pendens / other recorded liens
//   - TaxDelinquencySummary → a single tax-delinquency ONSET node
//                            (FL Ch.197: taxes for year Y are delinquent
//                             April 1 of Y+1, so onset = earliestYear+1-04-01).
//                            We collapse the noisy per-certificate tax `Lien`
//                            rows (200K+, all stamped with capture time) into
//                            this one clean node so the timeline stays legible.
//   - Foreclosure         → per-stage nodes (LP/SCHEDULED/SOLD/TAX_DEED/…)
//   - AuctionSummary      → upcoming foreclosure auction node (nextAuctionDate)
//
// The persuasive screen: "sold 2019 $180K → mortgage 2019 → tax delinquent
// 2024 → lis pendens Mar 2026 → tax-deed sale Aug 8".
//
// ID resolution — this route is unusual in that it works for BOTH:
//   (a) a real Property id  → resolve (countyFips, apn) from the owner-scoped
//                             Property row (404 if not owned / not found).
//   (b) a virtual lead id   → `virt-{fips}-{apn}` or `virt-fc-{fips}-{apn}`
//                             (built by the /api/properties UNION). These are
//                             public county-distress facts, not user-owned
//                             rows, so we serve them read-only without an
//                             ownership join — the whole point of the timeline
//                             is to show the signal story BEFORE promote.
//
// All event reads are raw $queryRawUnsafe with typed row shapes (schema
// namespace `flipops`), keyed on (countyFips, apn). LIMIT-capped per source.
// ---------------------------------------------------------------------------

export type SignalEventType =
  | 'sale'
  | 'mortgage'
  | 'lien'
  | 'tax_delinquent'
  | 'foreclosure'
  | 'auction';

export interface SignalEvent {
  /** Stable-ish key for React lists. */
  key: string;
  type: SignalEventType;
  /** ISO date (may be a synthesized onset date for tax delinquency). */
  date: string;
  /** Short headline, e.g. "Sold" / "Lis pendens filed" / "Foreclosure auction". */
  title: string;
  /** Optional secondary line (lender, plaintiff, case #, certificate count). */
  detail?: string | null;
  /** Dollar amount when the event carries one (sale price, loan, judgment). */
  amount?: number | null;
  /** True when the event is in the future (scheduled auctions / tax-deed sale). */
  future?: boolean;
  /** True when a recorded lien/mortgage has been satisfied/released. */
  released?: boolean;
}

export interface SignalsPayload {
  countyFips: string;
  apn: string;
  /** Newest → oldest, with future events pinned to the very top. */
  events: SignalEvent[];
  /** Distinct event types present (for the "≥3 types" demo gate + UI summary). */
  eventTypes: SignalEventType[];
  property: {
    id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    ownerName: string | null;
  } | null;
}

// --- helpers ---------------------------------------------------------------

/**
 * Parse a virtual lead id into (countyFips, apn). Format is
 * `virt-{fips}-{apn}` or `virt-fc-{fips}-{apn}` where fips is exactly 5 digits
 * and apn may itself contain dashes — so we strip the known prefix, take the
 * 5-digit fips, then everything after the next dash is the apn.
 */
function parseVirtualId(id: string): { countyFips: string; apn: string } | null {
  let rest: string;
  if (id.startsWith('virt-fc-')) rest = id.slice('virt-fc-'.length);
  else if (id.startsWith('virt-')) rest = id.slice('virt-'.length);
  else return null;
  const m = rest.match(/^(\d{5})-(.+)$/);
  if (!m) return null;
  return { countyFips: m[1], apn: m[2] };
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const STAGE_LABELS: Record<string, string> = {
  NOD: 'Notice of default',
  LP: 'Lis pendens filed',
  NTS: 'Notice of sale',
  SCHEDULED: 'Foreclosure auction scheduled',
  SOLD: 'Foreclosure sale',
  REO: 'Bank-owned (REO)',
  DISMISSED: 'Foreclosure dismissed',
  TAX_DEED: 'Tax-deed sale',
};

const LIEN_LABELS: Record<string, string> = {
  judgment: 'Judgment lien recorded',
  lis_pendens: 'Lis pendens filed',
  mechanics: 'Mechanic’s lien recorded',
  hoa: 'HOA lien recorded',
  other: 'Lien recorded',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let countyFips: string | null = null;
    let apn: string | null = null;
    let property: SignalsPayload['property'] = null;

    const virtual = parseVirtualId(id);
    if (virtual) {
      // Public parcel-distress facts — no ownership join required.
      countyFips = virtual.countyFips;
      apn = virtual.apn;
      // Best-effort parcel identity for the header (not user-scoped).
      const parcelRows = await prisma.$queryRawUnsafe<
        { situsAddress: string | null; situsCity: string | null; situsState: string | null; situsZip: string | null; ownerName: string | null }[]
      >(
        `SELECT "situsAddress","situsCity","situsState","situsZip","ownerName"
         FROM flipops."Parcel" WHERE "countyFips"=$1 AND "apn"=$2 LIMIT 1`,
        countyFips,
        apn,
      );
      const p = parcelRows[0];
      property = p
        ? { id, address: p.situsAddress, city: p.situsCity, state: p.situsState ?? 'FL', zip: p.situsZip, ownerName: p.ownerName }
        : { id, address: null, city: null, state: 'FL', zip: null, ownerName: null };
    } else {
      // Real Property id — owner-scope it so the timeline can't leak another
      // tenant's parcel linkage.
      const guard = await requireUser();
      if ('error' in guard) return guard.error;
      const { userId } = guard;

      const prop = await prisma.property.findFirst({
        where: { id, userId },
        select: {
          id: true, address: true, city: true, state: true, zip: true,
          ownerName: true, countyFips: true, apn: true,
        },
      });
      if (!prop) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      property = {
        id: prop.id, address: prop.address, city: prop.city,
        state: prop.state, zip: prop.zip, ownerName: prop.ownerName,
      };
      countyFips = prop.countyFips;
      apn = prop.apn;
    }

    if (!countyFips || !apn) {
      // Manually-imported property with no parcel linkage — return an honest
      // empty stream rather than erroring.
      return NextResponse.json({
        countyFips: countyFips ?? '',
        apn: apn ?? '',
        events: [],
        eventTypes: [],
        property,
      } satisfies SignalsPayload);
    }

    // -- Pull each dated source in parallel (raw SQL, typed rows) ------------
    const [sales, mortgages, liens, taxRows, foreclosures, auctions] = await Promise.all([
      prisma.$queryRawUnsafe<
        { saleDate: Date | null; saleYear: number | null; salePrice: number | null; deedType: string | null }[]
      >(
        `SELECT "saleDate","saleYear","salePrice","deedType"
         FROM flipops."ParcelSale" WHERE "countyFips"=$1 AND "apn"=$2
         ORDER BY "saleDate" DESC NULLS LAST LIMIT 50`,
        countyFips, apn,
      ),
      prisma.$queryRawUnsafe<
        { recordingDate: Date; loanAmount: number | null; lenderName: string | null; mortgageType: string | null; releasedAt: Date | null }[]
      >(
        `SELECT "recordingDate","loanAmount","lenderName","mortgageType","releasedAt"
         FROM flipops."Mortgage" WHERE "countyFips"=$1 AND "apn"=$2
         ORDER BY "recordingDate" DESC LIMIT 50`,
        countyFips, apn,
      ),
      // Non-tax liens only — tax liens are represented by the single
      // TaxDelinquencySummary onset node below (they'd otherwise flood the
      // timeline with 100s of identical capture-dated rows).
      prisma.$queryRawUnsafe<
        { lienCategory: string; recordingDate: Date; filingDate: Date | null; amount: number | null; plaintiffName: string | null; releasedAt: Date | null }[]
      >(
        `SELECT "lienCategory","recordingDate","filingDate","amount","plaintiffName","releasedAt"
         FROM flipops."Lien" WHERE "countyFips"=$1 AND "apn"=$2 AND "lienCategory" <> 'tax'
         ORDER BY COALESCE("filingDate","recordingDate") DESC LIMIT 50`,
        countyFips, apn,
      ),
      prisma.$queryRawUnsafe<
        { earliestYear: number; latestYear: number; totalAmount: number; yearsCount: number; certificateCount: number }[]
      >(
        `SELECT "earliestYear","latestYear","totalAmount","yearsCount","certificateCount"
         FROM flipops."TaxDelinquencySummary" WHERE "countyFips"=$1 AND "apn"=$2 LIMIT 1`,
        countyFips, apn,
      ),
      prisma.$queryRawUnsafe<
        { stageCode: string; filingDate: Date | null; auctionDate: Date | null; capturedAt: Date; judgmentAmount: number | null; openingBid: number | null; caseNumber: string | null; plaintiffName: string | null }[]
      >(
        `SELECT "stageCode","filingDate","auctionDate","capturedAt","judgmentAmount","openingBid","caseNumber","plaintiffName"
         FROM flipops."Foreclosure" WHERE "countyFips"=$1 AND "apn"=$2
         ORDER BY COALESCE("auctionDate","filingDate","capturedAt") DESC LIMIT 50`,
        countyFips, apn,
      ),
      prisma.$queryRawUnsafe<
        { nextAuctionDate: Date | null; judgmentAmountMax: number | null; openingBidMin: number | null; lastCaseNumber: string | null }[]
      >(
        `SELECT "nextAuctionDate","judgmentAmountMax","openingBidMin","lastCaseNumber"
         FROM flipops."AuctionSummary" WHERE "countyFips"=$1 AND "apn"=$2 LIMIT 1`,
        countyFips, apn,
      ),
    ]);

    const now = Date.now();
    const events: SignalEvent[] = [];

    // ParcelSale
    sales.forEach((s, i) => {
      // SDF sales lack a day; synthesize from year/month when saleDate is null.
      let iso = toIso(s.saleDate);
      if (!iso && s.saleYear) iso = new Date(Date.UTC(s.saleYear, 0, 1)).toISOString();
      if (!iso) return;
      events.push({
        key: `sale-${i}-${iso}`,
        type: 'sale',
        date: iso,
        title: s.salePrice && s.salePrice > 1000 ? 'Sold' : 'Deed transfer',
        detail: s.deedType || null,
        amount: s.salePrice,
      });
    });

    // Mortgage
    mortgages.forEach((m, i) => {
      const iso = toIso(m.recordingDate);
      if (!iso) return;
      events.push({
        key: `mtg-${i}-${iso}`,
        type: 'mortgage',
        date: iso,
        title: m.releasedAt ? 'Mortgage satisfied' : 'Mortgage recorded',
        detail: [m.lenderName, m.mortgageType].filter(Boolean).join(' · ') || null,
        amount: m.loanAmount,
        released: !!m.releasedAt,
      });
    });

    // Lien (non-tax)
    liens.forEach((l, i) => {
      const iso = toIso(l.filingDate ?? l.recordingDate);
      if (!iso) return;
      events.push({
        key: `lien-${i}-${iso}`,
        type: 'lien',
        date: iso,
        title: LIEN_LABELS[l.lienCategory] ?? 'Lien recorded',
        detail: l.plaintiffName || null,
        amount: l.amount && l.amount > 0 ? l.amount : null,
        released: !!l.releasedAt,
      });
    });

    // TaxDelinquencySummary → single onset node
    const tax = taxRows[0];
    if (tax) {
      // FL Ch.197: year Y taxes become delinquent April 1 of Y+1.
      const onsetIso = new Date(Date.UTC(tax.earliestYear + 1, 3, 1)).toISOString();
      const yearsLabel = tax.yearsCount > 1 ? `${tax.yearsCount} years unpaid` : '1 year unpaid';
      events.push({
        key: `tax-${onsetIso}`,
        type: 'tax_delinquent',
        date: onsetIso,
        title: 'Property tax delinquent',
        detail: `Since ${tax.earliestYear} · ${yearsLabel}`,
        amount: tax.totalAmount && tax.totalAmount > 0 ? tax.totalAmount : null,
      });
    }

    // Foreclosure (per stage). Prefer the event's own date; fall back to
    // capturedAt so SOLD/DISMISSED rows scraped without an explicit
    // auction/filing date (common in the realauction feed) still appear.
    // Track the YYYY-MM-DD of every scheduled/future foreclosure auction so we
    // can suppress the redundant AuctionSummary node below (AuctionSummary
    // simply materializes MIN(scheduled Foreclosure.auctionDate) per parcel —
    // rendering both would double-show the same sale).
    const scheduledFcDays = new Set<string>();
    foreclosures.forEach((f, i) => {
      const eventDate = f.auctionDate ?? f.filingDate;
      const iso = toIso(eventDate ?? f.capturedAt);
      if (!iso) return;
      const isScheduledStage =
        f.stageCode === 'SCHEDULED' || f.stageCode === 'TAX_DEED' || f.stageCode === 'NTS';
      // Only treat as future when the date is a REAL event date (not the
      // capturedAt fallback) — a SOLD row's capture time isn't a future sale.
      const future = !!eventDate && new Date(iso).getTime() > now && isScheduledStage;
      if (future && f.auctionDate) scheduledFcDays.add(iso.slice(0, 10));
      events.push({
        key: `fc-${i}-${f.stageCode}-${iso}`,
        type: 'foreclosure',
        date: iso,
        title: STAGE_LABELS[f.stageCode] ?? `Foreclosure: ${f.stageCode}`,
        detail: [f.plaintiffName, f.caseNumber ? `Case ${f.caseNumber}` : null]
          .filter(Boolean)
          .join(' · ') || null,
        amount: f.judgmentAmount ?? f.openingBid ?? null,
        future,
      });
    });

    // AuctionSummary → upcoming auction. Only emit when it ISN'T already
    // represented by a scheduled Foreclosure row for the same day (avoids a
    // duplicate node), and only when it's in the future.
    const auc = auctions[0];
    if (auc?.nextAuctionDate) {
      const iso = toIso(auc.nextAuctionDate);
      if (iso && new Date(iso).getTime() > now && !scheduledFcDays.has(iso.slice(0, 10))) {
        events.push({
          key: `auction-${iso}`,
          type: 'auction',
          date: iso,
          title: 'Foreclosure auction',
          detail: auc.lastCaseNumber ? `Case ${auc.lastCaseNumber}` : null,
          amount: auc.openingBidMin ?? auc.judgmentAmountMax ?? null,
          future: true,
        });
      }
    }

    // Sort: future events first (soonest first), then past newest → oldest.
    events.sort((a, b) => {
      const at = new Date(a.date).getTime();
      const bt = new Date(b.date).getTime();
      const aFuture = a.future || at > now;
      const bFuture = b.future || bt > now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      if (aFuture && bFuture) return at - bt; // soonest future first
      return bt - at; // most recent past first
    });

    const eventTypes = Array.from(new Set(events.map((e) => e.type)));

    return NextResponse.json({
      countyFips,
      apn,
      events,
      eventTypes,
      property,
    } satisfies SignalsPayload);
  } catch (error) {
    console.error('Error fetching property signals timeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
