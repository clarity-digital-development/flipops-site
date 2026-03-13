import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Margin Alerts | FlipOps',
  description:
    'Real-time margin monitoring across every deal. Know the moment your projected profit drops below target — and understand exactly what caused it.',
  openGraph: {
    title: 'Margin Alerts | FlipOps',
    description:
      'Real-time margin monitoring across every deal. Know the moment your projected profit drops below target — and understand exactly what caused it.',
  },
};

export default function MarginAlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
