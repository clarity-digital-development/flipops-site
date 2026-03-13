import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps vs Project Management Tools | FlipOps',
  description:
    'See how FlipOps compares to rehab project management tools. Lead generation, deal pipeline, and scoring they don\'t have.',
  openGraph: {
    title: 'FlipOps vs Project Management Tools | FlipOps',
    description:
      'See how FlipOps compares to rehab project management tools. Lead generation, deal pipeline, and scoring they don\'t have.',
  },
};

export default function VsProjectToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
