import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deal Pipeline | FlipOps',
  description:
    'Track every deal from first contact to final disposition. Five-stage pipeline with automated tracking, deadline alerts, and real-time analytics.',
  openGraph: {
    title: 'Deal Pipeline | FlipOps',
    description:
      'Track every deal from first contact to final disposition. Five-stage pipeline with automated tracking, deadline alerts, and real-time analytics.',
  },
};

export default function DealPipelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
