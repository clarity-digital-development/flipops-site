// Auth.js (NextAuth v5) catch-all route — session, signin, signout, csrf, etc.
// Node runtime: the Credentials provider in @/auth uses Prisma + bcryptjs.
import { handlers } from "@/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
