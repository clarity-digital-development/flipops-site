import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/app/',
          '/api/',
          '/sign-in/',
          '/sign-up/',
          '/admin/',
          '/debug-clerk/',
          '/test-minimal/',
          '/not-authorized/',
          '/__overflow-debug/',
        ],
      },
    ],
    sitemap: 'https://flipops.io/sitemap.xml',
  };
}
