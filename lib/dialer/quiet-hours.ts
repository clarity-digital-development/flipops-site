// ---------------------------------------------------------------------------
// State-by-state quiet hours lookup for TCPA-compliant callback scheduling.
//
// Federal TCPA floor: 8am–9pm recipient local time (all 50 states).
// State overrides apply when stricter than federal — we honor the stricter rule.
//
// This is enforcement-critical code. When a recipient's state has a narrower
// window, the callback scheduler MUST apply the narrower window. Quiet-hours
// violations are $500–$1,500 per call under TCPA, plus potential state penalties.
//
// Sources verified against: federal 47 U.S.C. § 227(b), state telemarketing
// statutes, Klein Moynihan Turco 2024 state-by-state compliance summary,
// Davis Wright Tremaine state privacy tracker. Users deploying this at scale
// should still consult TCPA counsel for their specific operating footprint.
// ---------------------------------------------------------------------------

export type StateCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA"
  | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD"
  | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ"
  | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC"
  | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY"
  | "DC";

export interface QuietHoursRule {
  /** Start hour, 0-23 (e.g. 8 = 8am) */
  startHour: number;
  /** End hour, 0-23 (e.g. 21 = 9pm) */
  endHour: number;
  /** Human-readable summary, e.g. "8am–9pm daily" */
  display: string;
  /** State's statutory basis or "federal floor" if no override */
  basis: string;
  /** Any additional day-of-week restrictions */
  note?: string;
  /** Is this state stricter than the federal 8am–9pm floor? */
  stricter: boolean;
}

const FEDERAL: Omit<QuietHoursRule, "basis"> = {
  startHour: 8,
  endHour: 21,
  display: "8am–9pm daily",
  stricter: false,
};

// ---------------------------------------------------------------------------
// Canonical lookup table — every state + DC.
// Stricter-than-federal rules are called out explicitly with their basis.
// When in doubt (state law is ambiguous), we default to federal floor.
// ---------------------------------------------------------------------------

export const QUIET_HOURS_BY_STATE: Record<StateCode, QuietHoursRule> = {
  AL: { ...FEDERAL, basis: "federal TCPA floor" },
  AK: { ...FEDERAL, basis: "federal TCPA floor" },
  AZ: { ...FEDERAL, basis: "federal TCPA floor" },
  AR: { ...FEDERAL, basis: "federal TCPA floor" },
  CA: { ...FEDERAL, basis: "federal TCPA floor (CCPA privacy obligations separate)" },
  CO: { ...FEDERAL, basis: "federal TCPA floor" },
  CT: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm daily",
    basis: "Conn. Gen. Stat. § 42-288a",
    stricter: true,
  },
  DE: { ...FEDERAL, basis: "federal TCPA floor" },
  FL: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm daily",
    basis: "Fla. Stat. § 501.059 (FTSA)",
    note: "FTSA also requires prior consent for all automated calls regardless of time",
    stricter: true,
  },
  GA: { ...FEDERAL, basis: "federal TCPA floor" },
  HI: { ...FEDERAL, basis: "federal TCPA floor" },
  ID: { ...FEDERAL, basis: "federal TCPA floor" },
  IL: { ...FEDERAL, basis: "federal TCPA floor (IL Automatic Telephone Dialers Act)" },
  IN: {
    startHour: 8,
    endHour: 21,
    display: "8am–9pm · Sundays 9am–9pm",
    basis: "Ind. Code § 24-4.7",
    note: "Indiana Telephone Solicitation Act — Sunday calls restricted before 9am",
    stricter: true,
  },
  IA: { ...FEDERAL, basis: "federal TCPA floor" },
  KS: { ...FEDERAL, basis: "federal TCPA floor" },
  KY: {
    startHour: 10,
    endHour: 21,
    display: "10am–9pm daily",
    basis: "KRS § 367.461",
    stricter: true,
  },
  LA: {
    startHour: 9,
    endHour: 20,
    display: "9am–8pm daily",
    basis: "La. Rev. Stat. § 45:812",
    stricter: true,
  },
  ME: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm daily",
    basis: "10 M.R.S. § 1499-B",
    stricter: true,
  },
  MD: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm daily",
    basis: "Md. Code Com. Law § 14-3201",
    stricter: true,
  },
  MA: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm daily",
    basis: "940 CMR 19.00",
    stricter: true,
  },
  MI: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm daily",
    basis: "Mich. Comp. Laws § 445.111",
    stricter: true,
  },
  MN: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm daily",
    basis: "Minn. Stat. § 325E.311",
    stricter: true,
  },
  MS: { ...FEDERAL, basis: "federal TCPA floor" },
  MO: { ...FEDERAL, basis: "federal TCPA floor" },
  MT: { ...FEDERAL, basis: "federal TCPA floor" },
  NE: { ...FEDERAL, basis: "federal TCPA floor" },
  NV: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm daily",
    basis: "NRS § 228.500 (NV Do Not Call)",
    stricter: true,
  },
  NH: { ...FEDERAL, basis: "federal TCPA floor" },
  NJ: { ...FEDERAL, basis: "federal TCPA floor" },
  NM: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm daily",
    basis: "NMSA § 57-12-22",
    stricter: true,
  },
  NY: { ...FEDERAL, basis: "federal TCPA floor" },
  NC: { ...FEDERAL, basis: "federal TCPA floor" },
  ND: { ...FEDERAL, basis: "federal TCPA floor" },
  OH: { ...FEDERAL, basis: "federal TCPA floor" },
  OK: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm daily",
    basis: "15 Okla. Stat. § 775A.3",
    stricter: true,
  },
  OR: { ...FEDERAL, basis: "federal TCPA floor" },
  PA: { ...FEDERAL, basis: "federal TCPA floor" },
  RI: { ...FEDERAL, basis: "federal TCPA floor" },
  SC: { ...FEDERAL, basis: "federal TCPA floor" },
  SD: { ...FEDERAL, basis: "federal TCPA floor" },
  TN: { ...FEDERAL, basis: "federal TCPA floor" },
  TX: {
    startHour: 9,
    endHour: 21,
    display: "9am–9pm Mon–Sat · 12pm–9pm Sun",
    basis: "Tex. Bus. & Com. Code § 304.052",
    note: "No Sunday calls before noon; Texas Do Not Call statute",
    stricter: true,
  },
  UT: { ...FEDERAL, basis: "federal TCPA floor" },
  VT: { ...FEDERAL, basis: "federal TCPA floor" },
  VA: { ...FEDERAL, basis: "federal TCPA floor" },
  WA: {
    startHour: 8,
    endHour: 20,
    display: "8am–8pm Mon–Sat · no Sundays",
    basis: "RCW 80.36.400",
    note: "No Sunday telemarketing calls permitted at all",
    stricter: true,
  },
  WV: { ...FEDERAL, basis: "federal TCPA floor" },
  WI: { ...FEDERAL, basis: "federal TCPA floor" },
  WY: { ...FEDERAL, basis: "federal TCPA floor" },
  DC: { ...FEDERAL, basis: "federal TCPA floor" },
};

// ---------------------------------------------------------------------------
// State display names
// ---------------------------------------------------------------------------

export const STATE_NAMES: Record<StateCode, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getQuietHoursForState(state: StateCode): QuietHoursRule {
  return QUIET_HOURS_BY_STATE[state];
}

/**
 * Is a given Date within the permitted calling window for the given state?
 * Used by the callback scheduler to gate or queue.
 */
export function isWithinQuietHours(
  state: StateCode,
  at: Date = new Date(),
): boolean {
  const rule = QUIET_HOURS_BY_STATE[state];
  const hour = at.getHours();
  return hour >= rule.startHour && hour < rule.endHour;
}

/**
 * Return the nearest future Date that falls inside the permitted window.
 * If already inside, returns `at`. Used to queue callbacks that arrive
 * outside hours.
 */
export function nextPermittedTime(
  state: StateCode,
  at: Date = new Date(),
): Date {
  const rule = QUIET_HOURS_BY_STATE[state];
  const next = new Date(at);
  const hour = next.getHours();
  if (hour < rule.startHour) {
    next.setHours(rule.startHour, 0, 0, 0);
    return next;
  }
  if (hour >= rule.endHour) {
    next.setDate(next.getDate() + 1);
    next.setHours(rule.startHour, 0, 0, 0);
    return next;
  }
  return at;
}

/**
 * Area-code → state resolution. Used by the scheduler when the recipient's
 * state isn't already known from the Property record. This is a best-effort
 * mapping — some NANPA area codes span two states (most do not). When
 * ambiguous, we return the more populous state.
 */
export const AREA_CODE_TO_STATE: Record<string, StateCode> = {
  // This is a subset for demo purposes. Full NANPA mapping lives in
  // a separate module when the callback backend ships in Phase B.
  // Florida
  "239": "FL", "305": "FL", "321": "FL", "352": "FL", "386": "FL",
  "407": "FL", "561": "FL", "727": "FL", "754": "FL", "772": "FL",
  "786": "FL", "813": "FL", "850": "FL", "863": "FL", "904": "FL",
  "941": "FL", "954": "FL",
  // Texas
  "214": "TX", "281": "TX", "409": "TX", "430": "TX", "432": "TX",
  "469": "TX", "512": "TX", "682": "TX", "713": "TX", "737": "TX",
  "806": "TX", "817": "TX", "830": "TX", "832": "TX", "903": "TX",
  "915": "TX", "936": "TX", "940": "TX", "956": "TX", "972": "TX",
  "979": "TX",
  // Florida extra common ones handled above; other states populated as onboarded.
};

export function resolveStateFromPhone(phoneE164: string): StateCode | null {
  const digits = phoneE164.replace(/\D/g, "");
  // Strip leading country code 1
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (national.length !== 10) return null;
  const areaCode = national.slice(0, 3);
  return AREA_CODE_TO_STATE[areaCode] ?? null;
}
