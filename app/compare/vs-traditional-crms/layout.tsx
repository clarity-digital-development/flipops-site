import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps vs Traditional RE Investor CRMs | FlipOps',
  description:
    'See how FlipOps compares to traditional real estate investor CRMs. ML-powered scoring, post-close management, and financial guardrails they don\'t have.',
  openGraph: {
    title: 'FlipOps vs Traditional RE Investor CRMs | FlipOps',
    description:
      'See how FlipOps compares to traditional real estate investor CRMs. ML-powered scoring, post-close management, and financial guardrails they don\'t have.',
  },
};

export default function VsTraditionalCRMsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
