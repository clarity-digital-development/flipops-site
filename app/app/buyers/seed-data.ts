// Comprehensive seed data for the buyers/disposition section

export interface Buyer {
  id: string;
  name: string;
  entity: string;
  type: "individual" | "fund" | "syndicate" | "builder";
  status: "active" | "inactive" | "vip" | "blacklisted";
  markets: string[];
  phone: string;
  email: string;
  preferredContact: "phone" | "email" | "sms";
  tags: string[];
  score: number; // 0-100 reputation score
  joinedDate: string;
  lastActive: string;
  notes?: string;
}

export interface BuyBox {
  id: string;
  buyerId: string;
  markets: string[];
  priceMin: number;
  priceMax: number;
  bedsMin: number;
  bedsMax: number;
  bathsMin: number;
  bathsMax: number;
  sqftMin: number;
  sqftMax: number;
  yearBuiltMin: number;
  propertyTypes: string[];
  rehabLevel: "none" | "light" | "medium" | "heavy" | "teardown";
  exitStrategy: "wholesale" | "wholetail" | "flip" | "rental" | "any";
  maxHOA: number;
  floodZoneOk: boolean;
  foundationTypes: string[];
  avoidFeatures: string[];
  hotZips: string[];
}

export interface BuyerPerformance {
  buyerId: string;
  dealsClosedCount: number;
  totalVolume: number;
  avgAssignmentFee: number;
  avgDaysToClose: number;
  avgDaysToAssign: number;
  falloutRate: number;
  retradeRate: number;
  lastDealDate: string;
  preferredEscrow?: string;
  fastestClose: number;
  largestDeal: number;
}

export interface BuyerDocument {
  id: string;
  buyerId: string;
  type: "pof" | "w9" | "nda" | "agreement" | "other";
  name: string;
  uploadDate: string;
  expiryDate?: string;
  amount?: number; // For POF
  verified: boolean;
  url?: string;
}

export interface DispoListing {
  id: string;
  propertyId: string;
  address: string;
  status: "draft" | "active" | "pending" | "assigned" | "closed";
  askPrice: number;
  // Nullable: real values come from the linked DealAnalysis; null renders '—'
  // instead of fabricated estimates.
  arvEstimate: number | null;
  repairEstimate: number | null;
  netToSeller: number;
  blastSentDate?: string;
  daysOnMarket: number;
  viewCount: number;
  offerCount: number;
  topOffer?: number;
  assignedTo?: string;
  assignmentFee?: number;
  closingDate?: string;
}

export interface BuyerOffer {
  id: string;
  buyerId: string;
  listingId: string;
  offerPrice: number;
  terms: string;
  earnestMoney: number;
  closingDays: number;
  contingencies: string[];
  status: "submitted" | "countered" | "accepted" | "rejected" | "expired";
  submittedDate: string;
  expiryDate: string;
  notes?: string;
}

export interface BuyerMatch {
  buyerId: string;
  listingId: string;
  score: number; // 0-100 match score
  reasons: string[];
  priceMatch: boolean;
  marketMatch: boolean;
  specsMatch: boolean;
  rehabMatch: boolean;
  lastSimilarDeal?: string;
}

export interface BlastCampaign {
  id: string;
  listingId: string;
  sentDate: string;
  recipientCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  offerCount: number;
  method: "email" | "sms" | "both";
  subject?: string;
  message: string;
  buyerIds: string[];
}

// Seed Data
export const buyersSeedData = {
  buyers: [
    {
      id: "BUYER-001",
      name: "Marcus Johnson",
      entity: "MJ Capital Holdings LLC",
      type: "fund",
      status: "vip",
      markets: ["Jacksonville", "Orlando", "Tampa"],
      phone: "(904) 555-0101",
      email: "marcus@mjcapital.com",
      preferredContact: "phone",
      tags: ["cash", "fast-closer", "no-contingencies", "repeat-buyer"],
      score: 95,
      joinedDate: "2023-01-15",
      lastActive: "2025-02-08",
      notes: "Closes in 7-10 days. Never retrades. Preferred buyer for all Jacksonville deals."
    },
    {
      id: "BUYER-002",
      name: "Sarah Chen",
      entity: "Flip Sisters Investments",
      type: "individual",
      status: "active",
      markets: ["Jacksonville", "St. Augustine"],
      phone: "(904) 555-0102",
      email: "sarah@flipsisters.com",
      preferredContact: "email",
      tags: ["flipper", "retail-finish", "prefers-suburbs"],
      score: 88,
      joinedDate: "2023-03-20",
      lastActive: "2025-02-07",
      notes: "Focuses on 3/2 properties in good school districts. Has own crew."
    },
    {
      id: "BUYER-003",
      name: "David Rodriguez",
      entity: "Sunshine State Holdings",
      type: "syndicate",
      status: "active",
      markets: ["Jacksonville", "Miami", "Fort Lauderdale"],
      phone: "(786) 555-0103",
      email: "david@sunshineholdings.com",
      preferredContact: "sms",
      tags: ["rental-portfolio", "section-8", "multifamily"],
      score: 82,
      joinedDate: "2023-06-10",
      lastActive: "2025-02-06"
    },
    {
      id: "BUYER-004",
      name: "Jennifer White",
      entity: "White Oak Builders",
      type: "builder",
      status: "active",
      markets: ["Jacksonville", "Orange Park"],
      phone: "(904) 555-0104",
      email: "jen@whiteoakbuilders.com",
      preferredContact: "email",
      tags: ["teardown", "infill", "new-construction"],
      score: 90,
      joinedDate: "2023-02-28",
      lastActive: "2025-02-05",
      notes: "Looking for lots and teardowns in established neighborhoods."
    },
    {
      id: "BUYER-005",
      name: "Robert Kim",
      entity: "RK Investments Group",
      type: "fund",
      status: "active",
      markets: ["Jacksonville", "Gainesville", "Ocala"],
      phone: "(352) 555-0105",
      email: "robert@rkinvest.com",
      preferredContact: "phone",
      tags: ["wholesale", "quick-assign", "low-offers"],
      score: 75,
      joinedDate: "2023-09-15",
      lastActive: "2025-02-08"
    },
    {
      id: "BUYER-006",
      name: "Michelle Brown",
      entity: "Brown Property Solutions",
      type: "individual",
      status: "vip",
      markets: ["Jacksonville", "Ponte Vedra"],
      phone: "(904) 555-0106",
      email: "michelle@brownproperties.com",
      preferredContact: "email",
      tags: ["luxury", "waterfront", "high-end-flip"],
      score: 92,
      joinedDate: "2022-11-10",
      lastActive: "2025-02-07",
      notes: "Specializes in luxury flips. $500k+ properties only."
    },
    {
      id: "BUYER-007",
      name: "James Wilson",
      entity: "Wilson Capital Partners",
      type: "syndicate",
      status: "inactive",
      markets: ["Tampa", "St. Petersburg"],
      phone: "(813) 555-0107",
      email: "james@wilsoncapital.com",
      preferredContact: "phone",
      tags: ["inactive", "slow-responder"],
      score: 65,
      joinedDate: "2023-04-05",
      lastActive: "2024-12-15",
      notes: "Hasn't closed a deal in 2 months. Very slow to respond."
    },
    {
      id: "BUYER-008",
      name: "Lisa Martinez",
      entity: "LM Real Estate Ventures",
      type: "individual",
      status: "active",
      markets: ["Jacksonville", "Fernandina Beach"],
      phone: "(904) 555-0108",
      email: "lisa@lmventures.com",
      preferredContact: "sms",
      tags: ["beachfront", "vacation-rental", "airbnb"],
      score: 85,
      joinedDate: "2023-07-20",
      lastActive: "2025-02-08"
    },
    {
      id: "BUYER-009",
      name: "Thomas Anderson",
      entity: "Matrix Holdings LLC",
      type: "fund",
      status: "blacklisted",
      markets: ["Jacksonville"],
      phone: "(904) 555-0109",
      email: "tom@matrixholdings.com",
      preferredContact: "email",
      tags: ["blacklisted", "retrade-history", "do-not-sell"],
      score: 20,
      joinedDate: "2023-05-01",
      lastActive: "2024-10-30",
      notes: "BLACKLISTED: Multiple retrades and failed closings. DO NOT SELL."
    },
    {
      id: "BUYER-010",
      name: "Amanda Foster",
      entity: "Foster Family Investments",
      type: "individual",
      status: "active",
      markets: ["Jacksonville", "Clay County"],
      phone: "(904) 555-0110",
      email: "amanda@fosterfamily.com",
      preferredContact: "email",
      tags: ["first-time-buyer", "needs-guidance", "small-deals"],
      score: 70,
      joinedDate: "2024-11-15",
      lastActive: "2025-02-06",
      notes: "New buyer, closed first deal successfully. Prefers turnkey or light rehab."
    }
  ] as Buyer[],

  buyBoxes: [
    {
      id: "BUYBOX-001",
      buyerId: "BUYER-001",
      markets: ["Jacksonville", "Orlando", "Tampa"],
      priceMin: 150000,
      priceMax: 500000,
      bedsMin: 3,
      bedsMax: 5,
      bathsMin: 2,
      bathsMax: 4,
      sqftMin: 1200,
      sqftMax: 3000,
      yearBuiltMin: 1960,
      propertyTypes: ["single-family", "townhouse"],
      rehabLevel: "any",
      exitStrategy: "any",
      maxHOA: 200,
      floodZoneOk: false,
      foundationTypes: ["slab", "crawl"],
      avoidFeatures: ["pool", "septic"],
      hotZips: ["32204", "32205", "32207", "32210"]
    },
    {
      id: "BUYBOX-002",
      buyerId: "BUYER-002",
      markets: ["Jacksonville", "St. Augustine"],
      priceMin: 200000,
      priceMax: 400000,
      bedsMin: 3,
      bedsMax: 4,
      bathsMin: 2,
      bathsMax: 3,
      sqftMin: 1400,
      sqftMax: 2200,
      yearBuiltMin: 1970,
      propertyTypes: ["single-family"],
      rehabLevel: "medium",
      exitStrategy: "flip",
      maxHOA: 150,
      floodZoneOk: false,
      foundationTypes: ["slab"],
      avoidFeatures: ["manufactured", "flood-zone"],
      hotZips: ["32256", "32259", "32092"]
    },
    {
      id: "BUYBOX-003",
      buyerId: "BUYER-003",
      markets: ["Jacksonville", "Miami", "Fort Lauderdale"],
      priceMin: 100000,
      priceMax: 350000,
      bedsMin: 2,
      bedsMax: 4,
      bathsMin: 1,
      bathsMax: 3,
      sqftMin: 900,
      sqftMax: 2000,
      yearBuiltMin: 1950,
      propertyTypes: ["single-family", "duplex", "triplex", "quadplex"],
      rehabLevel: "light",
      exitStrategy: "rental",
      maxHOA: 100,
      floodZoneOk: true,
      foundationTypes: ["any"],
      avoidFeatures: [],
      hotZips: ["32208", "32209", "32254"]
    },
    {
      id: "BUYBOX-004",
      buyerId: "BUYER-004",
      markets: ["Jacksonville", "Orange Park"],
      priceMin: 50000,
      priceMax: 200000,
      bedsMin: 0,
      bedsMax: 4,
      bathsMin: 0,
      bathsMax: 3,
      sqftMin: 0,
      sqftMax: 2500,
      yearBuiltMin: 0,
      propertyTypes: ["single-family", "lot"],
      rehabLevel: "teardown",
      exitStrategy: "any",
      maxHOA: 500,
      floodZoneOk: false,
      foundationTypes: ["any"],
      avoidFeatures: ["historic", "conservation"],
      hotZips: ["32073", "32065", "32003"]
    },
    {
      id: "BUYBOX-006",
      buyerId: "BUYER-006",
      markets: ["Jacksonville", "Ponte Vedra"],
      priceMin: 500000,
      priceMax: 2000000,
      bedsMin: 4,
      bedsMax: 7,
      bathsMin: 3,
      bathsMax: 6,
      sqftMin: 3000,
      sqftMax: 8000,
      yearBuiltMin: 1980,
      propertyTypes: ["single-family", "estate"],
      rehabLevel: "light",
      exitStrategy: "flip",
      maxHOA: 1000,
      floodZoneOk: true,
      foundationTypes: ["slab"],
      avoidFeatures: ["manufactured"],
      hotZips: ["32082", "32081", "32250"]
    }
  ] as BuyBox[],

  performance: [
    {
      buyerId: "BUYER-001",
      dealsClosedCount: 47,
      totalVolume: 12500000,
      avgAssignmentFee: 18000,
      avgDaysToClose: 8,
      avgDaysToAssign: 2,
      falloutRate: 0.02,
      retradeRate: 0,
      lastDealDate: "2025-02-05",
      preferredEscrow: "First American Title",
      fastestClose: 5,
      largestDeal: 750000
    },
    {
      buyerId: "BUYER-002",
      dealsClosedCount: 23,
      totalVolume: 6200000,
      avgAssignmentFee: 15000,
      avgDaysToClose: 21,
      avgDaysToAssign: 4,
      falloutRate: 0.08,
      retradeRate: 0.04,
      lastDealDate: "2025-01-28",
      preferredEscrow: "Chicago Title",
      fastestClose: 14,
      largestDeal: 425000
    },
    {
      buyerId: "BUYER-003",
      dealsClosedCount: 18,
      totalVolume: 3800000,
      avgAssignmentFee: 12000,
      avgDaysToClose: 25,
      avgDaysToAssign: 5,
      falloutRate: 0.11,
      retradeRate: 0.06,
      lastDealDate: "2025-01-15",
      fastestClose: 18,
      largestDeal: 380000
    },
    {
      buyerId: "BUYER-004",
      dealsClosedCount: 31,
      totalVolume: 4500000,
      avgAssignmentFee: 10000,
      avgDaysToClose: 30,
      avgDaysToAssign: 3,
      falloutRate: 0.06,
      retradeRate: 0.03,
      lastDealDate: "2025-02-01",
      preferredEscrow: "Stewart Title",
      fastestClose: 21,
      largestDeal: 350000
    },
    {
      buyerId: "BUYER-006",
      dealsClosedCount: 15,
      totalVolume: 11000000,
      avgAssignmentFee: 35000,
      avgDaysToClose: 35,
      avgDaysToAssign: 7,
      falloutRate: 0.07,
      retradeRate: 0.07,
      lastDealDate: "2025-01-20",
      preferredEscrow: "Lawyers Title",
      fastestClose: 25,
      largestDeal: 1500000
    }
  ] as BuyerPerformance[],

  documents: [
    {
      id: "DOC-001",
      buyerId: "BUYER-001",
      type: "pof",
      name: "MJ Capital - Proof of Funds",
      uploadDate: "2025-01-15",
      expiryDate: "2025-03-15",
      amount: 5000000,
      verified: true
    },
    {
      id: "DOC-002",
      buyerId: "BUYER-001",
      type: "w9",
      name: "MJ Capital Holdings LLC - W9",
      uploadDate: "2024-01-10",
      verified: true
    },
    {
      id: "DOC-003",
      buyerId: "BUYER-002",
      type: "pof",
      name: "Bank Statement - Flip Sisters",
      uploadDate: "2025-01-20",
      expiryDate: "2025-02-20",
      amount: 800000,
      verified: true
    },
    {
      id: "DOC-004",
      buyerId: "BUYER-003",
      type: "nda",
      name: "Mutual NDA - Sunshine State",
      uploadDate: "2023-06-10",
      verified: true
    },
    {
      id: "DOC-005",
      buyerId: "BUYER-006",
      type: "pof",
      name: "Brown Properties - LOC",
      uploadDate: "2025-02-01",
      expiryDate: "2025-08-01",
      amount: 3000000,
      verified: true
    }
  ] as BuyerDocument[],

  listings: [
    {
      id: "LISTING-001",
      propertyId: "PROP-001",
      address: "123 Oak Street, Jacksonville, FL 32204",
      status: "active",
      askPrice: 195000,
      arvEstimate: 285000,
      repairEstimate: 65000,
      netToSeller: 175000,
      blastSentDate: "2025-02-07",
      daysOnMarket: 2,
      viewCount: 47,
      offerCount: 5,
      topOffer: 190000
    },
    {
      id: "LISTING-002",
      propertyId: "PROP-002",
      address: "456 Pine Avenue, Jacksonville, FL 32205",
      status: "pending",
      askPrice: 225000,
      arvEstimate: 325000,
      repairEstimate: 45000,
      netToSeller: 205000,
      blastSentDate: "2025-02-05",
      daysOnMarket: 4,
      viewCount: 62,
      offerCount: 8,
      topOffer: 220000,
      assignedTo: "BUYER-001",
      assignmentFee: 20000
    },
    {
      id: "LISTING-003",
      propertyId: "PROP-003",
      address: "789 Elm Court, Jacksonville, FL 32207",
      status: "closed",
      askPrice: 145000,
      arvEstimate: 195000,
      repairEstimate: 30000,
      netToSeller: 130000,
      blastSentDate: "2025-01-25",
      daysOnMarket: 7,
      viewCount: 38,
      offerCount: 3,
      topOffer: 145000,
      assignedTo: "BUYER-002",
      assignmentFee: 15000,
      closingDate: "2025-02-01"
    }
  ] as DispoListing[],

  offers: [
    {
      id: "OFFER-001",
      buyerId: "BUYER-001",
      listingId: "LISTING-001",
      offerPrice: 190000,
      terms: "Cash, 7-day close, no contingencies",
      earnestMoney: 5000,
      closingDays: 7,
      contingencies: [],
      status: "submitted",
      submittedDate: "2025-02-08T10:00:00Z",
      expiryDate: "2025-02-10T17:00:00Z"
    },
    {
      id: "OFFER-002",
      buyerId: "BUYER-002",
      listingId: "LISTING-001",
      offerPrice: 185000,
      terms: "Cash, 14-day close, inspection contingency",
      earnestMoney: 3000,
      closingDays: 14,
      contingencies: ["inspection"],
      status: "submitted",
      submittedDate: "2025-02-08T11:30:00Z",
      expiryDate: "2025-02-10T17:00:00Z"
    },
    {
      id: "OFFER-003",
      buyerId: "BUYER-003",
      listingId: "LISTING-001",
      offerPrice: 180000,
      terms: "Cash, 21-day close",
      earnestMoney: 2500,
      closingDays: 21,
      contingencies: ["inspection", "appraisal"],
      status: "submitted",
      submittedDate: "2025-02-08T14:00:00Z",
      expiryDate: "2025-02-10T17:00:00Z"
    }
  ] as BuyerOffer[],

  matches: [
    {
      buyerId: "BUYER-001",
      listingId: "LISTING-001",
      score: 95,
      reasons: ["Perfect price range", "Preferred market", "Fast closer", "VIP status"],
      priceMatch: true,
      marketMatch: true,
      specsMatch: true,
      rehabMatch: true,
      lastSimilarDeal: "2025-01-15"
    },
    {
      buyerId: "BUYER-002",
      listingId: "LISTING-001",
      score: 88,
      reasons: ["Good price match", "Active in market", "Prefers this property type"],
      priceMatch: true,
      marketMatch: true,
      specsMatch: true,
      rehabMatch: true,
      lastSimilarDeal: "2025-01-28"
    },
    {
      buyerId: "BUYER-003",
      listingId: "LISTING-001",
      score: 72,
      reasons: ["Price in range", "Market match", "Rental strategy fits"],
      priceMatch: true,
      marketMatch: true,
      specsMatch: false,
      rehabMatch: false,
      lastSimilarDeal: "2024-12-10"
    }
  ] as BuyerMatch[],

  campaigns: [
    {
      id: "BLAST-001",
      listingId: "LISTING-001",
      sentDate: "2025-02-07T09:00:00Z",
      recipientCount: 25,
      openCount: 18,
      clickCount: 12,
      replyCount: 7,
      offerCount: 5,
      method: "both",
      subject: "HOT DEAL: 123 Oak St - 65% ARV - Fast Assignment",
      message: "New wholesale opportunity in Riverside! 3/2 SFH, ARV $285k, asking $195k. Light rehab needed. First come, first served!",
      buyerIds: ["BUYER-001", "BUYER-002", "BUYER-003", "BUYER-004", "BUYER-005", "BUYER-006", "BUYER-008", "BUYER-010"]
    },
    {
      id: "BLAST-002",
      listingId: "LISTING-002",
      sentDate: "2025-02-05T10:00:00Z",
      recipientCount: 30,
      openCount: 24,
      clickCount: 18,
      replyCount: 10,
      offerCount: 8,
      method: "email",
      subject: "PRICE REDUCED: 456 Pine Ave - Move Fast!",
      message: "Price dropped to $225k! 4/2.5 in Murray Hill. ARV $325k. Perfect flip opportunity. Reply with your best offer.",
      buyerIds: ["BUYER-001", "BUYER-002", "BUYER-003", "BUYER-004", "BUYER-005", "BUYER-006"]
    }
  ] as BlastCampaign[]
};