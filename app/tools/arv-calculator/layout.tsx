import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free ARV Calculator | After-Repair Value | FlipOps',
  description:
    'Estimate the after-repair value of any investment property. Free ARV calculator for real estate investors — compare comp sales and calculate property value.',
  openGraph: {
    title: 'Free ARV Calculator | After-Repair Value | FlipOps',
    description:
      'Estimate the after-repair value of any investment property. Free ARV calculator for real estate investors — compare comp sales and calculate property value.',
  },
};

export default function ARVCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
