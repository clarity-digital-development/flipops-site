import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

/**
 * The Notification schema stores a single `message` column rather than separate
 * title/body fields. New writers (e.g. the Telnyx inbound-SMS hook) JSON-encode
 * `{ title, body }` into `message` so we can surface the structured shape this
 * endpoint promises. Legacy rows (raw strings produced before the schema agent
 * wired in user scoping) fall back to using `type` for the title and the raw
 * message for the body.
 */
function unpackMessage(
  message: string,
  type: string
): { title: string; body: string } {
  if (message.startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as { title?: unknown; body?: unknown };
      if (typeof parsed.title === "string" || typeof parsed.body === "string") {
        return {
          title: typeof parsed.title === "string" ? parsed.title : type,
          body: typeof parsed.body === "string" ? parsed.body : message,
        };
      }
    } catch {
      // fall through to legacy handling
    }
  }
  return { title: type, body: message };
}

export async function GET(_req: NextRequest) {
  const g = await requireUser();
  if ("error" in g) return g.error;

  const rows = await prisma.notification.findMany({
    where: { userId: g.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      readAt: true,
    },
  });

  const unread = rows.filter((n) => n.readAt === null).length;

  return NextResponse.json({
    unread,
    notifications: rows.map((n) => {
      const { title, body } = unpackMessage(n.message, n.type);
      return {
        id: n.id,
        title,
        body,
        type: n.type,
        createdAt: n.createdAt,
        readAt: n.readAt,
      };
    }),
  });
}

export async function PATCH(_req: NextRequest) {
  const g = await requireUser();
  if ("error" in g) return g.error;

  const result = await prisma.notification.updateMany({
    where: { userId: g.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
