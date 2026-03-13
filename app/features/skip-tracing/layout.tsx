import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Automated Skip Tracing | FlipOps',
  description: 'Owner contact info, automatically. Skip tracing fires only when properties cross your score threshold — so you never pay to trace leads you wouldn\'t pursue.',
  openGraph: {
    title: 'Automated Skip Tracing | FlipOps',
    description: 'Owner contact info, automatically. Score-triggered skip tracing eliminates wasted spend on low-quality leads.',
  },
};

export default function SkipTracingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
