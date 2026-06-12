// ---------------------------------------------------------------------------
// auth.config.ts — EDGE-SAFE Auth.js (NextAuth v5) base config.
//
// This file MUST NOT import Prisma, bcryptjs, or any Node-only module:
// middleware.ts instantiates NextAuth from THIS config so it can run on the
// Edge runtime. The Credentials provider (which needs Prisma + bcrypt) lives
// in auth.ts, which is only imported by Node.js route handlers / server code.
//
// Split-config pattern per Auth.js v5 App Router conventions:
//   https://authjs.dev/guides/edge-compatibility
//
// M2.5 Clerk→NextAuth migration; M3.6 removed the Clerk packages, webhook,
// and the clerkId column. Auth is now 100% Auth.js (Credentials provider).
// ---------------------------------------------------------------------------

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // AUTH_SECRET is read from env (set in .env.local + Railway). Explicit here
  // so a missing secret fails loudly at boot instead of silently signing JWTs
  // with a dev fallback.
  secret: process.env.AUTH_SECRET,

  // Railway (non-Vercel) host — without this Auth.js v5 rejects every request
  // with UntrustedHost. Equivalent to setting AUTH_TRUST_HOST=true.
  trustHost: true,

  // JWT sessions — no database session table. The Prisma User row is the
  // identity record; the session token carries { sub: User.id, email }.
  session: { strategy: "jwt" },

  pages: {
    signIn: "/sign-in",
  },

  // Providers are injected in auth.ts (Credentials needs Node-only deps).
  providers: [],

  callbacks: {
    // Persist the internal Prisma User.id (set as `user.id` by the
    // Credentials provider's authorize()) onto the token at sign-in.
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    // Surface User.id on session.user.id so server helpers can use it
    // without an extra lookup when only the id is needed.
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (token.email) session.user.email = token.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
