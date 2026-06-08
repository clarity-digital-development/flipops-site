// ---------------------------------------------------------------------------
// POST /api/uploads
//
// Small-file server-side proxy upload (under 5MB). Useful when the client
// doesn't want to deal with presigned-URL plumbing (e.g. avatar uploader,
// quick photo capture). Larger files MUST use /api/uploads/presigned instead.
//
// Accepts multipart/form-data with fields:
//   file:  the file blob
//   scope: 'document' | 'photo' | 'avatar'
//
// Returns: { url, key }
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/require-user";
import { putObject, sanitizeFilename } from "@/lib/storage/s3";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard cap on the proxy path

function normalizeScope(raw: FormDataEntryValue | null): "document" | "photo" | "avatar" {
  if (raw === "photo" || raw === "avatar") return raw;
  return "document";
}

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { userId } = guard;

  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "Storage not configured. Set S3_BUCKET in env.", code: "S3_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: "File too large for proxy path. Use /api/uploads/presigned for files over 5MB.",
        maxBytes: MAX_BYTES,
        code: "FILE_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  const scope = normalizeScope(formData.get("scope"));
  const safe = sanitizeFilename(file.name || "upload");
  const key = `${userId}/${scope}/${randomUUID()}-${safe}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { url } = await putObject({
      bucket,
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("[POST /api/uploads] putObject failed", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
