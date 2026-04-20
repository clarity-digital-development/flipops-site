// Fallback city coordinates for leads that haven't been geocoded yet.
// Real BatchData/ATTOM ingested records will carry lat/lng directly.
// Covers Florida markets currently in the seed data; extend as new markets come online.

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Florida
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
