"use client";

// ---------------------------------------------------------------------------
// AuthProvider — client wrapper around Auth.js (NextAuth v5) SessionProvider.
//
// M3.6: replaced Clerk's <ClerkProvider> in the root layout. Makes the
// useSession() hook available to client components (dashboard greeting, tasks
// optimistic author, etc.). SessionProvider lazily fetches /api/auth/session on
// mount; no props/keys required (unlike Clerk's publishableKey).
// ---------------------------------------------------------------------------

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
