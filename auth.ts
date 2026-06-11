// ---------------------------------------------------------------------------
// auth.ts — Auth.js (NextAuth v5) instance with the Credentials provider.
//
// NODE-ONLY: imports Prisma + bcryptjs. middleware.ts must NOT import this
// file — it uses the edge-safe auth.config.ts instead (split-config pattern).
//
// Identity policy (M2.5):
//   - NO self-serve signup. Users are created manually/programmatically and
//     issued a password via scripts/set-user-password.ts.
//   - email + password compared against User.passwordHash (bcrypt).
//   - Users with a NULL passwordHash exist (legacy Clerk-era rows) but cannot
//     sign in until a password is set — rejected with a clear error.
//
// Exports:
//   handlers — mounted at app/api/auth/[...nextauth]/route.ts
//   auth     — session accessor used by requireUser()/requireAdmin()
//   signIn/signOut — server-action helpers
// ---------------------------------------------------------------------------

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

/**
 * Typed sign-in failures. Auth.js surfaces `code` to the client via the
 * ?error=/`error` result — we keep messages generic enough not to leak
 * which emails exist, except the no-password case which is an operator
 * policy signal, not an enumeration risk (the user already authenticated
 * intent with a known email).
 */
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}
class NoPasswordSetError extends CredentialsSignin {
  code = "no_password_set";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          throw new InvalidCredentialsError();
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });

        if (!user) {
          throw new InvalidCredentialsError();
        }

        // Legacy Clerk-era rows (and any manually created user not yet issued
        // credentials) have passwordHash = NULL. Reject with a distinct error
        // so the operator knows to run scripts/set-user-password.ts.
        if (!user.passwordHash) {
          throw new NoPasswordSetError();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          throw new InvalidCredentialsError();
        }

        // Best-effort lastLoginAt bump — never block sign-in on it.
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});

        // `id` here is the INTERNAL Prisma User.id — the jwt callback puts it
        // in token.sub, so auth() consumers get the DB id directly.
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
