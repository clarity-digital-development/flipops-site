import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'View Demo | FlipOps',
  description:
    'See FlipOps in action. Walk through AI distress scoring, deal pipeline management, MAO calculator, and more — in under 5 minutes.',
  openGraph: {
    title: 'View Demo | FlipOps',
    description:
      'See the full real estate investment operating system in action. Self-guided demo or live walkthrough available.',
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
