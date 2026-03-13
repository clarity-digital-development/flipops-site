import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FlipOps for Fix-and-Flippers | Protect Your Margins',
  description:
    'From acquisition to sale, protect your margins on every flip. Budget tracking, renovation management, and margin alerts keep your deals profitable.',
  openGraph: {
    title: 'FlipOps for Fix-and-Flippers | Protect Your Margins',
    description:
      'From acquisition to sale, protect your margins on every flip. Budget tracking, renovation management, and margin alerts keep your deals profitable.',
  },
};

export default function FixAndFlippersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
