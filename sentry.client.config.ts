// Sentry client-side init. Auto-loaded by @sentry/nextjs on browser bundles.
// Intentionally ENV-gated: if SENTRY_DSN is missing we simply do nothing,
// so a misconfigured local / preview env cannot crash the client boot.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 10% performance sample by default — bump per-env via
    // NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
    // Session-replay disabled by default — turn on per-env when needed.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    // Drop noisy framework errors that aren't actionable for us.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "NetworkError when attempting to fetch resource.",
    ],
  });
}
