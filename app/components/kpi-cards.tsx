'use client';

import { motion } from 'framer-motion';
import { metrics } from '@/app/data/features';
import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxLife: number;
  life: number;
  side: 'left' | 'right';
}

function DustParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createParticle = (side: 'left' | 'right'): Particle => {
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvas.offsetHeight;

      // Spawn near the edges with some randomness
      const spawnX = side === 'left'
        ? Math.random() * 80
        : canvasWidth - Math.random() * 80;

      const spawnY = canvasHeight * 0.2 + Math.random() * canvasHeight * 0.6;

      // Move away from light source (inward)
      const baseVx = side === 'left' ? 0.3 + Math.random() * 0.5 : -(0.3 + Math.random() * 0.5);
      const vy = (Math.random() - 0.5) * 0.3;

      return {
        x: spawnX,
        y: spawnY,
        vx: baseVx,
        vy,
        size: 0.6 + Math.random() * 1.0,
        opacity: 0.4 + Math.random() * 0.4,
        maxLife: 150 + Math.random() * 100,
        life: 0,
        side,
      };
    };

    // Initialize particles
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? 'left' : 'right';
      const particle = createParticle(side);
      particle.life = Math.random() * particle.maxLife; // Stagger initial positions
      particlesRef.current.push(particle);
    }

    const animate = () => {
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvas.offsetHeight;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        // Calculate opacity based on life (fade in then fade out)
        const lifeRatio = particle.life / particle.maxLife;
        let opacity = particle.opacity;

        // Fade in for first 10%
        if (lifeRatio < 0.1) {
          opacity *= lifeRatio / 0.1;
        }
        // Fade out for last 40%
        else if (lifeRatio > 0.6) {
          opacity *= 1 - ((lifeRatio - 0.6) / 0.4);
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();

        // Reset particle if dead
        if (particle.life >= particle.maxLife) {
          particlesRef.current[index] = createParticle(particle.side);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

export function KPICards() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [glowVisible, setGlowVisible] = useState(false);
  const prevDarkMode = useRef<boolean | null>(null);

  // Dark mode detection
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Animate glow in when dark mode toggles on
  useEffect(() => {
    if (prevDarkMode.current === null) {
      prevDarkMode.current = isDarkMode;
      // If already dark on mount, show immediately
      if (isDarkMode) setGlowVisible(true);
      return;
    }
    if (isDarkMode && !prevDarkMode.current) {
      setGlowVisible(false);
      requestAnimationFrame(() => {
        setTimeout(() => setGlowVisible(true), 50);
      });
    } else if (!isDarkMode) {
      setGlowVisible(false);
    }
    prevDarkMode.current = isDarkMode;
  }, [isDarkMode]);

  return (
    <section className="relative pt-8 pb-16 bg-white dark:bg-black overflow-hidden">
      {/* Dark mode only: particles, glows, vignettes */}
      {isDarkMode && (
        <>
          <DustParticles />

          {/* Left glow - brightest at left edge */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-40%',
              bottom: '-40%',
              left: '-10%',
              width: '50%',
              background: `radial-gradient(ellipse 70% 40% at 0% 50%, rgba(45, 212, 191, 0.25) 0%, transparent 100%)`,
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
              opacity: glowVisible ? 1 : 0,
              transition: 'opacity 1s ease',
            }}
          />

          {/* Right glow - brightest at right edge */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-40%',
              bottom: '-40%',
              right: '-10%',
              width: '50%',
              background: `radial-gradient(ellipse 70% 40% at 100% 50%, rgba(56, 189, 248, 0.25) 0%, transparent 100%)`,
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
              opacity: glowVisible ? 1 : 0,
              transition: 'opacity 1s ease 0.15s',
            }}
          />

          {/* Vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 70% 100% at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,1) 100%)`,
            }}
          />

          {/* Subtle bottom vignette */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent z-[1]" />
        </>
      )}

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Built by an active investor
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {metric.value}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}