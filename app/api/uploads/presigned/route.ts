// ---------------------------------------------------------------------------
// POST /api/uploads/presigned
//
// Generate a presigned S3 PUT URL the browser can upload directly to. Bypasses
// Vercel/Next serverless body-size limits for large files (contracts, photos).
//
// Body:
//   { filename: string, contentType: string, scope: 'document' | 'photo' | 'avatar' }
//
// Returns:
//   { uploadUrl, downloadUrl, key, expiresAt }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPresignedUploadUrl,
  resolveObjectUrl,
  sanitizeFilename,
} from "@/lib/storage/s3";

const BodySchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  scope: z.enum(["document", "photo", "avatar"]),
});

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "Storage not configured. Set S3_BUCKET in env.", code: "S3_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  // Key shape: <userId>/<scope>/<uuid>-<safeFilename>
  const safe = sanitizeFilename(body.filename);
  const key = `${userId}/${body.scope}/${randomUUID()}-${safe}`;

  try {
    const { url: uploadUrl, expiresAt } = await getPresignedUploadUrl({
      bucket,
      key,
      contentType: body.contentType,
      expiresInSec: 900,
    });
    const downloadUrl = await resolveObjectUrl(bucket, key);
    return NextResponse.json({ uploadUrl, downloadUrl, key, expiresAt });
  } catch (err) {
    console.error("[POST /api/uploads/presigned] presign failed", err);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 },
    );
  }
}
