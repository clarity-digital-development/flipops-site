import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Distress Scoring & Behavioral Learning | FlipOps',
  description:
    'ML-powered property scoring that learns your investment strategy. 15+ distress signals scored across 157M+ properties. Only 1.5% of investor leads become deals — FlipOps fixes that.',
  openGraph: {
    title: 'AI Distress Scoring & Behavioral Learning | FlipOps',
    description:
      'ML-powered property scoring that learns your investment strategy. 15+ distress signals scored across 157M+ properties powered by CoreLogic.',
  },
};

export default function DistressScoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
