// Sentry edge-runtime init. Auto-loaded by @sentry/nextjs on the Edge
// runtime (middleware.ts and any route segments declaring
// `export const runtime = 'edge'`). Edge has a stripped Node API surface,
// so we keep this config intentionally minimal.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
  });
}
