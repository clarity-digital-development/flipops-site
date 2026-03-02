'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';

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
            Ready to stop guessing which leads are worth your time?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join investors who use algorithmic intelligence to identify hot prospects before their competition does.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app">
              <Button size="lg" className="group bg-gradient-to-r from-primary to-accent hover:brightness-110 shadow-lg shadow-primary/25">
                <Play className="mr-2 h-4 w-4" />
                Try Live Demo
              </Button>
            </Link>
            <Link href="/reserve">
              <Button size="lg" variant="outline" className="group">
                Reserve Your Spot
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

        </motion.div>
      </div>
    </section>
  );
}