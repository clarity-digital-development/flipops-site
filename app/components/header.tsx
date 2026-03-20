'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/app/components/theme-toggle';

interface DropdownItem {
  href: string;
  label: string;
}

interface NavDropdown {
  label: string;
  items: DropdownItem[];
}

const dropdowns: NavDropdown[] = [
  {
    label: 'Features',
    items: [
      { href: '/features', label: 'Overview' },
      { href: '/features/distress-scoring', label: 'Distress Scoring' },
      { href: '/features/deal-pipeline', label: 'Deal Pipeline' },
      { href: '/features/mao-calculator', label: 'MAO Calculator' },
      { href: '/features/property-management', label: 'Property Management' },
      { href: '/features/guardrails', label: 'Guardrails' },
    ],
  },
  {
    label: 'For Investors',
    items: [
      { href: '/for/wholesalers', label: 'For Wholesalers' },
      { href: '/for/fix-and-flippers', label: 'For Fix-and-Flippers' },
      { href: '/for/brrrr-investors', label: 'For BRRRR Investors' },
    ],
  },
  {
    label: 'Compare',
    items: [
      { href: '/compare/vs-traditional-crms', label: 'vs. Traditional Investor CRMs' },
      { href: '/compare/vs-data-platforms', label: 'vs. Data-Only Platforms' },
      { href: '/compare/vs-project-tools', label: 'vs. Project Management Tools' },
    ],
  },
];

const staticLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
];

function NavDropdownMenu({ dropdown, isScrolled }: { dropdown: NavDropdown; isScrolled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
          isScrolled
            ? 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {dropdown.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 pt-2 z-50">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl py-2 min-w-[220px]">
            {dropdown.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMenuDropdown({
  dropdown,
  onNavigate,
}: {
  dropdown: NavDropdown;
  onNavigate: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        className="flex items-center justify-between w-full py-4 text-lg font-medium text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {dropdown.label}
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-3 pl-4 pb-4">
          {dropdown.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-base text-gray-400 hover:text-white transition-colors"
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled ? 'pt-3' : ''
      }`}
    >
      <div className={`transition-all duration-300 ${
        isScrolled
          ? 'max-w-6xl mx-auto bg-white/95 dark:bg-black/95 backdrop-blur-md border border-gray-200 dark:border-zinc-800 shadow-lg rounded-full px-4 sm:px-8'
          : 'container mx-auto px-4'
      }`}>
        <nav className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FlipOps
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {dropdowns.map((dropdown) => (
              <NavDropdownMenu key={dropdown.label} dropdown={dropdown} isScrolled={isScrolled} />
            ))}
            {staticLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
            <Link href="/app">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-zinc-800" size="sm">
                View Demo
              </Button>
            </Link>
            <Link href="/reserve">
              <Button className="ml-2 bg-gradient-to-r from-primary to-accent hover:brightness-110 shadow-lg shadow-primary/25" size="sm">
                Reserve Your Spot
              </Button>
            </Link>
          </div>

          {/* Mobile Navigation Toggle */}
          <button
            className="lg:hidden p-2 -mr-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </nav>
      </div>

      {/* Full-screen mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-0 z-[60] bg-[#0a0a0a]">
          {/* Header row */}
          <div className="flex items-center justify-between h-16 px-4">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
            >
              FlipOps
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                className="p-2 -mr-2 text-white"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Menu content */}
          <nav className="px-6 pt-4 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 4rem)' }}>
            {dropdowns.map((dropdown) => (
              <MobileMenuDropdown
                key={dropdown.label}
                dropdown={dropdown}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            ))}
            {staticLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block py-4 text-lg font-medium text-white border-b border-white/10"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            {/* CTAs */}
            <div className="flex flex-col gap-3 mt-8">
              <Link href="/app" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full text-base border-white/20 text-white hover:bg-white/10">
                  View Demo
                </Button>
              </Link>
              <Link href="/reserve" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full text-base bg-gradient-to-r from-primary to-accent hover:brightness-110">
                  Reserve Your Spot
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
