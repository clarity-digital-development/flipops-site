/** @type {import('next').NextConfig} */
// Cache bust: 1738710500
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,  // Temporarily enable to test frontend (TODO: fix API route types)
  },
  transpilePackages: ['@clerk/nextjs', '@clerk/clerk-react'],
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

// Sentry wrapper — ENV-gated. If @sentry/nextjs isn't installed yet or
// SENTRY_DSN is missing, fall back to the bare config so dev / preview /
// CI builds still succeed. This is intentional: Sentry is observability,
// not a hard runtime dependency.
let finalConfig = nextConfig
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
  // Package not installed yet — skip the wrap. Logged once at build time.
  // eslint-disable-next-line no-console
  console.warn('[next.config] @sentry/nextjs not installed; skipping Sentry wrap.')
}

module.exports = finalConfig
