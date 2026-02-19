import Link from 'next/link';
import { Mail } from 'lucide-react';

export function Footer() {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'FlipOps';
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { href: '#scoring', label: 'Lead Scoring' },
    { href: '#features', label: 'Features' },
    { href: '#savings', label: 'Savings' },
    { href: '#guardrails', label: 'Guardrails' },
    { href: '#new-investors', label: 'New Investors' },
  ];

  return (
    <footer className="bg-zinc-900 dark:bg-black border-t border-zinc-800 dark:border-zinc-900">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent inline-block mb-2">
              {brandName}
            </span>
            <p className="text-gray-400 mb-4">
              Stop guessing, start knowing.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Contact</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:info@flipops.io"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  info@flipops.io
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © {currentYear} {brandName}. All rights reserved.
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
