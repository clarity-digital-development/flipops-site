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

module.exports = nextConfig
