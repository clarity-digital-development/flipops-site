import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function GET(_req: NextRequest) {
  const g = await requireUser();
  if ("error" in g) return g.error;
  return NextResponse.json({ unread: 0, notifications: [] });
}

export async function PATCH(_req: NextRequest) {
  const g = await requireUser();
  if ("error" in g) return g.error;
  return NextResponse.json({ ok: true, updated: 0 });
}
