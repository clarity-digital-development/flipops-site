import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tool Stack Savings Calculator | FlipOps',
  description:
    'Calculate how much you\'re spending on disconnected real estate investing tools. See your potential savings with an all-in-one platform.',
  openGraph: {
    title: 'Tool Stack Savings Calculator | FlipOps',
    description:
      'Calculate how much you\'re spending on disconnected real estate investing tools. See your potential savings with an all-in-one platform.',
  },
};

export default function SavingsCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
