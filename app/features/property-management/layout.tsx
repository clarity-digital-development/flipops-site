import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Property Management | FlipOps',
  description:
    'Manage renovations, rentals, and vendors after close. Budget tracking, tenant management, and vendor performance — all connected to your deal data.',
  openGraph: {
    title: 'Property Management | FlipOps',
    description:
      'Manage renovations, rentals, and vendors after close. Budget tracking, tenant management, and vendor performance — all connected to your deal data.',
  },
};

export default function PropertyManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
