// ---------------------------------------------------------------------------
// requireAdmin() — single source of truth for admin gating.
//
// Replaces the 6+ copy-pasted email-compare blocks scattered across
// app/api/admin/*. Returns either { error: NextResponse } (caller returns it)
// or { userId } (the authenticated admin's DB user id).
//
// M2.5: internals swapped from Clerk to Auth.js (NextAuth v5). PUBLIC
// SIGNATURE unchanged.
//
// Admin identity:
//   - Auth.js session must exist (Credentials provider — email + password).
//   - User.email must match process.env.ADMIN_EMAIL (or the hardcoded
//     fallback "tannercarlson@vvsvault.com" — the pre-launch admin),
//     case-insensitive.
//
// Future: when role-based access lands (e.g. a User.role column), this
// helper is the ONE place to extend. Anything that doesn't go through
// requireAdmin() is a bug.
//
// Usage:
//
//   import { requireAdmin } from "@/lib/auth/require-admin";
//
//   export async function GET() {
//     const guard = await requireAdmin();
//     if ("error" in guard) return guard.error;
//     const { userId } = guard;
//     // ...admin-only work
//   }
//
// Tests: tests/auth/require-admin.test.ts
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const FALLBACK_ADMIN_EMAIL = "tannercarlson@vvsvault.com";

export type RequireAdminResult =
  | { userId: string; email: string }
  | { error: NextResponse };

/** Compare the resolved admin email against the user's email, case-insensitive. */
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmail = (process.env.ADMIN_EMAIL ?? FALLBACK_ADMIN_EMAIL).toLowerCase();
  return email.toLowerCase() === adminEmail;
}

/**
 * Guard for admin-only routes.
 *
 * Returns `{ userId, email }` on success, `{ error: NextResponse }` on
 * failure. Callers MUST narrow with `"error" in guard` and return the
 * NextResponse if present.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id, email: user.email ?? "" };
}

/** Exposed for tests so we can assert email-resolution behavior. */
export const _internal = { isAdminEmail, FALLBACK_ADMIN_EMAIL };
