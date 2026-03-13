import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | FlipOps',
  description:
    'Insights, guides, and strategies for real estate investors. Learn about distress scoring, deal analysis, renovation management, and building a profitable portfolio.',
  openGraph: {
    title: 'Blog | FlipOps',
    description:
      'Insights, guides, and strategies for real estate investors. Learn about distress scoring, deal analysis, renovation management, and building a profitable portfolio.',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
