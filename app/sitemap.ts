import { MetadataRoute } from 'next';

const BASE_URL = 'https://flipops.io';

const blogSlugs = [
  'wholesale-disposition-strategies-close-faster',
  'real-estate-wholesaling-kpis',
  'how-to-find-motivated-sellers-beginners',
  'direct-mail-sequence-real-estate',
  'what-is-arv-after-repair-value',
  'dnc-compliance-skip-tracing-flipops',
  'true-cost-of-tool-sprawl-real-estate-investors',
  'mao-calculator-never-overpay-property',
  'brrrr-strategy-platforms-cover-half-lifecycle',
  'distress-signals-predict-motivated-sellers',
  'financial-guardrails-automation-portfolio',
  'how-to-pick-real-estate-market-flipping',
  'skip-tracing-workflow-that-converts',
  'lead-to-close-all-in-one-crm',
  'how-to-pick-your-next-acquisition-market',
  'best-real-estate-wholesaling-software-comparison',
  'how-to-analyze-a-real-estate-deal',
  'real-estate-investor-software-stack-tool-consolidation',
  'why-your-motivated-seller-list-isnt-converting',
  'what-doa-leads-cost-you-distress-scoring',
  'why-were-building-flipops',
  'how-to-build-a-buyers-list-real-estate',
  'what-is-wholesaling-real-estate',
  'ai-distress-scoring-changing-real-estate-investing',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const marketingPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/features`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/reserve`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/demo`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Audience landing pages
    {
      url: `${BASE_URL}/for/wholesalers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/for/fix-and-flippers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/for/brrrr-investors`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Free tools
    {
      url: `${BASE_URL}/tools/arv-calculator`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/tools/mao-calculator`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/tools/savings-calculator`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...marketingPages, ...blogPages];
}
