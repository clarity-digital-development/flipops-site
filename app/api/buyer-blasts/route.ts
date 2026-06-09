// ---------------------------------------------------------------------------
// /api/buyer-blasts — POST handler that records buyer-blast outreach against
// the Dialer's Telnyx pipe.
//
// The /app/campaigns page was retired in commit 3c6dcb2 in favor of the Dialer
// (Telnyx outbound + Oppenheimer inbound). The Buyers page still has a Blast
// Campaigns tab that needs to dispatch deal blasts to buyer lists over the same
// Telnyx outbound pipe.
//
// v0 contract:
//   POST { buyerIds: string[], listingId?: string, message: string,
//          channel: 'sms' | 'voicemail' }
//   → 201 { blast: { id, status, recipientCount, ... } }
//
// We persist the blast as a `Campaign` row (existing Prisma model) with
// `method` set to the channel. `Campaign` already covers the fields we need:
//   - buyerIds (JSON string)
//   - contractId (optional listing FK)
//   - method ("sms" | "voicemail" | "email" | "both")
//   - recipientCount
//   - status ("sent" once dispatched, "draft" for staged)
//   - sentAt
// This avoids a Prisma migration (the user-facing model name BuyerBlast maps
// onto the same persistence shape; if/when blast diverges from email/sms
// campaigns we can split with a discriminator column).
//
// Actual Telnyx dispatch is DEFERRED — see TODO inside the handler. For the v0
// demo the row is persisted with status='sent' + sentAt=now() so the UI list
// renders correctly. The Dialer worker (Telnyx + Oppenheimer) will pick up
// these rows once the dispatch worker is wired in a follow-up phase.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import IORedis from "ioredis";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { enqueueDialerDispatch } from "@/lib/queues/dialer-dispatch";
import type { StateCode } from "@/lib/dialer/quiet-hours";

// ---------------------------------------------------------------------------
// Lazy Redis singleton — re-used across requests in the same Node process.
// We deliberately don't tear it down on request completion; BullMQ is happy
// to share one ioredis connection across many producers.
// ---------------------------------------------------------------------------
let _redis: IORedis | null = null;
function redis(): IORedis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required to enqueue buyer blasts");
  }
  _redis = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return _redis;
}

// Two-letter US state codes accepted by lib/dialer/quiet-hours.StateCode.
// We narrow Buyer.targetMarkets / Property.state strings into this union
// before enqueueing so the worker's TCPA gate has canonical input.
const US_STATE_CODES = new Set<string>([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

function toStateCode(raw: string | null | undefined): StateCode | undefined {
  if (!raw) return undefined;
  const up = raw.trim().toUpperCase();
  return US_STATE_CODES.has(up) ? (up as StateCode) : undefined;
}

type BlastChannel = "sms" | "voicemail";

interface BlastBody {
  buyerIds?: unknown;
  listingId?: unknown;
  message?: unknown;
  channel?: unknown;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  let body: BlastBody;
  try {
    body = (await request.json()) as BlastBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate buyerIds
  if (!isStringArray(body.buyerIds) || body.buyerIds.length === 0) {
    return NextResponse.json(
      { error: "buyerIds must be a non-empty string array" },
      { status: 400 },
    );
  }
  const buyerIds = body.buyerIds;

  // Validate message
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 },
    );
  }
  const message = body.message.trim();

  // Validate channel
  if (body.channel !== "sms" && body.channel !== "voicemail") {
    return NextResponse.json(
      { error: "channel must be 'sms' or 'voicemail'" },
      { status: 400 },
    );
  }
  const channel: BlastChannel = body.channel;

  // listingId is optional; if provided, must be a string AND must belong to
  // the caller (via Contract -> userId). We resolve the contract row and use
  // its id as the foreign key on Campaign.contractId.
  let contractId: string | null = null;
  if (body.listingId !== undefined && body.listingId !== null) {
    if (typeof body.listingId !== "string") {
      return NextResponse.json(
        { error: "listingId must be a string" },
        { status: 400 },
      );
    }
    const contract = await prisma.contract.findFirst({
      where: { id: body.listingId, userId },
      select: { id: true },
    });
    if (!contract) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 },
      );
    }
    contractId = contract.id;
  }

  // Sanity-check buyer ownership AND pull phone + targetMarkets up-front so we
  // can route each recipient through the TCPA gate without N+1 queries.
  const ownedBuyers = await prisma.buyer.findMany({
    where: { id: { in: buyerIds }, userId },
    select: { id: true, phone: true, targetMarkets: true, name: true },
  });
  const ownedSet = new Set(ownedBuyers.map((b) => b.id));
  const orphans = buyerIds.filter((id) => !ownedSet.has(id));
  if (orphans.length > 0) {
    return NextResponse.json(
      { error: `Buyers not in your network: ${orphans.join(", ")}` },
      { status: 403 },
    );
  }

  // If a listing/contract was selected, look up its property state so we have
  // a single canonical state to pass to the worker. Buyer.targetMarkets is a
  // JSON array like ["Miami-Dade, FL"]; we use it as a best-effort fallback
  // when the contract path is unavailable. The worker's `propertyState` field
  // is the TCPA anchor — it's what determines the recipient's quiet-hours
  // window. If both signals miss, the worker falls back to area-code → state
  // and ultimately refuses the send if nothing resolves.
  let listingState: StateCode | undefined;
  if (contractId) {
    const ctr = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { property: { select: { state: true } } },
    });
    listingState = toStateCode(ctr?.property?.state);
  }

  function buyerHomeState(targetMarkets: string | null | undefined): StateCode | undefined {
    if (!targetMarkets) return undefined;
    try {
      const arr = JSON.parse(targetMarkets) as unknown;
      if (!Array.isArray(arr) || arr.length === 0) return undefined;
      const first = String(arr[0]);
      // "Miami-Dade, FL" → trailing 2-letter code after comma
      const m = first.match(/,\s*([A-Za-z]{2})\s*$/);
      return toStateCode(m?.[1]);
    } catch {
      return undefined;
    }
  }

  // Build the FROM number. In production this is the user's provisioned 10DLC
  // sender (SMS) or assigned Telnyx caller-ID (RVM); for the v0 wiring we read
  // a single env-driven default. Per-user routing arrives with the messaging
  // profile work in Sprint 4.
  const fromNumber =
    channel === "sms"
      ? process.env.TELNYX_DEFAULT_SMS_FROM ?? process.env.TELNYX_DEFAULT_FROM ?? ""
      : process.env.TELNYX_DEFAULT_RVM_FROM ?? process.env.TELNYX_DEFAULT_FROM ?? "";
  if (!fromNumber) {
    return NextResponse.json(
      {
        error:
          "No origination number configured. Set TELNYX_DEFAULT_SMS_FROM / TELNYX_DEFAULT_RVM_FROM (or TELNYX_DEFAULT_FROM) before sending blasts.",
      },
      { status: 500 },
    );
  }

  // Persist the Campaign row first so we have a correlationId to attach to
  // every dispatch job. status='queued' (NOT 'sent') is the honest state —
  // we'll flip rows to 'sent' / 'delivered' from Telnyx webhook callbacks.
  // This is the contract fix the audit doc called out.
  const blast = await prisma.campaign.create({
    data: {
      userId,
      contractId,
      name: `Buyer Blast — ${channel} — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      subject: null,
      message,
      method: channel, // "sms" | "voicemail"
      buyerIds: JSON.stringify(buyerIds),
      recipientCount: buyerIds.length,
      status: "queued",
      sentAt: new Date(),
    },
  });

  // Enqueue one dispatch job per recipient with a phone number. Buyers w/o a
  // phone are skipped (counted in `skipped` so the UI can warn the operator).
  // The worker's TCPA quiet-hours gate runs per-job, so out-of-window
  // recipients get auto-deferred rather than dropped.
  const enqueueErrors: string[] = [];
  let enqueued = 0;
  let skippedNoPhone = 0;
  try {
    const conn = redis();
    for (const buyer of ownedBuyers) {
      if (!buyer.phone || buyer.phone.trim().length === 0) {
        skippedNoPhone += 1;
        continue;
      }
      const propertyState = listingState ?? buyerHomeState(buyer.targetMarkets);
      const toPhoneNumber = buyer.phone.trim();
      try {
        await enqueueDialerDispatch(conn, {
          jobType: channel, // 'sms' | 'voicemail'
          userId,
          toNumber: toPhoneNumber,
          fromNumber,
          propertyState,
          body: message, // voicemail callers must pass a media URL here
          correlationId: `blast:${blast.id}:buyer:${buyer.id}`,
          campaignId: blast.id,
        });
        enqueued += 1;

        // Audit row for the recipient. Wrapped in its own try/catch so the
        // dispatch is never blocked by an audit-row write failure (mirrors
        // the writeDispatchAudit pattern in the worker). The unique key on
        // CampaignRecipient is (campaignId + toPhoneNumber + status='queued')
        // — the worker will flip status to 'sent' / 'failed' post-dispatch.
        try {
          await prisma.campaignRecipient.create({
            data: {
              campaignId: blast.id,
              buyerId: buyer.id,
              toPhoneNumber,
              status: "queued",
            },
          });
        } catch (auditErr) {
          const auditMsg =
            auditErr instanceof Error ? auditErr.message : String(auditErr);
          console.error(
            `[buyer-blasts] failed to write CampaignRecipient audit row for blast=${blast.id} buyer=${buyer.id}: ${auditMsg}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        enqueueErrors.push(`${buyer.name}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    enqueueErrors.push(`fatal: ${msg}`);
  }

  return NextResponse.json(
    {
      blast: {
        id: blast.id,
        status: blast.status,
        channel,
        recipientCount: blast.recipientCount,
        listingId: blast.contractId,
        sentAt: blast.sentAt,
        message: blast.message,
      },
      dispatch: {
        enqueued,
        skippedNoPhone,
        errorCount: enqueueErrors.length,
        errors: enqueueErrors.slice(0, 10), // cap for response size
      },
    },
    { status: 201 },
  );
}
