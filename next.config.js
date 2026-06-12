/** @type {import('next').NextConfig} */
// Cache bust: 1738710500
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false, // typecheck is clean as of M1 (272→0); keep builds honest
  },
  // Next 16 builds with Turbopack by default. An empty turbopack config is
  // required whenever any plugin (e.g. Sentry) injects a webpack config —
  // otherwise the build hard-errors with "webpack config and no turbopack config".
  turbopack: {},
  // Mark pino as external to avoid bundling test files
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  async headers() {
    // Only apply aggressive caching in production — in dev, browser disk cache
    // serves stale JS bundles on refresh, preventing HMR from working properly
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/:path*.(js|css|woff2|woff|ttf|ico|png|jpg|jpeg|gif|svg|webp)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
}

// Sentry wrapper — gated on the DSN actually being configured. The wrap
// injects a webpack config, which Next 16/Turbopack rejects without a
// turbopack config, and the SDK's Turbopack instrumentation is incomplete
// anyway — an unprovisioned Sentry must not alter the build at all.
// (Package-installed-but-no-DSN previously wrapped unconditionally, which
// broke every Railway site build once the lockfile was fixed.)
let finalConfig = nextConfig
const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
if (sentryDsn) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const { withSentryConfig } = require('@sentry/nextjs')
    finalConfig = withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
      // Optional org / project / authToken pulled from env — the Sentry CLI
      // reads SENTRY_AUTH_TOKEN automatically during build to upload source maps.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[next.config] SENTRY_DSN set but @sentry/nextjs not installed; skipping Sentry wrap.')
  }
}

module.exports = finalConfig
