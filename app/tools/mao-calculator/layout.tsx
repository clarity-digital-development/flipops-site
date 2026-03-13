import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free MAO Calculator | Maximum Allowable Offer | FlipOps',
  description:
    'Calculate your maximum allowable offer for any investment property. Free MAO calculator with transparent waterfall breakdown for real estate investors.',
  openGraph: {
    title: 'Free MAO Calculator | Maximum Allowable Offer | FlipOps',
    description:
      'Calculate your maximum allowable offer for any investment property. Free MAO calculator with transparent waterfall breakdown for real estate investors.',
  },
};

export default function MAOCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
