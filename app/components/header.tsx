'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
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

/* Animated hamburger icon — morphs between ☰ and ✕ */
function HamburgerIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      <span
        className={`absolute h-[2px] w-5 bg-current transition-all duration-300 ease-in-out ${
          isOpen ? 'rotate-45 translate-y-0' : '-translate-y-[6px]'
        }`}
      />
      <span
        className={`absolute h-[2px] w-5 bg-current transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
        }`}
      />
      <span
        className={`absolute h-[2px] w-5 bg-current transition-all duration-300 ease-in-out ${
          isOpen ? '-rotate-45 translate-y-0' : 'translate-y-[6px]'
        }`}
      />
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
    <div className="border-b border-gray-200 dark:border-white/10">
      <button
        className="flex items-center justify-between w-full py-4 text-lg font-medium text-gray-900 dark:text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {dropdown.label}
        <ChevronDown
          className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
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
              className="text-base text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
    <>
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled && !isMobileMenuOpen ? 'pt-3' : ''
      }`}
      style={{ paddingTop: isScrolled && !isMobileMenuOpen ? undefined : 'env(safe-area-inset-top)' }}
    >
      <div className={`transition-all duration-300 ${
        isScrolled
          ? 'max-w-6xl mx-auto bg-white/95 dark:bg-black/95 backdrop-blur-md border border-gray-200 dark:border-zinc-800 shadow-lg rounded-full px-4 sm:px-8'
          : 'container mx-auto px-4'
      }`}>
        <nav className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="FlipOps" width={108} height={35} className="dark:hidden" priority />
            <Image src="/logo-light.png" alt="FlipOps" width={108} height={35} className="hidden dark:block" priority />
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

          {/* Mobile Navigation Toggle — animated hamburger/X */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 -mr-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <HamburgerIcon isOpen={isMobileMenuOpen} />
            </button>
          </div>
        </nav>
      </div>

    </header>

    {/* Full-screen mobile menu overlay — rendered outside header for proper stacking */}
    <div
      style={{ zIndex: 200, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      className={`lg:hidden fixed inset-0 bg-white dark:bg-black transition-all duration-300 ease-in-out ${
        isMobileMenuOpen
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}
    >
      {/* Header row inside overlay */}
      <div className="flex items-center justify-between h-16 px-4">
        <Link
          href="/"
          onClick={() => setIsMobileMenuOpen(false)}
          className="flex items-center"
        >
          <Image src="/logo.png" alt="FlipOps" width={108} height={35} className="dark:hidden" />
          <Image src="/logo-light.png" alt="FlipOps" width={108} height={35} className="hidden dark:block" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2 -mr-2"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <HamburgerIcon isOpen={true} />
          </button>
        </div>
      </div>

      {/* Menu content */}
      <nav className="px-6 pt-2 pb-8 overflow-y-auto" style={{ height: 'calc(100dvh - 4rem)' }}>
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
            className="block py-4 text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}

        {/* CTAs */}
        <div className="flex flex-col gap-3 mt-8">
          <Link href="/app" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
            <Button variant="outline" className="w-full text-base border-gray-300 dark:border-white/20">
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
    </>
  );
}
