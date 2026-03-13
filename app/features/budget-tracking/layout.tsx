import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Budget & Financial Tracking | FlipOps',
  description:
    'Deal-level P&L, category-level budgets, holding cost calculations, and portfolio-level financials. Every dollar tracked from acquisition through disposition.',
  openGraph: {
    title: 'Budget & Financial Tracking | FlipOps',
    description:
      'Deal-level P&L, category-level budgets, holding cost calculations, and portfolio-level financials. Every dollar tracked from acquisition through disposition.',
  },
};

export default function BudgetTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
