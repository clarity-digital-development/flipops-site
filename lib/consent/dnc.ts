/* eslint-disable no-console */

// ---------------------------------------------------------------------------
// DNC scrub — Do-Not-Call list check.
//
// CURRENT STATE: STUB. Returns { onDNC: false } unconditionally.
//
// PRODUCTION INTEGRATION:
// Before going live with outbound SMS/voice, swap the stub for one of:
//
//   1. FreeDNC (https://freednc.com) — bulk DNC + Litigator scrub, cheapest
//      per-lookup option (~$0.0025/number). API: POST /v1/scrub with array
//      of E.164 numbers, returns per-number flags { ftc, internal,
//      litigator, wireless }. Recommended starting point.
//
//   2. Newkleus / DNC.com — enterprise tier, monthly subscription, includes
//      state-DNC scrubbing (TX, FL, IN have their own lists) and TCPA
//      Litigator (TCPALitigatorList.com) overlay. Recommended once monthly
//      volume exceeds ~50k scrubs.
//
//   3. Contact Center Compliance (CCC) — DNC.com's enterprise sibling,
//      includes the Reassigned Numbers Database (RND) lookup which the FCC
//      now treats as an affirmative defense against TCPA liability.
//
// Caching policy when implementing:
//   - Cache per phone for 30 days max (FTC DNC is refreshed daily; rolling
//     30-day window matches industry safe-harbor practice).
//   - On vendor error, FAIL CLOSED — treat as on DNC. The worker should
//     refuse dispatch rather than risk a TCPA violation on a stale cache.
//   - Stamp checkedAt on every result so the worker audit row has a real
//     timestamp for litigation defense.
//
// Internal DNC overlay:
//   - Maintain a separate `InternalDncRecord` table for STOP-reply
//     suppressions and manual ops blocks. Check it BEFORE the vendor call;
//     internal STOPs are authoritative and don't require a vendor round-trip.
// ---------------------------------------------------------------------------

export interface DncCheckResult {
  onDNC: boolean;
  /** ISO timestamp of when the check ran. Goes into the audit row. */
  checkedAt: string;
  /**
   * Per-list breakdown. Stub returns nulls; real vendor integration fills
   * these in so we know WHICH list flagged the number (FTC vs state vs
   * internal vs litigator).
   */
  flags: {
    federalDnc: boolean | null;
    stateDnc: boolean | null;
    internalDnc: boolean | null;
    litigator: boolean | null;
    wireless: boolean | null;
  };
  /** Free-form notes for audit (e.g. "vendor timeout, failed closed"). */
  notes?: string;
}

export async function checkDNC(
  phoneNumber: string,
): Promise<DncCheckResult> {
  // STUB: real impl posts to FreeDNC or equivalent.
  // Intentionally minimal so the worker contract is testable today.
  void phoneNumber;
  return {
    onDNC: false,
    checkedAt: new Date().toISOString(),
    flags: {
      federalDnc: null,
      stateDnc: null,
      internalDnc: null,
      litigator: null,
      wireless: null,
    },
    notes: "stub-no-vendor-configured",
  };
}
