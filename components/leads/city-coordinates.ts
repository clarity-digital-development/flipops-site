// Fallback city coordinates for leads that haven't been geocoded yet.
// Real BatchData ingested records will carry lat/lng directly.
// Covers Florida markets currently in the seed data; extend as new markets come online.

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Florida — top-5 metros + surrounding majors. Extended 2026-06 to cover
  // virtual auction/tax-delinquent rows from Broward/Miami-Dade/Palm Beach
  // that may not yet carry server-side lat/lng.
  "jacksonville,fl": { lat: 30.3322, lng: -81.6557 },
  "orlando,fl": { lat: 28.5383, lng: -81.3792 },
  "tampa,fl": { lat: 27.9506, lng: -82.4572 },
  "miami,fl": { lat: 25.7617, lng: -80.1918 },
  "st. petersburg,fl": { lat: 27.7676, lng: -82.6403 },
  "st petersburg,fl": { lat: 27.7676, lng: -82.6403 },
  "fort lauderdale,fl": { lat: 26.1224, lng: -80.1373 },
  "gainesville,fl": { lat: 29.6516, lng: -82.3248 },
  "tallahassee,fl": { lat: 30.4383, lng: -84.2807 },
  "pensacola,fl": { lat: 30.4213, lng: -87.2169 },
  "naples,fl": { lat: 26.1420, lng: -81.7948 },
  "sarasota,fl": { lat: 27.3364, lng: -82.5307 },
  "clearwater,fl": { lat: 27.9659, lng: -82.8001 },
  "west palm beach,fl": { lat: 26.7153, lng: -80.0534 },
  "daytona beach,fl": { lat: 29.2108, lng: -81.0228 },
  "ocala,fl": { lat: 29.1872, lng: -82.1401 },
  // Miami-Dade
  "hialeah,fl": { lat: 25.8576, lng: -80.2781 },
  "miami gardens,fl": { lat: 25.9420, lng: -80.2456 },
  "homestead,fl": { lat: 25.4687, lng: -80.4776 },
  "north miami,fl": { lat: 25.8901, lng: -80.1867 },
  "doral,fl": { lat: 25.8195, lng: -80.3553 },
  // Broward
  "hollywood,fl": { lat: 26.0112, lng: -80.1495 },
  "pembroke pines,fl": { lat: 26.0078, lng: -80.2962 },
  "coral springs,fl": { lat: 26.2710, lng: -80.2706 },
  "plantation,fl": { lat: 26.1275, lng: -80.2331 },
  "davie,fl": { lat: 26.0628, lng: -80.2331 },
  "sunrise,fl": { lat: 26.1338, lng: -80.2667 },
  "pompano beach,fl": { lat: 26.2379, lng: -80.1248 },
  "deerfield beach,fl": { lat: 26.3184, lng: -80.0998 },
  "miramar,fl": { lat: 25.9873, lng: -80.2323 },
  // Palm Beach
  "boca raton,fl": { lat: 26.3683, lng: -80.1289 },
  "delray beach,fl": { lat: 26.4615, lng: -80.0728 },
  "boynton beach,fl": { lat: 26.5253, lng: -80.0664 },
  "jupiter,fl": { lat: 26.9342, lng: -80.0942 },
  "wellington,fl": { lat: 26.6618, lng: -80.2683 },
  // Hillsborough / Pinellas / Pasco
  "brandon,fl": { lat: 27.9378, lng: -82.2859 },
  "riverview,fl": { lat: 27.8661, lng: -82.3265 },
  "largo,fl": { lat: 27.9095, lng: -82.7873 },
  "spring hill,fl": { lat: 28.4769, lng: -82.5232 },
  // Lee / Collier / SW Florida
  "cape coral,fl": { lat: 26.5629, lng: -81.9495 },
  "fort myers,fl": { lat: 26.6406, lng: -81.8723 },
  "lehigh acres,fl": { lat: 26.6125, lng: -81.6231 },
  "bonita springs,fl": { lat: 26.3398, lng: -81.7787 },
  // Polk / Central FL
  "lakeland,fl": { lat: 28.0395, lng: -81.9498 },
  "kissimmee,fl": { lat: 28.2920, lng: -81.4076 },
  "deltona,fl": { lat: 28.9005, lng: -81.2637 },
  "sanford,fl": { lat: 28.8003, lng: -81.2731 },
  "winter haven,fl": { lat: 28.0222, lng: -81.7329 },
  // St. Lucie / Treasure Coast
  "port st. lucie,fl": { lat: 27.2939, lng: -80.3501 },
  "port st lucie,fl": { lat: 27.2939, lng: -80.3501 },
  "port saint lucie,fl": { lat: 27.2939, lng: -80.3501 },
  // Brevard / Space Coast
  "palm bay,fl": { lat: 28.0345, lng: -80.5887 },
  "melbourne,fl": { lat: 28.0836, lng: -80.6081 },
  // Duval
  "jacksonville beach,fl": { lat: 30.2947, lng: -81.3931 },
  "lexington,ky": { lat: 38.0406, lng: -84.5037 },
};

export function resolveCoordinates(
  city: string,
  state: string,
  fallback?: { lat: number; lng: number },
): { lat: number; lng: number } | null {
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  return CITY_COORDINATES[key] ?? fallback ?? null;
}

// Deterministic jitter so multiple leads in the same city don't all stack on one pin.
// Uses the property ID hash to keep positions stable across renders.
export function jitterCoordinates(
  base: { lat: number; lng: number },
  seed: string,
): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((hash & 0xff) / 0xff - 0.5) * 0.04; // ~2.2 miles
  const lngOffset = (((hash >> 8) & 0xff) / 0xff - 0.5) * 0.04;
  return { lat: base.lat + latOffset, lng: base.lng + lngOffset };
}
