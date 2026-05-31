/**
 * REAPI Type Definitions
 *
 * TypeScript interfaces for RealEstateAPI responses.
 * Updated based on actual API responses (tested 2025-12-11).
 */

// ============================================
// PROPERTY SEARCH TYPES
// ============================================

export interface PropertySearchRequest {
  // Geographic filters (at least one required)
  state?: string;
  county?: string;
  city?: string;
  zip?: string;
  address?: string;

  // Note: Some distress filters may not be available on trial tier
  // Test each filter before relying on it

  // Property filters
  propertyType?: 'SFR' | 'MFH2to4' | 'MFH5plus' | 'CONDO' | 'LAND' | 'MOBILE';
  bedrooms_min?: number;
  bedrooms_max?: number;
  bathrooms_min?: number;
  bathrooms_max?: number;
  yearBuilt_min?: number;
  yearBuilt_max?: number;
  squareFeet_min?: number;
  squareFeet_max?: number;

  // Financial filters
  estimatedValue_min?: number;
  estimatedValue_max?: number;

  // Optimization (FREE - no credit cost)
  count?: boolean; // Returns only count
  ids_only?: boolean; // Returns only IDs

  // Pagination
  size?: number; // Default 50, max 500
  resultIndex?: number; // For pagination
}

/**
 * Actual REAPI response structure (different from docs!)
 */
export interface PropertySearchResponse {
  live: boolean;
  input: Record<string, unknown>;
  data: REAPIPropertyData[];
  resultCount: number;
  resultIndex: number;
  recordCount: number;
  statusCode: number;
  statusMessage: string;
  requestExecutionTimeMS: string;
}

/**
 * Property data from REAPI search response
 * Fields are at root level, not nested
 */
export interface REAPIPropertyData {
  // ID
  id: string;
  propertyId: string;

  // Address (nested object)
  address: {
    address: string;
    city: string;
    county: string;
    fips: string;
    state: string;
    street: string;
    zip: string;
  };

  // Mailing address (nested object)
  mailAddress?: {
    address: string;
    city: string;
    state: string;
    street: string;
    zip: string;
  };

  // Property characteristics
  propertyType: string;
  propertyUse: string;
  propertyUseCode: number;
  landUse: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number;
  lotSquareFeet: number;
  yearBuilt: number | null;
  stories: number;
  roomsCount: number;
  unitsCount: number;

  // Owner info
  owner1LastName: string;
  companyName?: string;

  // Financial
  estimatedValue: number;
  estimatedEquity: number;
  equityPercent: number;
  assessedValue: number;
  assessedLandValue: number;
  assessedImprovementValue: number;
  openMortgageBalance: number;
  estimatedMortgagePayment: number;

  // Sale info
  lastSaleAmount: string;
  lastSaleDate?: string;
  lastSaleArmsLength?: boolean;
  priorSaleAmount?: string | null;
  priorSaleDate?: string | null;

  // Portfolio info
  totalPropertiesOwned: string;
  totalPortfolioValue: string;
  totalPortfolioEquity: string;
  totalPortfolioMortgageBalance: string;
  portfolioPurchasedLast12Months: number;
  portfolioPurchasedLast6Months: number;

  // Distress flags - ALL AVAILABLE AT ROOT LEVEL
  absenteeOwner: boolean;
  auction: boolean;
  cashBuyer: boolean;
  corporateOwned: boolean;
  death: boolean;
  foreclosure: boolean;
  forSale: boolean;
  freeClear: boolean;
  highEquity: boolean;
  inherited: boolean;
  inStateAbsenteeOwner: boolean;
  investorBuyer: boolean;
  judgment: boolean;
  negativeEquity: boolean;
  outOfStateAbsenteeOwner: boolean;
  ownerOccupied: boolean;
  preForeclosure: boolean;
  privateLender: boolean;
  reo: boolean;
  taxLien: boolean | null;
  vacant: boolean;

  // === Florida tax-delinquent integration (Option A, 2026-05-31) ===
  // These are separate from `taxLien` (REAPI's nationwide field) because
  // our FL scraper data fills these and REAPI's taxLien never fires for it.
  // Hydrated from TaxDelinquencySummary at API serialization time.
  /** True if any unpaid tax certificate exists for this APN in flipops.Lien */
  isTaxDelinquent?: boolean;
  /** SUM of Lien.amount WHERE lienCategory='tax' for this APN (USD) */
  taxDelinquentAmount?: number;
  /** COUNT of distinct delinquent tax years on this APN */
  taxDelinquentYearsCount?: number;
  /** MIN tax year — used for FL Ch. 197 tax-deed eligibility (>=2 yrs old) */
  taxDelinquentEarliestYear?: number;

  // MLS status
  mlsActive: boolean;
  mlsCancelled: boolean;
  mlsFailed: boolean;
  mlsHasPhotos: boolean;
  mlsPending: boolean;
  mlsSold: boolean;
  mlsListingPrice: number | null;
  mlsLastSaleDate?: string;
  listingAmount: number | null;
  priceReduced: boolean;

  // Additional details
  apn: string;
  latitude: number;
  longitude: number;
  medianIncome: string;
  yearsOwned: number | null;
  pricePerSquareFoot: number;
  floodZone: boolean;

  // Building features
  pool: boolean;
  poolArea: number;
  garage: boolean;
  basement: boolean;
  deck: boolean;
  deckArea: number;
  patio: boolean;
  patioArea: number;
  roofConstruction: string | null;
  roofMaterial: string | null;
  airConditioningAvailable: boolean | null;

  // Mortgage info
  adjustableRate: boolean;
  assumable: boolean;
  lenderName: string | null;
  lastMortgage1Amount: number | null;
  firstMortgagePercent: number | null;
  secondMortgagePercent: number | null;
  thirdMortgagePercent: number | null;
  openMortgagePercent: number | null;
  improvementValuePercent: number | null;

  // Other
  MFH2to4: boolean;
  MFH5plus: boolean;
  hoa: number | null;
  rentAmount: number | null;
  documentType?: string;
  documentTypeCode?: string;
  recordingDate?: string;
  priorOwner?: string | null;
  equity: boolean;
  lastUpdateDate: string;
}

// ============================================
// PROPERTY DETAIL TYPES
// ============================================

export interface PropertyDetailRequest {
  address?: string;
  id?: string;
  apn?: string;
  fips?: string;
}

export interface PropertyDetailResponse {
  input: Record<string, unknown>;
  data: REAPIPropertyData | Record<string, never>;
  statusCode: number;
  statusMessage: string;
  reason?: string;
  live: boolean;
  requestExecutionTimeMS: string;
}

// ============================================
// LEGACY TYPES FOR COMPATIBILITY
// ============================================

// Keep these for backward compatibility with existing code
export interface PropertySearchResult extends REAPIPropertyData {}

export interface AddressInfo {
  address: string;
  city: string;
  county: string;
  fips: string;
  state: string;
  street: string;
  zip: string;
}

export interface OwnerInfo {
  owner1FullName: string;
  owner1FirstName: string;
  owner1LastName: string;
  owner1Type: string;
  ownershipLength: number;
  mailAddress: AddressInfo;
}

// AVM types (may need separate endpoint)
export interface AVMRequest {
  address?: string;
  id?: string;
}

export interface AVMResponse {
  id: string;
  address: AddressInfo;
  avm: {
    value: number;
    valueLow: number;
    valueHigh: number;
    confidence: string;
    fsd: number;
    lastUpdated: string;
  };
}
