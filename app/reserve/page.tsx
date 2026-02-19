'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionPill } from '@/app/components/section-pill';
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  Brain,
  BarChart3,
  Calculator,
  Wrench,
  Shield,
  Kanban,
  LineChart,
  Users,
  Loader2,
  MessageSquareText,
  Rocket,
} from 'lucide-react';
import {
  FEATURE_INTERESTS,
  US_STATES,
  reservationSchema,
} from '@/lib/validations/reservation';

const FEATURE_ICONS: Record<string, React.ElementType> = {
  lead_scoring: Brain,
  comps_arv: BarChart3,
  mao_calculator: Calculator,
  repair_estimation: Wrench,
  guardrails_compliance: Shield,
  deal_pipeline_crm: Kanban,
  exit_strategy: LineChart,
  team_management: Users,
};

interface FormData {
  email: string;
  phone: string;
  city: string;
  state: string;
  featureInterests: string[];
  feedback: string;
}

interface SubmitResult {
  success: boolean;
  providedFeedback: boolean;
  trialGranted: boolean;
  betaAccess: boolean;
  message: string;
}

export default function ReservePage() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    phone: '',
    city: '',
    state: '',
    featureInterests: [],
    feedback: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dark mode detection for 3D card styling
  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const toggleFeature = (key: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      featureInterests: checked
        ? [...prev.featureInterests, key]
        : prev.featureInterests.filter((k) => k !== key),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = reservationSchema.safeParse(formData);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors as Record<string, string[]>);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reserve');

      setSubmitResult(data);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f6] dark:bg-black">
      {/* Minimal header */}
      <header className="fixed top-0 z-50 w-full">
        <div className="container mx-auto px-4">
          <nav className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                FlipOps
              </span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-24 pb-16 lg:pt-32 lg:pb-24">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* Hero heading */}
              <div className="text-center max-w-2xl mx-auto mb-10">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="mb-6 flex justify-center"
                >
                  <SectionPill
                    pillClassName="bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25"
                    glowColor="45, 212, 191"
                    staggerIndex={0}
                  >
                    <Rocket className="h-4 w-4" />
                    Early Access
                  </SectionPill>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="text-4xl lg:text-6xl font-bold mb-4"
                >
                  <span className="text-gray-900 dark:text-white glow-heading-teal">
                    Reserve Your{' '}
                  </span>
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Spot
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                  className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed"
                >
                  Join the first wave of investors using algorithmic intelligence
                  to find better deals, faster.
                </motion.p>
              </div>

              {/* Incentive banner */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="max-w-2xl mx-auto mb-8"
              >
                <div
                  className="flex items-center gap-3 px-5 py-3.5 rounded-xl"
                  style={isDarkMode ? {
                    background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
                    boxShadow: [
                      '0 0 0 1px rgba(245, 158, 11, 0.15)',
                      'inset 0 1px 0 rgba(245, 158, 11, 0.08)',
                      'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                      '0 2px 4px rgba(0, 0, 0, 0.2)',
                      '0 4px 12px rgba(0, 0, 0, 0.15)',
                    ].join(', '),
                  } : {
                    background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
                    boxShadow: [
                      '0 0 0 1px rgba(245, 158, 11, 0.15)',
                      'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      'inset 0 -1px 0 rgba(0, 0, 0, 0.03)',
                      '0 1px 2px rgba(0, 0, 0, 0.03)',
                      '0 2px 8px rgba(0, 0, 0, 0.04)',
                    ].join(', '),
                  }}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-500/15 dark:bg-amber-500/10 flex items-center justify-center">
                    <Gift className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-300/90">
                    <span className="font-semibold">Share your feedback</span>{' '}
                    below and unlock{' '}
                    <span className="font-semibold">1 free month + full beta access</span>{' '}
                    when we launch.
                  </p>
                </div>
              </motion.div>

              {/* Form card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="max-w-2xl mx-auto"
              >
                <form onSubmit={handleSubmit}>
                  <div
                    className="rounded-xl p-6 lg:p-8 space-y-8"
                    style={isDarkMode ? {
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.02) 100%)',
                      border: 'none',
                      boxShadow: [
                        '0 0 0 1px rgba(255, 255, 255, 0.08)',
                        'inset 0 1px 0 rgba(255, 255, 255, 0.10)',
                        'inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
                        '0 2px 4px rgba(0, 0, 0, 0.3)',
                        '0 8px 24px rgba(0, 0, 0, 0.45)',
                        '0 20px 50px rgba(0, 0, 0, 0.35)',
                      ].join(', '),
                    } : {
                      background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
                      border: 'none',
                      boxShadow: [
                        '0 0 0 1px rgba(0, 0, 0, 0.06)',
                        'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                        'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                        '0 1px 2px rgba(0, 0, 0, 0.04)',
                        '0 4px 12px rgba(0, 0, 0, 0.06)',
                        '0 12px 32px rgba(0, 0, 0, 0.04)',
                      ].join(', '),
                    }}
                  >
                    {/* Section 1: Contact Info */}
                    <div className="space-y-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                        <Mail className="h-4 w-4 text-primary" />
                        Contact Information
                      </div>

                      <div className="space-y-4">
                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="email">
                            Email <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={formData.email}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                            aria-invalid={!!errors.email}
                          />
                          {errors.email && (
                            <p className="text-xs text-destructive">
                              {errors.email[0]}
                            </p>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone (optional)</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={formData.phone}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                phone: e.target.value,
                              }))
                            }
                          />
                        </div>

                        {/* City / State row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="city">
                              City <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="city"
                              placeholder="Jacksonville"
                              value={formData.city}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  city: e.target.value,
                                }))
                              }
                              aria-invalid={!!errors.city}
                            />
                            {errors.city && (
                              <p className="text-xs text-destructive">
                                {errors.city[0]}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>
                              State <span className="text-destructive">*</span>
                            </Label>
                            <Select
                              value={formData.state}
                              onValueChange={(value) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  state: value,
                                }))
                              }
                            >
                              <SelectTrigger
                                className="w-full"
                                aria-invalid={!!errors.state}
                              >
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.state && (
                              <p className="text-xs text-destructive">
                                {errors.state[0]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div
                      className="h-px"
                      style={isDarkMode
                        ? { background: 'rgba(255,255,255,0.06)', boxShadow: '0 1px 0 rgba(0,0,0,0.4)' }
                        : { background: 'rgba(0,0,0,0.06)', boxShadow: '0 1px 0 rgba(255,255,255,0.5)' }
                      }
                    />

                    {/* Section 2: Feature Interests */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                        <Sparkles className="h-4 w-4 text-primary" />
                        What features interest you most?
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select any that apply — this helps us prioritize what to build first.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {FEATURE_INTERESTS.map((feature) => {
                          const Icon =
                            FEATURE_ICONS[feature.key] || Sparkles;
                          const isChecked =
                            formData.featureInterests.includes(feature.key);
                          return (
                            <label
                              key={feature.key}
                              htmlFor={feature.key}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                isChecked
                                  ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                                  : 'border-transparent hover:border-border hover:bg-muted/30'
                              }`}
                            >
                              <Checkbox
                                id={feature.key}
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  toggleFeature(feature.key, !!checked)
                                }
                              />
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200 ${
                                    isChecked
                                      ? 'bg-primary/15 dark:bg-primary/20'
                                      : 'bg-muted dark:bg-muted/50'
                                  }`}
                                >
                                  <Icon
                                    className={`h-3.5 w-3.5 transition-colors duration-200 ${
                                      isChecked
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                    }`}
                                  />
                                </div>
                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                  {feature.label}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div
                      className="h-px"
                      style={isDarkMode
                        ? { background: 'rgba(255,255,255,0.06)', boxShadow: '0 1px 0 rgba(0,0,0,0.4)' }
                        : { background: 'rgba(0,0,0,0.06)', boxShadow: '0 1px 0 rgba(255,255,255,0.5)' }
                      }
                    />

                    {/* Section 3: Free-text feedback */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                        <MessageSquareText className="h-4 w-4 text-primary" />
                        Anything else we should know?
                      </div>

                      <div className="space-y-2">
                        <Textarea
                          id="feedback"
                          placeholder="Tell us about your investing strategy, pain points, or features you'd love to see..."
                          className="min-h-[100px]"
                          value={formData.feedback}
                          maxLength={2000}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              feedback: e.target.value,
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground text-right tabular-nums">
                          {formData.feedback.length} / 2,000
                        </p>
                      </div>
                    </div>

                    {/* Submit */}
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full text-base bg-gradient-to-r from-primary to-accent hover:brightness-110 shadow-lg shadow-primary/25"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Reserving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Reserve My Spot
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          ) : (
            /* Success state */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-lg mx-auto py-16 lg:py-24 px-8 lg:px-12 rounded-xl"
              style={isDarkMode ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.01) 100%)',
                boxShadow: [
                  '0 0 0 1px rgba(255, 255, 255, 0.06)',
                  'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                  '0 2px 4px rgba(0, 0, 0, 0.25)',
                  '0 8px 20px rgba(0, 0, 0, 0.35)',
                  '0 16px 40px rgba(0, 0, 0, 0.25)',
                ].join(', '),
              } : {
                background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
                boxShadow: [
                  '0 0 0 1px rgba(0, 0, 0, 0.06)',
                  'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  'inset 0 -1px 0 rgba(0, 0, 0, 0.04)',
                  '0 1px 2px rgba(0, 0, 0, 0.04)',
                  '0 4px 12px rgba(0, 0, 0, 0.06)',
                  '0 12px 32px rgba(0, 0, 0, 0.04)',
                ].join(', '),
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2,
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center mx-auto mb-8 shadow-lg shadow-primary/25"
              >
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>

              {submitResult?.providedFeedback ? (
                <>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-teal"
                  >
                    You&apos;re In!
                  </motion.h2>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-emerald-700 dark:text-emerald-400 mb-6"
                    style={isDarkMode ? {
                      background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%)',
                      boxShadow: [
                        '0 0 0 1px rgba(16, 185, 129, 0.2)',
                        'inset 0 1px 0 rgba(16, 185, 129, 0.1)',
                        '0 2px 4px rgba(0, 0, 0, 0.15)',
                      ].join(', '),
                    } : {
                      background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.04) 100%)',
                      boxShadow: [
                        '0 0 0 1px rgba(16, 185, 129, 0.2)',
                        'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                        '0 1px 2px rgba(0, 0, 0, 0.03)',
                      ].join(', '),
                    }}
                  >
                    <Gift className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      1-Month Free Trial + Full Beta Access Unlocked
                    </span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="text-muted-foreground mb-10"
                  >
                    Thank you for your feedback! We&apos;ll email you at{' '}
                    <span className="font-medium text-foreground">
                      {formData.email}
                    </span>{' '}
                    when beta access is ready.
                  </motion.p>
                </>
              ) : (
                <>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="text-4xl lg:text-5xl font-bold mb-4 text-gray-900 dark:text-white glow-heading-teal"
                  >
                    Spot Reserved!
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="text-muted-foreground mb-10"
                  >
                    We&apos;ll reach out to{' '}
                    <span className="font-medium text-foreground">
                      {formData.email}
                    </span>{' '}
                    when we&apos;re ready. Come back anytime to add your feedback
                    and unlock free beta access.
                  </motion.p>
                </>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Link href="/">
                  <Button variant="outline" size="lg" className="text-base">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
