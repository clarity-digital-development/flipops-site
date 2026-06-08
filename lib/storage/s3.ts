// ---------------------------------------------------------------------------
// S3 / R2 storage client — single source of truth for object storage.
//
// Wraps @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner with the four
// operations the app needs: putObject, getPresignedUploadUrl (browser direct),
// getPresignedDownloadUrl, and deleteObject.
//
// Provider-agnostic: works against AWS S3 by default; set S3_ENDPOINT to point
// at Cloudflare R2, MinIO, Backblaze B2, or any S3-compatible store. R2 in
// particular requires `forcePathStyle: true` and an endpoint like
// `https://<account>.r2.cloudflarestorage.com`.
//
// Env vars (see env.sample):
//   AWS_REGION              — e.g. "us-east-1" (use "auto" for R2)
//   S3_ACCESS_KEY           — access key id
//   S3_SECRET_KEY           — secret access key
//   S3_BUCKET               — default bucket name (callers can override)
//   S3_ENDPOINT             — optional, for R2/MinIO/etc.
//   S3_PUBLIC_BASE_URL      — optional, public CDN base for non-presigned reads
//                             (e.g. R2 custom domain or CloudFront)
//
// Usage:
//
//   import { getPresignedUploadUrl } from "@/lib/storage/s3";
//
//   const { url, expiresAt } = await getPresignedUploadUrl({
//     bucket: process.env.S3_BUCKET!,
//     key: "user-abc/document/uuid-contract.pdf",
//     contentType: "application/pdf",
//     expiresInSec: 900,
//   });
//
// Companion: /api/uploads/presigned route uses this for client-direct upload;
// /api/uploads route uses putObject() for small server-side proxy uploads.
// ---------------------------------------------------------------------------

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Client singleton — lazily constructed so missing env vars don't crash on
// import (matches how lib/prisma.ts and other singletons in this repo behave).
// ---------------------------------------------------------------------------

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;

  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const endpoint = process.env.S3_ENDPOINT;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 storage not configured — set S3_ACCESS_KEY and S3_SECRET_KEY in env"
    );
  }

  _client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint
      ? {
          endpoint,
          // R2 / MinIO / most non-AWS S3-compatible stores require path-style
          // addressing. AWS itself works fine with path-style too, so this is
          // safe to set whenever a custom endpoint is configured.
          forcePathStyle: true,
        }
      : {}),
  });

  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PutObjectArgs {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  /** Optional cache-control header, e.g. "public, max-age=31536000". */
  cacheControl?: string;
  /** Optional content-disposition, e.g. "attachment; filename=foo.pdf". */
  contentDisposition?: string;
}

export interface PresignedUploadArgs {
  bucket: string;
  key: string;
  contentType: string;
  /** Presigned URL TTL in seconds. Defaults to 15 minutes. */
  expiresInSec?: number;
}

export interface PresignedDownloadArgs {
  bucket: string;
  key: string;
  /** Presigned URL TTL in seconds. Defaults to 1 hour. */
  expiresInSec?: number;
  /** Optional override for response Content-Disposition header. */
  contentDisposition?: string;
}

export interface DeleteObjectArgs {
  bucket: string;
  key: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/**
 * Upload a buffer/string directly via the server. Returns a public URL when
 * S3_PUBLIC_BASE_URL is configured, otherwise a presigned download URL good
 * for one hour. Use this for small server-side uploads (the /api/uploads proxy
 * route); for anything > a few MB, prefer the presigned-upload flow.
 */
export async function putObject(args: PutObjectArgs): Promise<{ url: string; key: string }> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      CacheControl: args.cacheControl,
      ContentDisposition: args.contentDisposition,
    })
  );

  const url = await resolveObjectUrl(args.bucket, args.key);
  return { url, key: args.key };
}

/**
 * Generate a presigned URL the BROWSER can PUT to directly. Pair with the
 * /api/uploads/presigned route for client-side uploads that bypass our
 * serverless function size limits.
 */
export async function getPresignedUploadUrl(
  args: PresignedUploadArgs
): Promise<PresignedUrlResult> {
  const client = getS3Client();
  const expiresInSec = args.expiresInSec ?? 60 * 15; // 15 minutes

  const cmd = new PutObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ContentType: args.contentType,
  });

  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSec });
  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

/**
 * Generate a presigned URL the browser/server can GET to download the object.
 * Use this when objects are stored in a private bucket and you don't have a
 * public CDN configured.
 */
export async function getPresignedDownloadUrl(
  args: PresignedDownloadArgs
): Promise<PresignedUrlResult> {
  const client = getS3Client();
  const expiresInSec = args.expiresInSec ?? 60 * 60; // 1 hour

  const cmd = new GetObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ResponseContentDisposition: args.contentDisposition,
  });

  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSec });
  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

/**
 * Permanently delete an object. No undo — callers should soft-delete in the DB
 * first and reconcile via a sweeper if hard cleanup is needed.
 */
export async function deleteObject(args: DeleteObjectArgs): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: args.bucket, Key: args.key })
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort public URL for an object. Prefers S3_PUBLIC_BASE_URL when set
 * (CDN / R2 custom domain). Falls back to a 1-hour presigned URL so callers
 * always get something they can hand to the browser.
 */
export async function resolveObjectUrl(bucket: string, key: string): Promise<string> {
  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (publicBase) {
    const trimmed = publicBase.replace(/\/+$/, "");
    return `${trimmed}/${encodeS3Key(key)}`;
  }

  // No public CDN configured — presign a download URL so the caller still has
  // a working link. Callers that need a longer-lived URL can call
  // getPresignedDownloadUrl directly with their own expiry.
  const { url } = await getPresignedDownloadUrl({ bucket, key });
  return url;
}

/**
 * Encode each path segment of an S3 key so it's safe in a URL. We split on
 * "/" first because encodeURIComponent would encode the slashes themselves,
 * which we want to preserve as path separators.
 */
function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Sanitize a user-provided filename for safe use in an S3 key. Strips path
 * separators, control chars, and trims runs of unsafe characters. Always
 * returns at least "file" so the key is never empty.
 */
export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : "file";
}
