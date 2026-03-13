import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps for BRRRR Investors | Full Lifecycle Platform',
  description:
    'Buy, rehab, rent, refinance, repeat — all in one platform. From distressed property to cash-flowing rental with complete data continuity.',
  openGraph: {
    title: 'FlipOps for BRRRR Investors | Full Lifecycle Platform',
    description:
      'Buy, rehab, rent, refinance, repeat — all in one platform. From distressed property to cash-flowing rental with complete data continuity.',
  },
};

export default function BRRRRInvestorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
