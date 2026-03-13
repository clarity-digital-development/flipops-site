import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features | FlipOps',
  description:
    'Everything you need to find, analyze, close, and manage real estate investments. Explore FlipOps features across the full investment lifecycle.',
  openGraph: {
    title: 'Features | FlipOps',
    description:
      'Everything you need to find, analyze, close, and manage real estate investments. Explore FlipOps features across the full investment lifecycle.',
  },
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
