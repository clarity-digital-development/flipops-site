// ---------------------------------------------------------------------------
// FL DOR land-use (DOR_UC) code → human-readable description.
//
// Source: Florida Department of Revenue property classification use codes
// (DR-505 / NAL roll documentation). Every FL parcel carries one of these in
// the NAL `DOR_UC` field, which our ingest stores raw on
// `Parcel.propertyType` as a 3-digit zero-padded string ("000".."099" —
// verified against live data 2026-06-10, e.g. Calhoun 12013: "000", "001",
// "093", "050", ...).
//
// Band overview:
//   000-009  Residential
//   010-039  Commercial
//   040-049  Industrial
//   050-069  Agricultural
//   070-079  Institutional
//   080-089  Governmental
//   090-099  Miscellaneous / centrally assessed / non-agricultural acreage
//
// Usage:
//   import { getDorUcDescription, DOR_UC_CODES } from "@/lib/data-sources/dor-uc-codes";
//   getDorUcDescription("001")  // "Single Family"
//   getDorUcDescription("1")    // "Single Family" (normalized)
//   getDorUcDescription("XX")   // null (unknown / non-standard county extension)
// ---------------------------------------------------------------------------

/** Canonical FL DOR use-code table, keyed by 3-digit zero-padded code. */
export const DOR_UC_CODES: Record<string, string> = {
  // -------------------- Residential (000-009) --------------------
  "000": "Vacant Residential",
  "001": "Single Family",
  "002": "Mobile Homes",
  "003": "Multi-family - 10 units or more",
  "004": "Condominiums",
  "005": "Cooperatives",
  "006": "Retirement Homes not eligible for exemption",
  "007": "Miscellaneous Residential (migrant camps, boarding homes, etc.)",
  "008": "Multi-family - fewer than 10 units",
  "009": "Residential Common Elements / Areas",
  // -------------------- Commercial (010-039) --------------------
  "010": "Vacant Commercial",
  "011": "Stores, one story",
  "012": "Mixed use - store and office or store and residential combination",
  "013": "Department Stores",
  "014": "Supermarkets",
  "015": "Regional Shopping Centers",
  "016": "Community Shopping Centers",
  "017": "Office buildings, non-professional service buildings, one story",
  "018": "Office buildings, non-professional service buildings, multi-story",
  "019": "Professional service buildings",
  "020": "Airports (private or commercial), bus terminals, marine terminals, piers, marinas",
  "021": "Restaurants, cafeterias",
  "022": "Drive-in restaurants",
  "023": "Financial institutions (banks, savings and loan companies, mortgage companies, credit services)",
  "024": "Insurance company offices",
  "025": "Repair service shops (excluding automotive), radio and TV repair, refrigeration service, electric repair, laundries, laundromats",
  "026": "Service stations",
  "027": "Auto sales, auto repair and storage, auto service shops, body and fender shops, commercial garages, farm and machinery sales and services, auto rental, marine equipment, trailers and related equipment, mobile home sales, motorcycles, construction vehicle sales",
  "028": "Parking lots (commercial or patron), mobile home parks",
  "029": "Wholesale outlets, produce houses, manufacturing outlets",
  "030": "Florists, greenhouses",
  "031": "Drive-in theaters, open stadiums",
  "032": "Enclosed theaters, enclosed auditoriums",
  "033": "Nightclubs, cocktail lounges, bars",
  "034": "Bowling alleys, skating rinks, pool halls, enclosed arenas",
  "035": "Tourist attractions, permanent exhibits, other entertainment facilities, fairgrounds (privately owned)",
  "036": "Camps",
  "037": "Race tracks (horse, auto, or dog)",
  "038": "Golf courses, driving ranges",
  "039": "Hotels, motels",
  // -------------------- Industrial (040-049) --------------------
  "040": "Vacant Industrial",
  "041": "Light manufacturing, small equipment manufacturing plants, small machine shops, instrument manufacturing, printing plants",
  "042": "Heavy industrial, heavy equipment manufacturing, large machine shops, foundries, steel fabricating plants, auto or aircraft plants",
  "043": "Lumber yards, sawmills, planing mills",
  "044": "Packing plants, fruit and vegetable packing plants, meat packing plants",
  "045": "Canneries, fruit and vegetable, bottlers and brewers, distilleries, wineries",
  "046": "Other food processing, candy factories, bakeries, potato chip factories",
  "047": "Mineral processing, phosphate processing, cement plants, refineries, clay plants, rock and gravel plants",
  "048": "Warehousing, distribution terminals, trucking terminals, van and storage warehousing",
  "049": "Open storage, new and used building supplies, junk yards, auto wrecking, fuel storage, equipment and material storage",
  // -------------------- Agricultural (050-069) --------------------
  "050": "Improved agricultural",
  "051": "Cropland soil capability Class I",
  "052": "Cropland soil capability Class II",
  "053": "Cropland soil capability Class III",
  "054": "Timberland - site index 90 and above",
  "055": "Timberland - site index 80 to 89",
  "056": "Timberland - site index 70 to 79",
  "057": "Timberland - site index 60 to 69",
  "058": "Timberland - site index 50 to 59",
  "059": "Timberland not classified by site index to Pines",
  "060": "Grazing land soil capability Class I",
  "061": "Grazing land soil capability Class II",
  "062": "Grazing land soil capability Class III",
  "063": "Grazing land soil capability Class IV",
  "064": "Grazing land soil capability Class V",
  "065": "Grazing land soil capability Class VI",
  "066": "Orchard groves, citrus, etc.",
  "067": "Poultry, bees, tropical fish, rabbits, etc.",
  "068": "Dairies, feed lots",
  "069": "Ornamentals, miscellaneous agricultural",
  // -------------------- Institutional (070-079) --------------------
  "070": "Vacant Institutional, with or without extra features",
  "071": "Churches",
  "072": "Private schools and colleges",
  "073": "Privately owned hospitals",
  "074": "Homes for the aged",
  "075": "Orphanages, other non-profit or charitable services",
  "076": "Mortuaries, cemeteries, crematoriums",
  "077": "Clubs, lodges, union halls",
  "078": "Sanitariums, convalescent and rest homes",
  "079": "Cultural organizations, facilities",
  // -------------------- Governmental (080-089) --------------------
  "080": "Undefined - reserved for use by Department of Revenue",
  "081": "Military",
  "082": "Forest, parks, recreational areas",
  "083": "Public county schools - including all property of Board of Public Instruction",
  "084": "Colleges (non-private)",
  "085": "Hospitals (non-private)",
  "086": "Counties (other than public schools, colleges, hospitals) including non-municipal government",
  "087": "State, other than military, forests, parks, recreational areas, colleges, hospitals",
  "088": "Federal, other than military, forests, parks, recreational areas, hospitals, colleges",
  "089": "Municipal, other than parks, recreational areas, colleges, hospitals",
  // -------------------- Miscellaneous (090-099) --------------------
  "090": "Leasehold interests (government-owned property leased by a non-governmental lessee)",
  "091": "Utility, gas and electricity, telephone and telegraph, locally assessed railroads, water and sewer service, pipelines, canals, radio/television communication",
  "092": "Mining lands, petroleum lands, or gas lands",
  "093": "Subsurface rights",
  "094": "Right-of-way, streets, roads, irrigation channel, ditch, etc.",
  "095": "Rivers and lakes, submerged lands",
  "096": "Sewage disposal, solid waste, borrow pits, drainage reservoirs, waste land, marsh, sand dunes, swamps",
  "097": "Outdoor recreational or parkland, or high-water recharge subject to classified use assessment",
  "098": "Centrally assessed",
  "099": "Acreage not zoned agricultural, with or without extra features",
};

/** Coarse band labels, useful for grouping/filtering UI. */
export type DorUcBand =
  | "Residential"
  | "Commercial"
  | "Industrial"
  | "Agricultural"
  | "Institutional"
  | "Governmental"
  | "Miscellaneous";

/**
 * Normalize a raw DOR_UC value to the canonical 3-digit zero-padded key.
 * Accepts "1", "01", "001", " 001 ", 1 (number). Returns null when the value
 * doesn't reduce to a 0-99 integer (some counties append non-standard
 * extension codes — those fall through as unknown).
 */
export function normalizeDorUc(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  const digits = String(code).trim().replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (isNaN(n) || n < 0 || n > 99) return null;
  return String(n).padStart(3, "0");
}

/**
 * Human-readable description for a DOR_UC land-use code (as stored on
 * `Parcel.propertyType`). Returns null for unknown/non-standard codes.
 */
export function getDorUcDescription(code: string | number | null | undefined): string | null {
  const key = normalizeDorUc(code);
  return key ? (DOR_UC_CODES[key] ?? null) : null;
}

/** Coarse use-band for a DOR_UC code (Residential/Commercial/...), or null. */
export function getDorUcBand(code: string | number | null | undefined): DorUcBand | null {
  const key = normalizeDorUc(code);
  if (!key) return null;
  const n = parseInt(key, 10);
  if (n <= 9) return "Residential";
  if (n <= 39) return "Commercial";
  if (n <= 49) return "Industrial";
  if (n <= 69) return "Agricultural";
  if (n <= 79) return "Institutional";
  if (n <= 89) return "Governmental";
  return "Miscellaneous";
}
