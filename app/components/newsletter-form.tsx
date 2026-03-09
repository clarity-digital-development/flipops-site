'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm mt-1">
        <CheckCircle2 className="h-4 w-4" />
        You&apos;re subscribed!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 h-9 text-sm"
        required
      />
      <Button
        type="submit"
        size="sm"
        disabled={status === 'loading'}
        aria-label={status === 'loading' ? 'Subscribing...' : 'Subscribe to newsletter'}
        className="bg-gradient-to-r from-primary to-accent hover:brightness-110 shrink-0 h-9 px-3"
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </Button>
      {status === 'error' && (
        <p className="text-xs text-red-400 absolute mt-10">Something went wrong</p>
      )}
    </form>
  );
}
