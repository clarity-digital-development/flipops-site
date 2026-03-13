import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guardrails & Margin Protection | FlipOps',
  description:
    'Built-in financial guardrails that watch for budget overruns, missed deadlines, and margin erosion. Every alert exists because we\'ve lost money without it.',
  openGraph: {
    title: 'Guardrails & Margin Protection | FlipOps',
    description:
      'Built-in financial guardrails that watch for budget overruns, missed deadlines, and margin erosion. Every alert exists because we\'ve lost money without it.',
  },
};

export default function GuardrailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
