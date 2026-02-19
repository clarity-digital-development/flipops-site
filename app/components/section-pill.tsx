'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

interface SectionPillProps {
  children: ReactNode;
  className?: string;
  pillClassName?: string;
  glowColor?: string; // RGB values e.g. "45, 212, 191"
  staggerIndex?: number;
}

export function SectionPill({
  children,
  className = '',
  pillClassName = 'bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25',
  glowColor = '45, 212, 191',
  staggerIndex = 0,
}: SectionPillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);
  const prevDarkMode = useRef<boolean | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pillWidth, setPillWidth] = useState(0);

  // Dark mode detection via .dark class on <html>
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Re-trigger animation when dark mode is toggled ON
  useEffect(() => {
    // Skip the initial mount
    if (prevDarkMode.current === null) {
      prevDarkMode.current = isDarkMode;
      return;
    }
    // Only re-trigger when switching TO dark mode, and only if already scroll-triggered
    if (isDarkMode && !prevDarkMode.current && hasTriggered.current) {
      setIsAnimated(false);
      // Brief delay so the reset takes effect before re-animating
      const delay = staggerIndex * 175;
      requestAnimationFrame(() => {
        setTimeout(() => setIsAnimated(true), 50 + delay);
      });
    }
    prevDarkMode.current = isDarkMode;
  }, [isDarkMode, staggerIndex]);

  // Measure pill width
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const measure = () => setPillWidth(pill.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pill);
    return () => ro.disconnect();
  }, []);

  // Intersection Observer — scroll-triggered, triggerOnce
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasTriggered.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          const delay = staggerIndex * 175;
          setTimeout(() => setIsAnimated(true), delay);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [staggerIndex]);

  // Core bar gradient — bright line with white-hot center
  const coreBarGradient = `linear-gradient(90deg,
    transparent 0%,
    rgba(${glowColor}, 0.3) 10%,
    rgba(${glowColor}, 0.8) 30%,
    rgba(255, 255, 255, 0.85) 50%,
    rgba(${glowColor}, 0.8) 70%,
    rgba(${glowColor}, 0.3) 90%,
    transparent 100%
  )`;

  // Layer 1: Hotspot — tight, bright center right under bar
  const hotspotGradient = `radial-gradient(
    ellipse 200px 140px at 50% 0%,
    rgba(${glowColor}, 0.42) 0%,
    rgba(${glowColor}, 0.18) 40%,
    transparent 100%
  )`;

  // Layer 2: Inner cone — bridges hotspot to primary
  const innerConeGradient = `radial-gradient(
    ellipse 400px 320px at 50% 0%,
    rgba(${glowColor}, 0.30) 0%,
    rgba(${glowColor}, 0.15) 25%,
    rgba(${glowColor}, 0.06) 50%,
    transparent 100%
  )`;

  // Layer 3: Primary glow — main downward light cone
  const primaryGradient = `radial-gradient(
    ellipse 600px 500px at 50% 0%,
    rgba(${glowColor}, 0.28) 0%,
    rgba(${glowColor}, 0.16) 18%,
    rgba(${glowColor}, 0.07) 40%,
    rgba(${glowColor}, 0.02) 60%,
    transparent 100%
  )`;

  // Layer 4: Outer spread — softens the edge of primary
  const outerSpreadGradient = `radial-gradient(
    ellipse 800px 450px at 50% 0%,
    rgba(${glowColor}, 0.12) 0%,
    rgba(${glowColor}, 0.06) 30%,
    rgba(${glowColor}, 0.02) 55%,
    transparent 100%
  )`;

  // Layer 5: Ambient glow — wide, subtle atmosphere
  const ambientGradient = `radial-gradient(
    ellipse 1000px 550px at 50% 0%,
    rgba(${glowColor}, 0.10) 0%,
    rgba(${glowColor}, 0.04) 35%,
    transparent 100%
  )`;

  // Linear top masks — smooth the top edge so there's no hard line (from HTML demo)
  // Divs are oversized so gradient fades to zero before hitting side/bottom edges
  const maskTight = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 3%, black 10%, black 100%)';
  const maskMedium = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.2) 2%, rgba(0,0,0,0.5) 5%, black 10%, black 100%)';
  const maskWide = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 2%, rgba(0,0,0,0.4) 4%, rgba(0,0,0,0.7) 7%, black 12%, black 100%)';
  const maskAmbient = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 3%, rgba(0,0,0,0.7) 6%, black 12%, black 100%)';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex flex-col items-center ${className}`}
      style={{ overflow: 'visible' }}
    >
      {/* The pill */}
      <div
        ref={pillRef}
        className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium ${pillClassName}`}
        style={{ zIndex: 3 }}
      >
        {children}
      </div>

      {/* Core bright bar — matches pill width, tight gap below pill */}
      {isDarkMode && (
        <div
          style={{
            width: pillWidth > 0 ? `${pillWidth}px` : undefined,
            height: '2px',
            marginTop: '3px',
            position: 'relative',
            zIndex: 2,
            opacity: isAnimated ? 1 : 0,
            transform: isAnimated ? 'scaleX(1)' : 'scaleX(0.15)',
            transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            background: coreBarGradient,
            borderRadius: '2px',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* 5 glow layers — positioned just above bottom of wrapper, masked to prevent upward bleed */}
      {isDarkMode && (
        <>
          {/* Layer 1: Hotspot — tight bright center */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '550px',
              height: '300px',
              zIndex: 1,
              pointerEvents: 'none',
              opacity: isAnimated ? 1 : 0,
              transition: 'opacity 0.7s ease 0.05s',
              background: hotspotGradient,
              WebkitMaskImage: maskTight,
              maskImage: maskTight,
            }}
          />

          {/* Layer 2: Inner cone — bridges hotspot to primary */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '950px',
              height: '650px',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: isAnimated ? 1 : 0,
              transition: 'opacity 0.85s ease 0.08s',
              background: innerConeGradient,
              WebkitMaskImage: maskMedium,
              maskImage: maskMedium,
            }}
          />

          {/* Layer 3: Primary glow — main downward cone */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '1400px',
              height: '1050px',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: isAnimated ? 1 : 0,
              transition: 'opacity 1s ease 0.1s',
              background: primaryGradient,
              WebkitMaskImage: maskWide,
              maskImage: maskWide,
            }}
          />

          {/* Layer 4: Outer spread — softens primary edge */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '1850px',
              height: '950px',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: isAnimated ? 1 : 0,
              transition: 'opacity 1.15s ease 0.18s',
              background: outerSpreadGradient,
              WebkitMaskImage: maskWide,
              maskImage: maskWide,
            }}
          />

          {/* Layer 5: Ambient — wide subtle atmosphere */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '2300px',
              height: '1150px',
              zIndex: 0,
              pointerEvents: 'none',
              opacity: isAnimated ? 1 : 0,
              transition: 'opacity 1.3s ease 0.25s',
              background: ambientGradient,
              WebkitMaskImage: maskAmbient,
              maskImage: maskAmbient,
            }}
          />
        </>
      )}
    </div>
  );
}
