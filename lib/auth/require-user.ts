// ---------------------------------------------------------------------------
// requireUser() — single source of truth for authenticated-user gating.
//
// Replaces the 14+ copy-pasted `const userId = "mock-user-id"` debugging stubs
// that were left scattered across app/api/* during pre-launch CSS work. Returns
// either { error: NextResponse } (caller returns it) or { userId, clerkId, email }
// where `userId` is the internal Prisma User.id.
//
// M2.5: internals swapped from Clerk to Auth.js (NextAuth v5). The PUBLIC
// SIGNATURE is unchanged — `clerkId` remains in the success shape for
// backward compatibility (populated from the legacy User.clerkId column when
// present, "" otherwise; the column drops at M3.6).
//
// Identity flow:
//   1. Auth.js auth() returns the session ({ user: { id, email } }) or null.
//      `session.user.id` is the INTERNAL Prisma User.id (set by the
//      Credentials provider's authorize() → jwt callback → token.sub).
//   2. Look up the Prisma User row by session email (source of truth).
//   3. JIT provisioning: if the session is valid but no User row exists
//      (e.g. row deleted while a JWT was still live), CREATE it from the
//      session profile (email + name). Idempotent via upsert on the unique
//      email column. clerkId is NO LONGER minted.
//   4. Return the internal id — every other table in this app FKs to User.id.
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
// Tests: tests/auth/require-admin.test.ts (companion suite)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth } from "@/auth";
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
 * If the Auth.js session is valid but no User row exists yet, the row is
 * created just-in-time (see provisionUser below) — authenticated users never
 * see "User not found" unless the session has no email (should be impossible
 * with the Credentials provider, which requires an email to sign in).
 */
export async function requireUser(): Promise<RequireUserResult> {
  const session = await auth();
  // The session email comes from the DB row (authorize() returns User.email),
  // so it matches the stored casing exactly — no normalization needed here.
  const email = session?.user?.email ?? null;
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, clerkId: true },
  });

  if (user) {
    return { userId: user.id, clerkId: user.clerkId ?? "", email: user.email };
  }

  // JIT provisioning: valid session, no User row yet (e.g. deleted after the
  // JWT was issued). Recreate from the session profile.
  const provisioned = await provisionUser(email, session?.user?.name ?? null);
  if (!provisioned) {
    // Should not happen (email is guaranteed above) — preserve the legacy 404
    // for the defensive edge.
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  return {
    userId: provisioned.id,
    clerkId: provisioned.clerkId ?? "",
    email: provisioned.email,
  };
}

/**
 * Create the User row for an Auth.js session identity.
 *
 * - Idempotent: upsert on the unique `email` column, so concurrent first
 *   requests collapse to one row.
 * - clerkId is NOT minted (M2.5 policy) — the column stays untouched and is
 *   removed entirely at M3.6.
 *
 * Returns null only on a defensive empty-email edge (User.email is required).
 */
async function provisionUser(
  email: string,
  name: string | null
): Promise<{ id: string; email: string | null; clerkId: string | null } | null> {
  if (!email) return null;

  return prisma.user.upsert({
    where: { email },
    update: {}, // row already exists for this email — nothing to change
    create: {
      email,
      name,
      targetMarkets: "[]", // required column; user fills in via onboarding
    },
    select: { id: true, email: true, clerkId: true },
  });
}
