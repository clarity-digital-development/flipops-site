import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | FlipOps',
  description:
    'Frequently asked questions about FlipOps — pricing, features, data sources, and getting started.',
  openGraph: {
    title: 'FAQ | FlipOps',
    description:
      'Frequently asked questions about FlipOps — pricing, features, data sources, and getting started.',
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
