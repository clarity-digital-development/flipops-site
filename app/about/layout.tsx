import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About FlipOps | Built by an Active Investor',
  description:
    'FlipOps was born from frustration with disconnected tools. Built by an active real estate investor to replace the patchwork of apps investors cobble together.',
  openGraph: {
    title: 'About FlipOps | Built by an Active Investor',
    description:
      'One investor. Six disconnected tools. One platform that replaces them all. The story behind FlipOps.',
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
