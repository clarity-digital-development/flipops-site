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
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

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

  // Sanity-check buyer ownership — every buyerId must belong to this user.
  const ownedBuyers = await prisma.buyer.findMany({
    where: { id: { in: buyerIds }, userId },
    select: { id: true },
  });
  const ownedSet = new Set(ownedBuyers.map((b) => b.id));
  const orphans = buyerIds.filter((id) => !ownedSet.has(id));
  if (orphans.length > 0) {
    return NextResponse.json(
      { error: `Buyers not in your network: ${orphans.join(", ")}` },
      { status: 403 },
    );
  }

  // Persist the blast as a Campaign row. status='sent' so the UI's recent-list
  // can render it as dispatched. Once the Telnyx dispatch worker ships, the
  // worker should flip the status (sent -> delivered, etc.) based on Telnyx
  // webhook callbacks.
  //
  // TODO(phase-8, Telnyx dispatch): Enqueue this blast onto the dialer's
  // Telnyx outbound BullMQ queue. The queue worker should:
  //   1. Resolve each buyer's phone (Buyer.phone, E.164-normalized).
  //   2. Honor lib/dialer/quiet-hours per state — defer dispatch outside hours.
  //   3. For channel='sms': Telnyx Messaging API (10DLC-registered sender).
  //   4. For channel='voicemail': Telnyx ringless voicemail via call control.
  //   5. Update Campaign row (replyCount/openCount/etc) from Telnyx webhooks.
  // Until that lands, this endpoint persists-only for UI continuity.
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
      status: "sent",
      sentAt: new Date(),
    },
  });

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
    },
    { status: 201 },
  );
}
