'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/app/components/theme-toggle';

const navItems = [
  { href: '#scoring', label: 'Lead Scoring' },
  { href: '#features', label: 'Features' },
  { href: '#savings', label: 'Savings' },
  { href: '#guardrails', label: 'Guardrails' },
  { href: '#pricing', label: 'Pricing' },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled ? 'pt-3' : ''
      }`}
    >
      <div className={`transition-all duration-300 ${
        isScrolled
          ? 'max-w-6xl mx-auto bg-white/95 dark:bg-black/95 backdrop-blur-md border border-gray-200 dark:border-zinc-800 shadow-lg rounded-full px-8'
          : 'container mx-auto px-4'
      }`}>
        <nav className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FlipOps
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSection(e, item.href)}
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

          {/* Mobile Navigation */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[270px] sm:w-[360px]">
              <nav className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => scrollToSection(e, item.href)}
                    className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/app" className="w-full">
                  <Button variant="ghost" className="mt-4 w-full text-blue-600">View Demo</Button>
                </Link>
                <Link href="/reserve" className="w-full">
                  <Button className="mt-2 w-full">Reserve Your Spot</Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}