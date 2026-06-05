// ---------------------------------------------------------------------------
// GET /api/documents
//
// Phase 6 — minimum-viable Documents backend.
//
// Lists the authenticated user's documents. Falls back to an empty array if
// the Document model isn't present in the live database yet (e.g. before the
// schema patch in this phase has been db-pushed). The page is allowed to fall
// back to its seed-data file when the response is empty, so this contract is
// safe.
//
// Deferred (out of scope this phase):
//   - PDF generation
//   - file storage (S3 / Vercel Blob)
//   - email sending
//   - template library / packet builder
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  try {
    // The Document model is added in the Phase 6 schema patch.
    // Use a defensive cast so this file compiles even before `prisma generate`
    // has been re-run against the patched schema.
    const client = prisma as unknown as {
      document?: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
    };

    if (!client.document) {
      // Schema patch not applied yet — return empty so the page falls back to
      // seed-data and the UI keeps working.
      return NextResponse.json({ documents: [] });
    }

    const documents = await client.document.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { userId } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orderBy: { updatedAt: "desc" } as any,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("[/api/documents] GET failed:", error);
    // Don't 500 the page — let the UI fall back to seed-data.
    return NextResponse.json({ documents: [] });
  }
}
