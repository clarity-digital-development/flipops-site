// ---------------------------------------------------------------------------
// Florida county code crosswalk: DOR CO_NO (alphabetical 11-77) ↔ county FIPS
// ↔ name. The FloridaGIO FeatureServer filters by CO_NO; our Parcel table keys
// on the 5-digit FIPS. This map bridges them for all 67 counties.
//
// NOTE: the FL DOR county number is assigned alphabetically starting at 11
// (Alachua) — it is NOT the FIPS county code. Verified Duval = CO_NO 26 / FIPS
// 12031 empirically against the live FeatureServer.
// ---------------------------------------------------------------------------

export interface FlCounty {
  coNo: number; // FL DOR county number (FeatureServer CO_NO filter)
  fips: string; // 5-digit county FIPS
  name: string;
}

export const FL_COUNTIES: FlCounty[] = [
  { coNo: 11, fips: "12001", name: "Alachua" },
  { coNo: 12, fips: "12003", name: "Baker" },
  { coNo: 13, fips: "12005", name: "Bay" },
  { coNo: 14, fips: "12007", name: "Bradford" },
  { coNo: 15, fips: "12009", name: "Brevard" },
  { coNo: 16, fips: "12011", name: "Broward" },
  { coNo: 17, fips: "12013", name: "Calhoun" },
  { coNo: 18, fips: "12015", name: "Charlotte" },
  { coNo: 19, fips: "12017", name: "Citrus" },
  { coNo: 20, fips: "12019", name: "Clay" },
  { coNo: 21, fips: "12021", name: "Collier" },
  { coNo: 22, fips: "12023", name: "Columbia" },
  { coNo: 23, fips: "12086", name: "Miami-Dade" }, // DOR "Dade"
  { coNo: 24, fips: "12027", name: "DeSoto" },
  { coNo: 25, fips: "12029", name: "Dixie" },
  { coNo: 26, fips: "12031", name: "Duval" },
  { coNo: 27, fips: "12033", name: "Escambia" },
  { coNo: 28, fips: "12035", name: "Flagler" },
  { coNo: 29, fips: "12037", name: "Franklin" },
  { coNo: 30, fips: "12039", name: "Gadsden" },
  { coNo: 31, fips: "12041", name: "Gilchrist" },
  { coNo: 32, fips: "12043", name: "Glades" },
  { coNo: 33, fips: "12045", name: "Gulf" },
  { coNo: 34, fips: "12047", name: "Hamilton" },
  { coNo: 35, fips: "12049", name: "Hardee" },
  { coNo: 36, fips: "12051", name: "Hendry" },
  { coNo: 37, fips: "12053", name: "Hernando" },
  { coNo: 38, fips: "12055", name: "Highlands" },
  { coNo: 39, fips: "12057", name: "Hillsborough" },
  { coNo: 40, fips: "12059", name: "Holmes" },
  { coNo: 41, fips: "12061", name: "Indian River" },
  { coNo: 42, fips: "12063", name: "Jackson" },
  { coNo: 43, fips: "12065", name: "Jefferson" },
  { coNo: 44, fips: "12067", name: "Lafayette" },
  { coNo: 45, fips: "12069", name: "Lake" },
  { coNo: 46, fips: "12071", name: "Lee" },
  { coNo: 47, fips: "12073", name: "Leon" },
  { coNo: 48, fips: "12075", name: "Levy" },
  { coNo: 49, fips: "12077", name: "Liberty" },
  { coNo: 50, fips: "12079", name: "Madison" },
  { coNo: 51, fips: "12081", name: "Manatee" },
  { coNo: 52, fips: "12083", name: "Marion" },
  { coNo: 53, fips: "12085", name: "Martin" },
  { coNo: 54, fips: "12087", name: "Monroe" },
  { coNo: 55, fips: "12089", name: "Nassau" },
  { coNo: 56, fips: "12091", name: "Okaloosa" },
  { coNo: 57, fips: "12093", name: "Okeechobee" },
  { coNo: 58, fips: "12095", name: "Orange" },
  { coNo: 59, fips: "12097", name: "Osceola" },
  { coNo: 60, fips: "12099", name: "Palm Beach" },
  { coNo: 61, fips: "12101", name: "Pasco" },
  { coNo: 62, fips: "12103", name: "Pinellas" },
  { coNo: 63, fips: "12105", name: "Polk" },
  { coNo: 64, fips: "12107", name: "Putnam" },
  { coNo: 65, fips: "12109", name: "St. Johns" },
  { coNo: 66, fips: "12111", name: "St. Lucie" },
  { coNo: 67, fips: "12113", name: "Santa Rosa" },
  { coNo: 68, fips: "12115", name: "Sarasota" },
  { coNo: 69, fips: "12117", name: "Seminole" },
  { coNo: 70, fips: "12119", name: "Sumter" },
  { coNo: 71, fips: "12121", name: "Suwannee" },
  { coNo: 72, fips: "12123", name: "Taylor" },
  { coNo: 73, fips: "12125", name: "Union" },
  { coNo: 74, fips: "12127", name: "Volusia" },
  { coNo: 75, fips: "12129", name: "Wakulla" },
  { coNo: 76, fips: "12131", name: "Walton" },
  { coNo: 77, fips: "12133", name: "Washington" },
];

const BY_FIPS = new Map(FL_COUNTIES.map((c) => [c.fips, c]));
const BY_CONO = new Map(FL_COUNTIES.map((c) => [c.coNo, c]));

export const flCountyByFips = (fips: string) => BY_FIPS.get(fips) ?? null;
export const flCountyByCoNo = (coNo: number) => BY_CONO.get(coNo) ?? null;
