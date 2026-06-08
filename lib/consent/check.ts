/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Consent check — TCPA gating helper.
//
// Used by the dialer-dispatch worker BEFORE the quiet-hours gate. Any
// outbound voice/SMS path that does NOT route through the dialer-dispatch
// queue must ALSO call hasConsent() before contacting a number.
//
// Returns true only when:
//   - A ConsentRecord exists for (userId, phoneNumber)
//   - consentType is "express" or "implied" (NOT "none" or "revoked")
//   - revokedAt is null
//
// Implied consent is included by default because it covers transactional
// callbacks (inbound caller leaves a voicemail, we call back). Marketing
// autodial / pre-recorded voice / cold SMS MUST pass requireExpress=true
// to enforce the FCC 2024 one-to-one express-consent rule.
//
// Email consent (CAN-SPAM) uses the same table — pass `emailAddress`
// instead of `phoneNumber`.
// ---------------------------------------------------------------------------

export interface ConsentCheckInput {
  userId: string;
  phoneNumber?: string;
  emailAddress?: string;
  /**
   * If true, only "express" consent passes. Use for marketing autodial,
   * pre-recorded voice, and cold marketing SMS. Defaults to false so
   * transactional callbacks (implied consent) succeed.
   */
  requireExpress?: boolean;
}

export interface ConsentCheckResult {
  hasConsent: boolean;
  /** Type of the matched record (or null if no match / revoked). */
  consentType: string | null;
  /** Source of the matched record — surfaced in audit logs. */
  consentSource: string | null;
  /** ID of the matched ConsentRecord, useful for audit row linkage. */
  recordId: string | null;
}

export async function hasConsent(
  input: ConsentCheckInput,
): Promise<ConsentCheckResult> {
  if (!input.phoneNumber && !input.emailAddress) {
    // Caller bug — refuse loudly. Better to fail than to silently
    // pass a no-op consent check.
    throw new Error(
      "hasConsent() requires at least one of phoneNumber or emailAddress",
    );
  }

  const allowedTypes = input.requireExpress
    ? ["express"]
    : ["express", "implied"];

  // We type the model access as `any` because the ConsentRecord model is
  // landed via the patch file and may not be present in the generated
  // client at the moment this file is first parsed. After `prisma generate`
  // runs with the patch applied, this becomes a typed query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prisma as any;
  if (!client.consentRecord) {
    // Schema hasn't been migrated yet. Fail closed — TCPA-safe default is
    // "no consent" so the worker refuses dispatch rather than dialing
    // unconsented numbers during a partial rollout.
    console.warn(
      "[consent] ConsentRecord model not present in Prisma client — failing closed.",
    );
    return {
      hasConsent: false,
      consentType: null,
      consentSource: null,
      recordId: null,
    };
  }

  const where: Record<string, unknown> = {
    userId: input.userId,
    revokedAt: null,
    consentType: { in: allowedTypes },
  };
  if (input.phoneNumber) where.phoneNumber = input.phoneNumber;
  if (input.emailAddress) where.emailAddress = input.emailAddress;

  const record = await client.consentRecord.findFirst({
    where,
    orderBy: { consentedAt: "desc" },
    select: {
      id: true,
      consentType: true,
      consentSource: true,
    },
  });

  if (!record) {
    return {
      hasConsent: false,
      consentType: null,
      consentSource: null,
      recordId: null,
    };
  }

  return {
    hasConsent: true,
    consentType: record.consentType,
    consentSource: record.consentSource,
    recordId: record.id,
  };
}
