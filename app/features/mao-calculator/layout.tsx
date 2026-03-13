import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MAO Calculator & Underwriting | FlipOps',
  description:
    'Calculate your Maximum Allowable Offer in real-time. ARV, repair costs, holding costs, and margin protection — all connected to your deal pipeline.',
  openGraph: {
    title: 'MAO Calculator & Underwriting | FlipOps',
    description:
      'Calculate your Maximum Allowable Offer in real-time. ARV, repair costs, holding costs, and margin protection — all connected to your deal pipeline.',
  },
};

export default function MAOCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
