import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps for Wholesalers | Close More Deals',
  description:
    'Score distressed properties, auto-trace motivated sellers, and manage your assignment pipeline. Built for high-volume wholesale investors.',
  openGraph: {
    title: 'FlipOps for Wholesalers | Close More Deals',
    description:
      'Score distressed properties, auto-trace motivated sellers, and manage your assignment pipeline. Built for high-volume wholesale investors.',
  },
};

export default function WholesalersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
