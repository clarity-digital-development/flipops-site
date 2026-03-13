import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | FlipOps',
  description:
    'Transparent pricing for real estate investors. Plans that scale from solo operators to enterprise teams — no hidden fees.',
  openGraph: {
    title: 'Pricing | FlipOps',
    description:
      'Plans that scale with your portfolio. From $149/mo for new investors to enterprise solutions for high-volume teams.',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
