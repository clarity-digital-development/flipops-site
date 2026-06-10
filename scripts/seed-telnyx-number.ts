/**
 * Seed a TelnyxNumber row for the current user's primary phone.
 *
 * Reads:
 *   - TELNYX_DEFAULT_SMS_FROM env var (e.g. "+19046220099")
 *   - TELNYX_OWNER_EMAIL env var (which User to attach the number to)
 *     OR falls back to the FIRST User row in the DB (single-tenant dev).
 *   - TELNYX_MESSAGING_PROFILE_ID env var (optional but recommended)
 *   - TELNYX_CALL_CONTROL_CONNECTION_ID env var (optional)
 *
 * Idempotent: looks up TelnyxNumber by phoneNumber (the @unique field).
 * - If exists: updates label/messagingProfileId/connectionId/lastUsedAt
 * - If not: creates a new row
 *
 * Run with:
 *   DATABASE_URL=... npx tsx scripts/seed-telnyx-number.ts
 */

import { prisma } from "../lib/prisma";

async function main() {
  const phoneNumber = process.env.TELNYX_DEFAULT_SMS_FROM;
  if (!phoneNumber) {
    throw new Error(
      "TELNYX_DEFAULT_SMS_FROM env var is required (e.g. +19046220099)",
    );
  }

  const ownerEmail = process.env.TELNYX_OWNER_EMAIL ?? null;
  const messagingProfileId =
    process.env.TELNYX_MESSAGING_PROFILE_ID ?? null;
  const connectionId =
    process.env.TELNYX_CALL_CONTROL_CONNECTION_ID ?? null;

  let user = ownerEmail
    ? await prisma.user.findFirst({ where: { email: ownerEmail } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user && ownerEmail) {
    // M1.1/OPS-4: JIT-provision the owner User instead of throwing — mirrors
    // requireUser()'s provisioning defaults. Idempotent via upsert on the
    // unique email column (concurrent runs collapse to one row).
    user = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        targetMarkets: "[]", // required column; user completes onboarding later
      },
    });
    console.log("[seed-telnyx-number] provisioned User", {
      id: user.id,
      email: user.email,
    });
  }

  if (!user) {
    throw new Error(
      "No User rows in DB and TELNYX_OWNER_EMAIL is not set — set TELNYX_OWNER_EMAIL so this seed can provision the owner User automatically.",
    );
  }

  const label = `${phoneNumber.startsWith("+1904") ? "Jacksonville" : phoneNumber} primary`;

  const upserted = await prisma.telnyxNumber.upsert({
    where: { phoneNumber },
    update: {
      label,
      messagingProfileId: messagingProfileId ?? undefined,
      connectionId: connectionId ?? undefined,
      lastUsedAt: new Date(),
      active: true,
    },
    create: {
      userId: user.id,
      phoneNumber,
      label,
      messagingProfileId,
      connectionId,
      smsEnabled: true,
      voiceEnabled: true,
      mmsEnabled: false,
      active: true,
    },
  });

  console.log("[seed-telnyx-number] OK", {
    id: upserted.id,
    phoneNumber: upserted.phoneNumber,
    label: upserted.label,
    userId: upserted.userId,
    userEmail: user.email,
    messagingProfileId: upserted.messagingProfileId,
    connectionId: upserted.connectionId,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
