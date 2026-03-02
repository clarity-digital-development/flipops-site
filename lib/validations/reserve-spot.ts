import { z } from 'zod';

// Re-export shared constants from the original reservation module
export { FEATURE_INTERESTS, US_STATES } from './reservation';

export const CRM_OPTIONS = [
  { value: 'none', label: 'None / Spreadsheets' },
  { value: 'podio', label: 'Podio' },
  { value: 'reisift', label: 'REISift' },
  { value: 'propstream', label: 'PropStream' },
  { value: 'investornest', label: 'InvestorNest' },
  { value: 'freedomsoft', label: 'FreedomSoft' },
  { value: 'realeflow', label: 'Realeflow' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'other', label: 'Other' },
] as const;

export const EMPLOYEE_RANGES = [
  { value: 'solo', label: 'Just me' },
  { value: '2-5', label: '2–5' },
  { value: '6-15', label: '6–15' },
  { value: '16-50', label: '16–50' },
  { value: '50+', label: '50+' },
] as const;

export const HOUSES_FLIPPED_RANGES = [
  { value: '0', label: '0 (getting started)' },
  { value: '1-5', label: '1–5' },
  { value: '6-15', label: '6–15' },
  { value: '16-30', label: '16–30' },
  { value: '31-50', label: '31–50' },
  { value: '50+', label: '50+' },
] as const;

export const REVENUE_RANGES = [
  { value: 'under-100k', label: 'Under $100K' },
  { value: '100k-500k', label: '$100K–$500K' },
  { value: '500k-1m', label: '$500K–$1M' },
  { value: '1m-5m', label: '$1M–$5M' },
  { value: '5m+', label: '$5M+' },
] as const;

export const reserveSpotSchema = z.object({
  // New fields
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  company: z.string().max(200).optional().default(''),
  // Existing fields
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(7, 'Please enter a valid phone number').optional().or(z.literal('')),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'Please select a state'),
  featureInterests: z.array(z.string()).optional().default([]),
  feedback: z.string().max(2000, 'Feedback must be under 2000 characters').optional().or(z.literal('')),
  // ICP enrichment (all optional)
  employees: z.string().optional().default(''),
  housesFlipped: z.string().optional().default(''),
  annualRevenue: z.string().optional().default(''),
  currentCrm: z.string().optional().default(''),
});

export type ReserveSpotInput = z.infer<typeof reserveSpotSchema>;
