import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rental Management | FlipOps',
  description: 'Manage tenants, leases, maintenance, and portfolio financials — all connected to your acquisition and rehab data for a true picture of deal ROI.',
  openGraph: {
    title: 'Rental Management | FlipOps',
    description: 'Lease management, rent collection, maintenance workflows, and portfolio analytics in one platform.',
  },
};

export default function RentalManagementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
