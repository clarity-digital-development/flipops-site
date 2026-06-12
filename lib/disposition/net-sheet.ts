/**
 * Disposition net-sheet pure library.
 *
 * Single source of truth for seller net-proceeds math, list-vs-ARV variance,
 * and the default listing-prep checklist. Imported by both the API routes
 * (app/api/disposition/**) and the disposition UI. Pure TypeScript — zero
 * imports, zero React, no I/O. All dollar outputs are rounded to whole dollars.
 */

export interface NetSheetInput {
  salePrice: number;
  commissionPct: number;
  closingCostPct: number;
  payoffAmount: number;
}

export interface NetSheetResult {
  salePrice: number;
  commission: number;
  closingCosts: number;
  payoff: number;
  netProceeds: number;
}

/**
 * Compute the seller net sheet for a given sale price.
 *
 * commission   = salePrice * commissionPct/100
 * closingCosts = salePrice * closingCostPct/100
 * payoff       = max(0, payoffAmount)   (negative payoffs clamped to 0)
 * netProceeds  = salePrice - commission - closingCosts - payoff
 *
 * Every dollar field on the result is rounded to the nearest whole dollar.
 */
export function computeNetSheet(input: NetSheetInput): NetSheetResult {
  const salePrice = Math.round(input.salePrice);
  const commission = Math.round((input.salePrice * input.commissionPct) / 100);
  const closingCosts = Math.round((input.salePrice * input.closingCostPct) / 100);
  const payoff = Math.round(Math.max(0, input.payoffAmount));
  const netProceeds = Math.round(
    input.salePrice -
      (input.salePrice * input.commissionPct) / 100 -
      (input.salePrice * input.closingCostPct) / 100 -
      Math.max(0, input.payoffAmount),
  );

  return { salePrice, commission, closingCosts, payoff, netProceeds };
}

export type VarianceDirection = 'above' | 'below' | 'inline';

export interface ListVsArvResult {
  listPrice: number;
  arv: number;
  diff: number;
  pct: number;
  direction: VarianceDirection;
}

/**
 * Compare a list price against ARV.
 *
 * Returns null when either input is non-positive (arv <= 0 or listPrice <= 0).
 * diff = listPrice - arv; pct = diff / arv (e.g. 0.047 for +4.7%).
 * direction is 'inline' when |pct| < threshold (default 1%), else
 * 'above' when diff > 0, otherwise 'below'.
 */
export function listVsArv(
  listPrice: number,
  arv: number,
  threshold: number = 0.01,
): ListVsArvResult | null {
  if (arv <= 0 || listPrice <= 0) return null;

  const diff = listPrice - arv;
  const pct = diff / arv;
  const direction: VarianceDirection =
    Math.abs(pct) < threshold ? 'inline' : diff > 0 ? 'above' : 'below';

  return { listPrice, arv, diff, pct, direction };
}

export interface PrepChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Canonical listing-prep checklist seeded onto new DispositionListings.
 * Order is load-bearing — the UI renders these in array order.
 */
export const DEFAULT_PREP_CHECKLIST: { key: string; label: string }[] = [
  { key: 'photos', label: 'Professional photos' },
  { key: 'clean', label: 'Deep clean' },
  { key: 'staging', label: 'Staging' },
  { key: 'lockbox', label: 'Lockbox installed' },
  { key: 'mls', label: 'MLS listing live' },
  { key: 'signage', label: 'Yard sign + marketing' },
];
