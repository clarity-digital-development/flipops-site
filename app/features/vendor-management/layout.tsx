import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendor Management | FlipOps',
  description: 'Build a curated, performance-tested contractor network. Track on-time rates, budget accuracy, and quality across every project.',
  openGraph: {
    title: 'Vendor Management | FlipOps',
    description: 'Centralized vendor database with performance scoring, specialty tagging, and cross-deal comparison.',
  },
};

export default function VendorManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
