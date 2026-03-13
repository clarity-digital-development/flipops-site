import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Renovation & Rehab Tracking | FlipOps',
  description: 'Track renovation budgets across 12+ categories with real-time variance reporting. Catch overruns at $500, not $5,000.',
  openGraph: {
    title: 'Renovation & Rehab Tracking | FlipOps',
    description: 'Category-level budget tracking, vendor assignment, timeline management, and photo documentation for every rehab project.',
  },
};

export default function RehabTrackingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
