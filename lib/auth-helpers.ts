/**
 * Authentication helpers for API routes
 *
 * Legacy shim — delegates to the canonical requireUser() guard
 * (lib/auth/require-user.ts) so JIT user provisioning lives in ONE place.
 * M2.5: requireUser() now resolves identity via Auth.js (NextAuth v5)
 * sessions — this shim needed no changes. Prefer importing requireUser()
 * directly in new routes.
 */

import { requireUser } from '@/lib/auth/require-user';

export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

/**
 * Get the authenticated database user ID from the current session.
 * Returns the internal database user ID (not the Clerk ID).
 */
export async function getAuthenticatedUserId(): Promise<AuthResult> {
  try {
    const guard = await requireUser();

    if ('error' in guard) {
      const status = guard.error.status;
      return {
        success: false,
        error: status === 404 ? 'User not found' : 'Unauthorized',
        status,
      };
    }

    return { success: true, userId: guard.userId };
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: 'Authentication failed', status: 500 };
  }
}
