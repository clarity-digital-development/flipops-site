// Sentry server-side init. Auto-loaded by @sentry/nextjs on the Node
// runtime (API routes, server components, server actions).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    // Server-side: keep PII off by default. We deal with seller phone /
    // address data and don't want it leaving the box.
    sendDefaultPii: false,
  });
}
