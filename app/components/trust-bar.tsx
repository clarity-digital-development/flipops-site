'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Shield, Zap } from 'lucide-react';

const trustItems = [
  { icon: Database, text: "Powered by CoreLogic's 157M+ property database" },
  { icon: Shield, text: 'Built by an active real estate investor' },
  { icon: Zap, text: 'Real-time distress scoring across all 50 states' },
];

/* ------------------------------------------------------------------ */
/*  Canvas dust particles                                              */
/* ------------------------------------------------------------------ */

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
  const dimsRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      dimsRef.current = { w, h };
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    const createParticle = (side: 'left' | 'right'): Particle => {
      const { w, h } = dimsRef.current;
      const spawnX = side === 'left'
        ? Math.random() * 60
        : w - Math.random() * 60;
      const spawnY = h * 0.1 + Math.random() * h * 0.8;
      const baseVx = side === 'left'
        ? 0.2 + Math.random() * 0.4
        : -(0.2 + Math.random() * 0.4);

      return {
        x: spawnX,
        y: spawnY,
        vx: baseVx,
        vy: (Math.random() - 0.5) * 0.3,
        size: 0.6 + Math.random() * 1.2,
        opacity: 0.4 + Math.random() * 0.5,
        maxLife: 140 + Math.random() * 100,
        life: 0,
        side,
      };
    };

    // Initialize
    for (let i = 0; i < 35; i++) {
      const side = i % 2 === 0 ? 'left' : 'right';
      const p = createParticle(side);
      p.life = Math.random() * p.maxLife;
      particlesRef.current.push(p);
    }

    const animate = () => {
      const { w, h } = dimsRef.current;
      ctx.clearRect(0, 0, w, h);

      particlesRef.current.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const ratio = p.life / p.maxLife;
        let alpha = p.opacity;
        if (ratio < 0.1) alpha *= ratio / 0.1;
        else if (ratio > 0.6) alpha *= 1 - (ratio - 0.6) / 0.4;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        if (p.life >= p.maxLife) {
          particlesRef.current[i] = createParticle(p.side);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      ro.disconnect();
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

/* ------------------------------------------------------------------ */
/*  TrustBar                                                           */
/* ------------------------------------------------------------------ */

export function TrustBar() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [glowVisible, setGlowVisible] = useState(false);
  const prevDarkMode = useRef<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (prevDarkMode.current === null) {
      prevDarkMode.current = isDarkMode;
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
    <section className="relative py-6 bg-white dark:bg-black overflow-hidden">
      {/* Dark mode: side-light glows + dust particles */}
      {isDarkMode && (
        <>
          <DustParticles />

          {/* LEFT — bright glow, contained within section */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              width: '35%',
              background: 'radial-gradient(ellipse 100% 160% at 0% 50%, rgba(45, 212, 191, 0.45) 0%, rgba(45, 212, 191, 0.1) 40%, transparent 80%)',
              opacity: glowVisible ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}
          />

          {/* RIGHT — bright glow, contained within section */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: 0,
              bottom: 0,
              right: 0,
              width: '35%',
              background: 'radial-gradient(ellipse 100% 160% at 100% 50%, rgba(56, 189, 248, 0.45) 0%, rgba(56, 189, 248, 0.1) 40%, transparent 80%)',
              opacity: glowVisible ? 1 : 0,
              transition: 'opacity 0.8s ease 0.1s',
            }}
          />
        </>
      )}

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10"
        >
          {trustItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
