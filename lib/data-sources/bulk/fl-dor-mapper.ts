// ---------------------------------------------------------------------------
// FL DOR NAL CSV column → Cotality Property Domain v3 canonical field name.
//
// The user provided the canonical schema as two Excel data dictionaries:
//   • C:\Users\tanne\Downloads\Hailey\Property Domain_v3.xlsx (981 fields)
//   • C:\Users\tanne\Downloads\Hailey\HOA and Mechanics Liens_v1.xlsx (55 fields)
// Saved as parseable JSON at data/dictionaries/cotality-*.json.
//
// Every source we ingest (FL DOR statewide CSV, RealAuction scrapers,
// LienHub, Civitek ORI, BatchData where useful) maps onto the SAME Cotality
// field names — so the canonical Property/Parcel/Lien shape is source-
// agnostic. We don't pay Cotality (too expensive at scale) but our schema
// targets their field shape so multi-source unification is trivial.
//
// FL DOR NAL field names come from the 2025 NAL/SDF/NAP User's Guide
// (canonical FL DOR data dictionary, free public PDF at floridarevenue.com).
// ---------------------------------------------------------------------------

/**
 * One NAL column → one Cotality canonical field name.
 * Use this as the lookup when transforming a NAL CSV row into the unified
 * Cotality shape we store in RawSnapshot.payload and PropertyDataPoint.
 */
export const NAL_TO_COTALITY: Record<string, { cotalityFieldNum: number; cotalityFieldName: string; type: "string" | "number" | "date" }> = {
  // --- Identity / geography ---
  CO_NO:       { cotalityFieldNum: 6,   cotalityFieldName: "FIPS COUNTY CODE",                            type: "string" }, // resolved via fl-counties crosswalk
  PARCEL_ID:   { cotalityFieldNum: 3,   cotalityFieldName: "APN (PARCEL NUMBER UNFORMATTED)",             type: "string" },
  ALT_KEY:     { cotalityFieldNum: 10,  cotalityFieldName: "ALTERNATE PARCEL ID",                         type: "string" },
  STATE_PAR_ID:{ cotalityFieldNum: 7,   cotalityFieldName: "ORIGINAL APN",                                type: "string" },

  // --- Situs (property location) — NAL has 1-line address; Cotality decomposes ---
  PHY_ADDR1:   { cotalityFieldNum: 63,  cotalityFieldName: "SITUS STREET ADDRESS",                        type: "string" },
  PHY_CITY:    { cotalityFieldNum: 58,  cotalityFieldName: "SITUS CITY",                                  type: "string" },
  PHY_ZIPCD:   { cotalityFieldNum: 60,  cotalityFieldName: "SITUS ZIP CODE",                              type: "string" },

  // --- Owner ---
  OWN_NAME:    { cotalityFieldNum: 91,  cotalityFieldName: "OWNER 1 FULL NAME",                           type: "string" },

  // --- Mailing address (where tax bills go) ---
  OWN_ADDR1:   { cotalityFieldNum: 124, cotalityFieldName: "MAILING STREET ADDRESS",                      type: "string" },
  OWN_CITY:    { cotalityFieldNum: 120, cotalityFieldName: "MAILING CITY",                                type: "string" },
  OWN_STATE:   { cotalityFieldNum: 121, cotalityFieldName: "MAILING STATE",                               type: "string" },
  OWN_ZIPCD:   { cotalityFieldNum: 122, cotalityFieldName: "MAILING ZIP CODE",                            type: "string" },

  // --- Land use ---
  DOR_UC:      { cotalityFieldNum: 36,  cotalityFieldName: "STATE LAND USE DESCRIPTION",                  type: "string" },
  PA_UC:       { cotalityFieldNum: 35,  cotalityFieldName: "COUNTY LAND USE DESCRIPTION",                 type: "string" },

  // --- Age / building ---
  ACT_YR_BLT:  { cotalityFieldNum: 180, cotalityFieldName: "YEAR BUILT",                                  type: "number" },
  EFF_YR_BLT:  { cotalityFieldNum: 181, cotalityFieldName: "EFFECTIVE YEAR BUILT",                        type: "number" },
  TOT_LVG_AREA:{ cotalityFieldNum: 222, cotalityFieldName: "TOTAL LIVING AREA SQUARE FEET - ALL BUILDINGS", type: "number" },
  NO_BULDNG:   { cotalityFieldNum: 41,  cotalityFieldName: "NUMBER OF BUILDINGS",                         type: "number" },

  // --- Land ---
  LND_SQFOOT:  { cotalityFieldNum: 178, cotalityFieldName: "TOTAL LAND SQUARE FOOTAGE",                   type: "number" },

  // --- Value (FL Just Value ≈ market value per §192.001(2) F.S.) ---
  JV:          { cotalityFieldNum: 136, cotalityFieldName: "MARKET TOTAL VALUE",                          type: "number" },
  AV_SD:       { cotalityFieldNum: 133, cotalityFieldName: "ASSESSED TOTAL VALUE",                        type: "number" },
  TV_SD:       { cotalityFieldNum: 151, cotalityFieldName: "NET TAXABLE VALUE",                           type: "number" },
  LND_VAL:     { cotalityFieldNum: 134, cotalityFieldName: "ASSESSED LAND VALUE",                         type: "number" },
  ASMNT_YR:    { cotalityFieldNum: 144, cotalityFieldName: "TAX YEAR",                                    type: "number" },

  // --- Most recent sale (SALE_PRC1 = most recent in NAL's 2-sale rolling window) ---
  SALE_PRC1:   { cotalityFieldNum: 168, cotalityFieldName: "SALE AMOUNT",                                 type: "number" },
  // SALE_YR1 + SALE_MO1 get composed into SALE RECORDING DATE (#166) as YYYYMM01.

  // --- Legal ---
  S_LEGAL:     { cotalityFieldNum: 90,  cotalityFieldName: "LEGAL DESCRIPTION",                           type: "string" },
};

/** NAL fields used internally (not 1:1 mapped to Cotality but needed to compose them). */
export const NAL_COMPOSE_FIELDS = ["SALE_YR1", "SALE_MO1"] as const;

/** All NAL columns we care about — used to validate the CSV header has them. */
export const NAL_REQUIRED_COLUMNS = [
  ...Object.keys(NAL_TO_COTALITY),
  ...NAL_COMPOSE_FIELDS,
];
