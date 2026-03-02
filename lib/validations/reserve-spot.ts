import { z } from 'zod';

// Re-export shared constants from the original reservation module
export { FEATURE_INTERESTS, US_STATES } from './reservation';

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
});

export type ReserveSpotInput = z.infer<typeof reserveSpotSchema>;
