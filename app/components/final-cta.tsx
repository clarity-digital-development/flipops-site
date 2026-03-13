'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function FinalCTA() {
  return (
    <section className="py-16 lg:py-24 bg-gray-100 dark:bg-black">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Your next deal is already distressed. Find it first.
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join investors who score, analyze, close, and manage deals — all from one platform.
          </p>

          <Link href="/reserve">
            <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 text-base">
              Reserve Your Spot
            </Button>
          </Link>

          <p className="mt-6 text-sm text-muted-foreground">
            Plans start at $149/month.{' '}
            <Link href="/pricing" className="text-primary hover:underline font-medium">
              View pricing
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
