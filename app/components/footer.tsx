import Link from 'next/link';
import { Mail } from 'lucide-react';
import { NewsletterForm } from './newsletter-form';

export function Footer() {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'FlipOps';
  const currentYear = new Date().getFullYear();

  const productLinks = [
    { href: '/features', label: 'Features' },
    { href: '/features/distress-scoring', label: 'Distress Scoring' },
    { href: '/features/deal-pipeline', label: 'Deal Pipeline' },
    { href: '/features/mao-calculator', label: 'MAO Calculator' },
    { href: '/features/guardrails', label: 'Guardrails' },
    { href: '/features/property-management', label: 'Property Management' },
    { href: '/pricing', label: 'Pricing' },
  ];

  const investorLinks = [
    { href: '/for/wholesalers', label: 'For Wholesalers' },
    { href: '/for/fix-and-flippers', label: 'For Fix-and-Flippers' },
    { href: '/for/brrrr-investors', label: 'For BRRRR Investors' },
  ];

  const resourceLinks = [
    { href: '/tools/mao-calculator', label: 'Free MAO Calculator' },
    { href: '/tools/arv-calculator', label: 'Free ARV Calculator' },
    { href: '/compare/vs-traditional-crms', label: 'FlipOps vs CRMs' },
    { href: '/compare/vs-data-platforms', label: 'FlipOps vs Data Tools' },
  ];

  const companyLinks = [
    { href: '/about', label: 'About' },
    { href: '/blog', label: 'Blog' },
    { href: '/demo', label: 'View Demo' },
    { href: '/faq', label: 'FAQ' },
  ];

  return (
    <footer className="bg-zinc-900 dark:bg-black border-t border-zinc-800 dark:border-zinc-900">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6 md:gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent inline-block mb-2">
              {brandName}
            </span>
            <p className="text-gray-400 mb-4">
              The Real Estate Investment Operating System.
            </p>
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Get investor insights delivered weekly.</p>
              <NewsletterForm />
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="font-semibold mb-4 text-white">Product</p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Investors */}
          <div>
            <p className="font-semibold mb-4 text-white">For Investors</p>
            <ul className="space-y-2">
              {investorLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="font-semibold mb-4 text-white">Resources</p>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="font-semibold mb-4 text-white">Company</p>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:info@flipops.io"
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              &copy; {currentYear} {brandName}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
