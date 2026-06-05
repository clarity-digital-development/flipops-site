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
//   3. Return the internal id — every other table in this app FKs to User.id,
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
import { auth } from "@clerk/nextjs/server";
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

  if (!user) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  return { userId: user.id, clerkId, email: user.email };
}
