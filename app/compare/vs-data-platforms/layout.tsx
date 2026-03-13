import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps vs Data-Only Platforms | FlipOps',
  description:
    'See how FlipOps compares to property data platforms. Intelligence on top of data, plus deal execution tools and post-close management.',
  openGraph: {
    title: 'FlipOps vs Data-Only Platforms | FlipOps',
    description:
      'See how FlipOps compares to property data platforms. Intelligence on top of data, plus deal execution tools and post-close management.',
  },
};

export default function VsDataPlatformsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
