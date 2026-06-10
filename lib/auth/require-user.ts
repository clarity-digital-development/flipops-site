// ---------------------------------------------------------------------------
// requireUser() — single source of truth for authenticated-user gating.
//
// Replaces the 14+ copy-pasted `const userId = "mock-user-id"` debugging stubs
// that were left scattered across app/api/* during pre-launch CSS work. Returns
// either { error: NextResponse } (caller returns it) or { userId, clerkId, email }
// where `userId` is the internal Prisma User.id (NOT the Clerk id).
//
// Identity flow:
//   1. Clerk's auth() returns the signed-in user's clerkId (or null).
//   2. Look up the corresponding Prisma User row.
//   3. JIT provisioning (M1.6 / M1.1 step 4): if the Clerk session is valid but
//      no User row exists, CREATE it from Clerk's currentUser() profile
//      (clerkId + primary email + name) instead of 404ing. Idempotent via
//      upsert on clerkId; a pre-existing row with the same email (pre-Clerk
//      import) is adopted by attaching the clerkId to it.
//   4. Return the internal id — every other table in this app FKs to User.id,
//      not clerkId.
//
// Usage:
//
//   import { requireUser } from "@/lib/auth/require-user";
//
//   export async function GET() {
//     const guard = await requireUser();
//     if ("error" in guard) return guard.error;
//     const { userId } = guard;
//     // ...userId is the internal Prisma User.id
//   }
//
// Companion to requireAdmin() in this same directory. requireUser is for any
// authenticated-user-scoped endpoint; requireAdmin layers an admin email check
// on top.
//
// Tests: tests/auth/require-user.test.ts
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type RequireUserResult =
  | { userId: string; clerkId: string; email: string | null }
  | { error: NextResponse };

/**
 * Guard for authenticated-user-scoped routes.
 *
 * Returns `{ userId, clerkId, email }` on success, `{ error: NextResponse }` on
 * failure. Callers MUST narrow with `"error" in guard` and return the
 * NextResponse if present.
 *
 * If the Clerk session is valid but no User row exists yet, the row is
 * created just-in-time (see provisionUser below) — authenticated users never
 * see "User not found" unless Clerk has no email for them.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true },
  });

  if (user) {
    return { userId: user.id, clerkId, email: user.email };
  }

  // JIT provisioning: valid Clerk session, no User row yet.
  const provisioned = await provisionUser(clerkId);
  if (!provisioned) {
    // Clerk gave us no email — User.email is required+unique, so we cannot
    // create a row. Preserve the legacy 404 for this (rare) edge.
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  return { userId: provisioned.id, clerkId, email: provisioned.email };
}

/**
 * Create (or adopt) the User row for a Clerk identity.
 *
 * - Idempotent: upsert on the unique `clerkId` column, so concurrent first
 *   requests collapse to one row.
 * - Migration-safe: if a pre-Clerk User row already holds this email
 *   (User.email is unique), the upsert's create throws P2002 — we adopt that
 *   row by attaching the clerkId instead of failing.
 *
 * Returns null when Clerk has no email address for the user (User.email is a
 * required column).
 */
async function provisionUser(
  clerkId: string
): Promise<{ id: string; email: string | null } | null> {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    null;
  if (!email) return null;

  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || null;

  try {
    return await prisma.user.upsert({
      where: { clerkId },
      update: {}, // row already exists for this clerkId — nothing to change
      create: {
        clerkId,
        email,
        name,
        targetMarkets: "[]", // required column; user fills in via onboarding
      },
      select: { id: true, email: true },
    });
  } catch (err) {
    // P2002 = unique violation. The clerkId conflict is absorbed by the
    // upsert itself, so this is the email index: a pre-Clerk row with the
    // same email exists. Adopt it.
    if ((err as { code?: string } | null)?.code === "P2002") {
      return prisma.user.update({
        where: { email },
        data: { clerkId, ...(name ? { name } : {}) },
        select: { id: true, email: true },
      });
    }
    throw err;
  }
}
