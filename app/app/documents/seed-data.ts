// Comprehensive seed data for Documents module

export interface Document {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'void' | 'expired';
  docType: 'LOI' | 'PSA' | 'JV' | 'Assignment' | 'NDA' | 'Addendum' | 'Other';
  fileUrlCurrent?: string;
  redlineBaseVersionId?: string;
  envelopeId?: string;
  signerRoles: Array<{
    role: string;
    name?: string;
    email?: string;
    signedAt?: Date;
    status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  }>;
  relatedEntity?: 'property' | 'deal' | 'project' | 'vendor' | 'contact';
  relatedId?: string;
  relatedName?: string;
  version: number;
  createdByUserId: string;
  createdByUserName: string;
  tags: string[];
  folderId?: string;
  signedAt?: Date;
  expiresAt?: Date;
  auditLog: Array<{
    action: string;
    timestamp: Date;
    userId: string;
    userName: string;
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  docType: Document['docType'];
  description: string;
  fileUrl?: string;
  mergeSchema: MergeSchema;
  rolesSchema: Array<{
    role: string;
    required: boolean;
    signingOrder: number;
    fields: Array<'signature' | 'initial' | 'text' | 'date'>;
  }>;
  clauseRefs: string[];
  version: number;
  isActive: boolean;
  category?: string;
  thumbnailUrl?: string;
  estimatedPages?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Clause {
  id: string;
  name: string;
  category: 'earnest_money' | 'inspection' | 'financing' | 'closing' | 'assignment' | 'contingencies' | 'disclosures' | 'warranties' | 'general';
  text: string;
  isActive: boolean;
  tags: string[];
  usageCount: number;
}

export interface MergeSchema {
  datasets: string[];
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    defaultValue?: any;
    options?: string[];
  }>;
  conditionals?: Array<{
    field: string;
    condition: 'equals' | 'not_equals' | 'greater' | 'less';
    value: any;
    showFields?: string[];
    hideFields?: string[];
    includeClauses?: string[];
    excludeClauses?: string[];
  }>;
}

export interface MergeDataset {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  examplePayload: Record<string, any>;
}

export interface Folder {
  id: string;
  name: string;
  parentFolderId?: string;
  path: string;
  color?: string;
  icon?: string;
  retentionPolicyId?: string;
  documentCount?: number;
  createdAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  fileUrl: string;
  changeLog: string;
  createdAt: Date;
  createdByUserId: string;
  createdByUserName: string;
  sizeBytes?: number;
}

export interface Envelope {
  id: string;
  documentId: string;
  provider: 'mock' | 'docusign' | 'pandadoc' | 'hellosign';
  providerEnvelopeId?: string;
  status: 'created' | 'sent' | 'viewed' | 'declined' | 'signed' | 'voided';
  signerEvents: Array<{
    signerId: string;
    signerEmail: string;
    signerName: string;
    event: 'sent' | 'viewed' | 'signed' | 'declined';
    timestamp: Date;
    ipAddress?: string;
  }>;
  lastEventAt: Date;
  sentAt?: Date;
  completedAt?: Date;
}

export interface Packet {
  id: string;
  name: string;
  packetType: 'Acquisition' | 'Assignment' | 'Disposition' | 'JV' | 'Custom';
  status: 'draft' | 'ready' | 'sent' | 'partially_signed' | 'signed';
  relatedDealId?: string;
  relatedDealName?: string;
  folderId?: string;
  packetItems: Array<{
    templateId?: string;
    documentId?: string;
    title: string;
    order: number;
    roleBindings?: Record<string, { name: string; email: string }>;
    status: 'pending' | 'generated' | 'sent' | 'signed';
  }>;
  createdAt: Date;
  createdByUserId: string;
  createdByUserName: string;
}

export interface RetentionPolicy {
  id: string;
  policyName: string;
  appliesTo: 'doc_type' | 'tag' | 'folder';
  appliesValue: string;
  retentionYears: number;
  legalHold: boolean;
  autoDelete: boolean;
  description?: string;
}

// Merge Datasets
const mergeDatasetsData: MergeDataset[] = [
  {
    id: 'ds-1',
    name: 'property_core',
    description: 'Core property information',
    schema: {
      address_line1: 'string',
      city: 'string',
      state: 'string',
      zip: 'string',
      county: 'string',
      apn: 'string',
      zoning: 'string',
      beds: 'number',
      baths: 'number',
      sqft: 'number',
      lot_sqft: 'number',
      year_built: 'number',
    },
    examplePayload: {
      address_line1: '123 Main St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
      county: 'Maricopa',
      apn: '123-45-678',
      zoning: 'R-1',
      beds: 3,
      baths: 2,
      sqft: 1800,
      lot_sqft: 6500,
      year_built: 1995,
    },
  },
  {
    id: 'ds-2',
    name: 'deal_terms',
    description: 'Deal and transaction terms',
    schema: {
      offer_price: 'number',
      earnest_money_amount: 'number',
      earnest_money_due_days: 'number',
      inspection_days: 'number',
      closing_date: 'date',
      buyer_entity_name: 'string',
      seller_name: 'string',
      title_company_name: 'string',
      financing_type: 'enum:cash|conventional|hard_money|seller',
      assignment_allowed: 'boolean',
      assignment_fee: 'number',
      closing_costs_paid_by: 'enum:buyer|seller|split',
      contingencies: 'array',
    },
    examplePayload: {
      offer_price: 285000,
      earnest_money_amount: 5000,
      earnest_money_due_days: 3,
      inspection_days: 10,
      closing_date: new Date('2024-02-15'),
      buyer_entity_name: 'Phoenix Acquisitions LLC',
      seller_name: 'John Smith',
      title_company_name: 'First American Title',
      financing_type: 'cash',
      assignment_allowed: true,
      assignment_fee: 10000,
      closing_costs_paid_by: 'buyer',
      contingencies: ['inspection', 'clear_title'],
    },
  },
  {
    id: 'ds-3',
    name: 'party_buyer',
    description: 'Buyer information',
    schema: {
      buyer_entity_name: 'string',
      buyer_contact_name: 'string',
      buyer_email: 'string',
      buyer_phone: 'string',
      buyer_address: 'string',
    },
    examplePayload: {
      buyer_entity_name: 'Phoenix Acquisitions LLC',
      buyer_contact_name: 'Michael Johnson',
      buyer_email: 'mjohnson@phoenixacq.com',
      buyer_phone: '(602) 555-0100',
      buyer_address: '456 Investment Ave, Phoenix, AZ 85004',
    },
  },
  {
    id: 'ds-4',
    name: 'party_seller',
    description: 'Seller information',
    schema: {
      seller_name: 'string',
      seller_email: 'string',
      seller_phone: 'string',
      seller_address: 'string',
    },
    examplePayload: {
      seller_name: 'John & Jane Smith',
      seller_email: 'smithfamily@email.com',
      seller_phone: '(480) 555-0200',
      seller_address: '789 Residential Rd, Scottsdale, AZ 85250',
    },
  },
  {
    id: 'ds-5',
    name: 'party_assignee',
    description: 'Assignee information for wholesale deals',
    schema: {
      assignee_entity_name: 'string',
      assignee_contact_name: 'string',
      assignee_email: 'string',
      assignee_phone: 'string',
    },
    examplePayload: {
      assignee_entity_name: 'Desert Flippers LLC',
      assignee_contact_name: 'Sarah Martinez',
      assignee_email: 'sarah@desertflippers.com',
      assignee_phone: '(623) 555-0300',
    },
  },
];

// Clauses
const clausesData: Clause[] = [
  {
    id: 'cl-1',
    name: 'Earnest Money Deposit',
    category: 'earnest_money',
    text: 'Buyer shall deposit {{earnest_money_amount}} as earnest money within {{earnest_money_due_days}} business days of contract execution. Earnest money shall be held by {{title_company_name}} in an escrow account.',
    isActive: true,
    tags: ['standard', 'required'],
    usageCount: 145,
  },
  {
    id: 'cl-2',
    name: 'Inspection Period',
    category: 'inspection',
    text: 'Buyer shall have {{inspection_days}} calendar days from the effective date to conduct inspections and may cancel this contract for any reason during this period with full refund of earnest money.',
    isActive: true,
    tags: ['standard', 'buyer-protection'],
    usageCount: 132,
  },
  {
    id: 'cl-3',
    name: 'Cash Financing',
    category: 'financing',
    text: 'This is a cash transaction. Buyer shall provide proof of funds within 3 business days of contract execution. No financing contingency applies.',
    isActive: true,
    tags: ['cash', 'no-contingency'],
    usageCount: 89,
  },
  {
    id: 'cl-4',
    name: 'Assignment Allowed',
    category: 'assignment',
    text: 'Buyer reserves the right to assign this contract to another party. Any assignment shall not release the original Buyer from obligations under this contract unless agreed in writing by Seller.',
    isActive: true,
    tags: ['wholesale', 'flexible'],
    usageCount: 76,
  },
  {
    id: 'cl-5',
    name: 'Assignment Not Allowed',
    category: 'assignment',
    text: 'This contract may not be assigned by Buyer without the prior written consent of Seller. Any attempted assignment without consent shall be void.',
    isActive: true,
    tags: ['restrictive'],
    usageCount: 43,
  },
  {
    id: 'cl-6',
    name: 'Closing Costs - Buyer Pays',
    category: 'closing',
    text: 'Buyer shall pay all closing costs including but not limited to title insurance, escrow fees, recording fees, and transfer taxes.',
    isActive: true,
    tags: ['buyer-responsibility'],
    usageCount: 67,
  },
  {
    id: 'cl-7',
    name: 'AS-IS Condition',
    category: 'warranties',
    text: 'Property is being sold in AS-IS condition. Seller makes no warranties or representations regarding the condition of the property. Buyer acknowledges opportunity to inspect.',
    isActive: true,
    tags: ['as-is', 'no-warranty'],
    usageCount: 156,
  },
  {
    id: 'cl-8',
    name: 'Clear Title',
    category: 'contingencies',
    text: 'Sale is contingent upon Seller providing clear and marketable title. Any liens, encumbrances, or title defects must be cleared by Seller prior to closing.',
    isActive: true,
    tags: ['standard', 'title'],
    usageCount: 143,
  },
  {
    id: 'cl-9',
    name: 'Access for Showings',
    category: 'general',
    text: 'Seller shall provide reasonable access to the property for Buyer\'s inspections, appraisals, and contractor estimates with 24-hour notice.',
    isActive: true,
    tags: ['access', 'cooperation'],
    usageCount: 98,
  },
  {
    id: 'cl-10',
    name: 'Wire Fraud Warning',
    category: 'disclosures',
    text: 'WARNING: Wire fraud is a serious risk. Always verify wire instructions by phone before sending funds. Never rely solely on email instructions.',
    isActive: true,
    tags: ['warning', 'security'],
    usageCount: 167,
  },
];

// Document Templates
const templateData: DocumentTemplate[] = [
  {
    id: 'tpl-1',
    name: 'LOI - Residential SFR',
    docType: 'LOI',
    description: 'Standard Letter of Intent for single-family residential properties',
    category: 'Acquisition',
    estimatedPages: 2,
    mergeSchema: {
      datasets: ['property_core', 'deal_terms', 'party_buyer', 'party_seller'],
      fields: [
        { key: 'offer_price', label: 'Offer Price', type: 'number', required: true },
        { key: 'earnest_money_amount', label: 'Earnest Money', type: 'number', required: true },
        { key: 'inspection_days', label: 'Inspection Period (days)', type: 'number', required: true, defaultValue: 10 },
        { key: 'closing_date', label: 'Closing Date', type: 'date', required: true },
        { key: 'financing_type', label: 'Financing Type', type: 'select', required: true, options: ['cash', 'conventional', 'hard_money'] },
      ],
      conditionals: [
        {
          field: 'financing_type',
          condition: 'equals',
          value: 'cash',
          includeClauses: ['cl-3'],
        },
      ],
    },
    rolesSchema: [
      { role: 'Buyer', required: true, signingOrder: 1, fields: ['signature', 'date'] },
      { role: 'Seller', required: true, signingOrder: 2, fields: ['signature', 'date'] },
    ],
    clauseRefs: ['cl-1', 'cl-2', 'cl-3', 'cl-7', 'cl-8'],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'tpl-2',
    name: 'PSA - Cash As-Is',
    docType: 'PSA',
    description: 'Purchase and Sale Agreement for cash transactions with AS-IS condition',
    category: 'Acquisition',
    estimatedPages: 8,
    mergeSchema: {
      datasets: ['property_core', 'deal_terms', 'party_buyer', 'party_seller'],
      fields: [
        { key: 'offer_price', label: 'Purchase Price', type: 'number', required: true },
        { key: 'earnest_money_amount', label: 'Earnest Money', type: 'number', required: true },
        { key: 'earnest_money_due_days', label: 'EM Due (days)', type: 'number', required: true, defaultValue: 3 },
        { key: 'inspection_days', label: 'Inspection Period', type: 'number', required: true, defaultValue: 10 },
        { key: 'closing_date', label: 'Closing Date', type: 'date', required: true },
        { key: 'assignment_allowed', label: 'Allow Assignment', type: 'boolean', required: true, defaultValue: true },
        { key: 'closing_costs_paid_by', label: 'Closing Costs Paid By', type: 'select', required: true, options: ['buyer', 'seller', 'split'] },
      ],
      conditionals: [
        {
          field: 'assignment_allowed',
          condition: 'equals',
          value: true,
          includeClauses: ['cl-4'],
          excludeClauses: ['cl-5'],
        },
        {
          field: 'assignment_allowed',
          condition: 'equals',
          value: false,
          includeClauses: ['cl-5'],
          excludeClauses: ['cl-4'],
        },
      ],
    },
    rolesSchema: [
      { role: 'Buyer', required: true, signingOrder: 1, fields: ['signature', 'initial', 'date'] },
      { role: 'Seller', required: true, signingOrder: 2, fields: ['signature', 'initial', 'date'] },
      { role: 'Title Company', required: false, signingOrder: 3, fields: ['signature', 'date'] },
    ],
    clauseRefs: ['cl-1', 'cl-2', 'cl-3', 'cl-4', 'cl-6', 'cl-7', 'cl-8', 'cl-9', 'cl-10'],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'tpl-3',
    name: 'Assignment Agreement - Wholesale',
    docType: 'Assignment',
    description: 'Standard assignment agreement for wholesale real estate transactions',
    category: 'Assignment',
    estimatedPages: 4,
    mergeSchema: {
      datasets: ['property_core', 'deal_terms', 'party_buyer', 'party_assignee'],
      fields: [
        { key: 'original_purchase_price', label: 'Original Purchase Price', type: 'number', required: true },
        { key: 'assignment_fee', label: 'Assignment Fee', type: 'number', required: true },
        { key: 'total_consideration', label: 'Total Consideration', type: 'number', required: true },
        { key: 'assignment_closing_date', label: 'Assignment Closing Date', type: 'date', required: true },
      ],
    },
    rolesSchema: [
      { role: 'Assignor', required: true, signingOrder: 1, fields: ['signature', 'date'] },
      { role: 'Assignee', required: true, signingOrder: 2, fields: ['signature', 'date'] },
      { role: 'Seller Acknowledgment', required: false, signingOrder: 3, fields: ['signature', 'date'] },
    ],
    clauseRefs: [],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'tpl-4',
    name: 'JV Agreement - Simple 50/50',
    docType: 'JV',
    description: 'Joint Venture agreement with 50/50 profit split',
    category: 'Partnership',
    estimatedPages: 6,
    mergeSchema: {
      datasets: ['property_core', 'deal_terms'],
      fields: [
        { key: 'partner_a_name', label: 'Partner A Name', type: 'text', required: true },
        { key: 'partner_a_contribution', label: 'Partner A Contribution', type: 'number', required: true },
        { key: 'partner_b_name', label: 'Partner B Name', type: 'text', required: true },
        { key: 'partner_b_contribution', label: 'Partner B Contribution', type: 'number', required: true },
        { key: 'profit_split_a', label: 'Partner A Profit %', type: 'number', required: true, defaultValue: 50 },
        { key: 'profit_split_b', label: 'Partner B Profit %', type: 'number', required: true, defaultValue: 50 },
      ],
    },
    rolesSchema: [
      { role: 'Partner A', required: true, signingOrder: 1, fields: ['signature', 'initial', 'date'] },
      { role: 'Partner B', required: true, signingOrder: 2, fields: ['signature', 'initial', 'date'] },
    ],
    clauseRefs: [],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'tpl-5',
    name: 'NDA - One-Way',
    docType: 'NDA',
    description: 'Non-disclosure agreement for confidential property information',
    category: 'Legal',
    estimatedPages: 3,
    mergeSchema: {
      datasets: [],
      fields: [
        { key: 'discloser_name', label: 'Disclosing Party', type: 'text', required: true },
        { key: 'recipient_name', label: 'Receiving Party', type: 'text', required: true },
        { key: 'confidential_info_type', label: 'Type of Information', type: 'text', required: true, defaultValue: 'property and financial information' },
        { key: 'term_years', label: 'Term (years)', type: 'number', required: true, defaultValue: 2 },
      ],
    },
    rolesSchema: [
      { role: 'Discloser', required: true, signingOrder: 1, fields: ['signature', 'date'] },
      { role: 'Recipient', required: true, signingOrder: 2, fields: ['signature', 'date'] },
    ],
    clauseRefs: [],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'tpl-6',
    name: 'Addendum - Inspection Extension',
    docType: 'Addendum',
    description: 'Extends the inspection period for an existing contract',
    category: 'Modification',
    estimatedPages: 1,
    mergeSchema: {
      datasets: ['property_core'],
      fields: [
        { key: 'original_contract_date', label: 'Original Contract Date', type: 'date', required: true },
        { key: 'extension_days', label: 'Extension Days', type: 'number', required: true, defaultValue: 5 },
        { key: 'new_inspection_deadline', label: 'New Deadline', type: 'date', required: true },
      ],
    },
    rolesSchema: [
      { role: 'Buyer', required: true, signingOrder: 1, fields: ['signature', 'date'] },
      { role: 'Seller', required: true, signingOrder: 2, fields: ['signature', 'date'] },
    ],
    clauseRefs: [],
    version: 1,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// Folders
const foldersData: Folder[] = [
  { id: 'fld-1', name: 'Deals', path: '/Deals', createdAt: new Date('2024-01-01'), documentCount: 0 },
  { id: 'fld-2', name: 'DEAL-001', parentFolderId: 'fld-1', path: '/Deals/DEAL-001', createdAt: new Date('2024-01-05'), documentCount: 0 },
  { id: 'fld-3', name: 'Offer', parentFolderId: 'fld-2', path: '/Deals/DEAL-001/Offer', createdAt: new Date('2024-01-05'), documentCount: 2 },
  { id: 'fld-4', name: 'Contract', parentFolderId: 'fld-2', path: '/Deals/DEAL-001/Contract', createdAt: new Date('2024-01-10'), documentCount: 3 },
  { id: 'fld-5', name: 'DEAL-002', parentFolderId: 'fld-1', path: '/Deals/DEAL-002', createdAt: new Date('2024-01-08'), documentCount: 0 },
  { id: 'fld-6', name: 'Assignment', parentFolderId: 'fld-5', path: '/Deals/DEAL-002/Assignment', createdAt: new Date('2024-01-12'), documentCount: 1 },
  { id: 'fld-7', name: 'Global', path: '/Global', createdAt: new Date('2024-01-01'), documentCount: 0 },
  { id: 'fld-8', name: 'NDAs', parentFolderId: 'fld-7', path: '/Global/NDAs', createdAt: new Date('2024-01-01'), documentCount: 2 },
  { id: 'fld-9', name: 'Templates', path: '/Templates', createdAt: new Date('2024-01-01'), color: '#3B82F6', documentCount: 6 },
  { id: 'fld-10', name: 'Archive', path: '/Archive', createdAt: new Date('2024-01-01'), color: '#6B7280', documentCount: 0 },
  { id: 'fld-11', name: 'Lead Exports', path: '/Lead Exports', createdAt: new Date('2024-01-01'), color: '#8B5CF6', documentCount: 5 },
];

// Sample Documents
const documentsData: Document[] = [
  {
    id: 'doc-1',
    title: 'LOI - Phoenix SFR - v1',
    status: 'signed',
    docType: 'LOI',
    fileUrlCurrent: '/docs/loi-phoenix-sfr-v1-signed.pdf',
    envelopeId: 'env-1',
    signerRoles: [
      { role: 'Buyer', name: 'Phoenix Acquisitions LLC', email: 'mjohnson@phoenixacq.com', signedAt: new Date('2024-01-06T14:30:00'), status: 'signed' },
      { role: 'Seller', name: 'John Smith', email: 'smithfamily@email.com', signedAt: new Date('2024-01-06T16:45:00'), status: 'signed' },
    ],
    relatedEntity: 'deal',
    relatedId: 'DEAL-001',
    relatedName: '123 Main St, Phoenix',
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
    tags: ['phoenix', 'sfr', 'cash-offer'],
    folderId: 'fld-3',
    signedAt: new Date('2024-01-06T16:45:00'),
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-05T10:00:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Document created from template' },
      { action: 'sent', timestamp: new Date('2024-01-05T10:15:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Sent for signature' },
      { action: 'viewed', timestamp: new Date('2024-01-06T14:00:00'), userId: 'ext-1', userName: 'Phoenix Acquisitions LLC', details: 'Document viewed' },
      { action: 'signed', timestamp: new Date('2024-01-06T14:30:00'), userId: 'ext-1', userName: 'Phoenix Acquisitions LLC', details: 'Signed by Buyer' },
      { action: 'viewed', timestamp: new Date('2024-01-06T16:30:00'), userId: 'ext-2', userName: 'John Smith', details: 'Document viewed' },
      { action: 'signed', timestamp: new Date('2024-01-06T16:45:00'), userId: 'ext-2', userName: 'John Smith', details: 'Signed by Seller - All signatures complete' },
    ],
    createdAt: new Date('2024-01-05T10:00:00'),
    updatedAt: new Date('2024-01-06T16:45:00'),
  },
  {
    id: 'doc-2',
    title: 'PSA - Phoenix SFR - v2',
    status: 'sent',
    docType: 'PSA',
    fileUrlCurrent: '/docs/psa-phoenix-sfr-v2.pdf',
    redlineBaseVersionId: 'doc-ver-1',
    envelopeId: 'env-2',
    signerRoles: [
      { role: 'Buyer', name: 'Phoenix Acquisitions LLC', email: 'mjohnson@phoenixacq.com', status: 'sent' },
      { role: 'Seller', name: 'John Smith', email: 'smithfamily@email.com', status: 'viewed' },
      { role: 'Title Company', name: 'First American Title', email: 'escrow@firstam.com', status: 'pending' },
    ],
    relatedEntity: 'deal',
    relatedId: 'DEAL-001',
    relatedName: '123 Main St, Phoenix',
    version: 2,
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
    tags: ['phoenix', 'sfr', 'under-contract'],
    folderId: 'fld-4',
    expiresAt: new Date('2024-01-20'),
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-10T09:00:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Document created from template' },
      { action: 'updated', timestamp: new Date('2024-01-10T11:00:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Version 2 - Updated earnest money amount' },
      { action: 'sent', timestamp: new Date('2024-01-10T11:30:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Sent for signature' },
      { action: 'viewed', timestamp: new Date('2024-01-11T08:00:00'), userId: 'ext-2', userName: 'John Smith', details: 'Document viewed' },
    ],
    createdAt: new Date('2024-01-10T09:00:00'),
    updatedAt: new Date('2024-01-11T08:00:00'),
  },
  {
    id: 'doc-3',
    title: 'Assignment Agreement - Scottsdale Property',
    status: 'draft',
    docType: 'Assignment',
    fileUrlCurrent: '/docs/assignment-scottsdale-draft.pdf',
    signerRoles: [
      { role: 'Assignor', name: 'Phoenix Acquisitions LLC', status: 'pending' },
      { role: 'Assignee', name: 'Desert Flippers LLC', email: 'sarah@desertflippers.com', status: 'pending' },
    ],
    relatedEntity: 'deal',
    relatedId: 'DEAL-002',
    relatedName: '456 Desert View, Scottsdale',
    version: 1,
    createdByUserId: 'user-2',
    createdByUserName: 'Sarah Martinez',
    tags: ['scottsdale', 'wholesale', 'assignment'],
    folderId: 'fld-6',
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-12T14:00:00'), userId: 'user-2', userName: 'Sarah Martinez', details: 'Document created from template' },
    ],
    createdAt: new Date('2024-01-12T14:00:00'),
    updatedAt: new Date('2024-01-12T14:00:00'),
  },
  {
    id: 'doc-4',
    title: 'NDA - Mesa Investment Group',
    status: 'signed',
    docType: 'NDA',
    fileUrlCurrent: '/docs/nda-mesa-signed.pdf',
    envelopeId: 'env-3',
    signerRoles: [
      { role: 'Discloser', name: 'FlipOps LLC', email: 'legal@flipops.com', signedAt: new Date('2024-01-03T10:00:00'), status: 'signed' },
      { role: 'Recipient', name: 'Mesa Investment Group', email: 'info@mesainvest.com', signedAt: new Date('2024-01-03T15:00:00'), status: 'signed' },
    ],
    version: 1,
    createdByUserId: 'user-3',
    createdByUserName: 'Legal Team',
    tags: ['nda', 'confidential'],
    folderId: 'fld-8',
    signedAt: new Date('2024-01-03T15:00:00'),
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-03T09:00:00'), userId: 'user-3', userName: 'Legal Team', details: 'Document created' },
      { action: 'sent', timestamp: new Date('2024-01-03T09:30:00'), userId: 'user-3', userName: 'Legal Team', details: 'Sent for signature' },
      { action: 'signed', timestamp: new Date('2024-01-03T10:00:00'), userId: 'user-3', userName: 'FlipOps LLC', details: 'Signed by Discloser' },
      { action: 'signed', timestamp: new Date('2024-01-03T15:00:00'), userId: 'ext-3', userName: 'Mesa Investment Group', details: 'Signed by Recipient' },
    ],
    createdAt: new Date('2024-01-03T09:00:00'),
    updatedAt: new Date('2024-01-03T15:00:00'),
  },
  {
    id: 'doc-5',
    title: 'JV Agreement - Paradise Valley Flip',
    status: 'sent',
    docType: 'JV',
    fileUrlCurrent: '/docs/jv-paradise-valley.pdf',
    envelopeId: 'env-4',
    signerRoles: [
      { role: 'Partner A', name: 'Capital Partners LLC', email: 'invest@capitalpartners.com', status: 'signed', signedAt: new Date('2024-01-14T11:00:00') },
      { role: 'Partner B', name: 'FlipOps LLC', email: 'partnerships@flipops.com', status: 'sent' },
    ],
    relatedEntity: 'project',
    relatedId: 'PRJ-003',
    relatedName: 'Paradise Valley Luxury Flip',
    version: 1,
    createdByUserId: 'user-4',
    createdByUserName: 'Partnership Team',
    tags: ['jv', 'partnership', 'luxury'],
    expiresAt: new Date('2024-01-25'),
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-13T16:00:00'), userId: 'user-4', userName: 'Partnership Team', details: 'Document created' },
      { action: 'sent', timestamp: new Date('2024-01-13T16:30:00'), userId: 'user-4', userName: 'Partnership Team', details: 'Sent for signature' },
      { action: 'signed', timestamp: new Date('2024-01-14T11:00:00'), userId: 'ext-4', userName: 'Capital Partners LLC', details: 'Signed by Partner A' },
    ],
    createdAt: new Date('2024-01-13T16:00:00'),
    updatedAt: new Date('2024-01-14T11:00:00'),
  },
  {
    id: 'doc-6',
    title: 'Addendum - Inspection Extension - Tempe',
    status: 'draft',
    docType: 'Addendum',
    fileUrlCurrent: '/docs/addendum-tempe-draft.pdf',
    signerRoles: [
      { role: 'Buyer', status: 'pending' },
      { role: 'Seller', status: 'pending' },
    ],
    relatedEntity: 'deal',
    relatedId: 'DEAL-004',
    relatedName: '789 University Dr, Tempe',
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
    tags: ['tempe', 'extension', 'inspection'],
    auditLog: [
      { action: 'created', timestamp: new Date('2024-01-15T13:00:00'), userId: 'user-1', userName: 'Michael Johnson', details: 'Document created' },
    ],
    createdAt: new Date('2024-01-15T13:00:00'),
    updatedAt: new Date('2024-01-15T13:00:00'),
  },
  // Lead Export seed documents
  {
    id: 'doc-export-1',
    title: 'leads-export-2026-04-09.csv',
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv', 'export-initiated'],
    folderId: 'fld-11',
    auditLog: [{ action: 'Exported', timestamp: new Date('2026-04-09T14:30:00'), userId: 'user-1', userName: 'You', details: 'Exported 16 leads to CSV' }],
    createdAt: new Date('2026-04-09T14:30:00'),
    updatedAt: new Date('2026-04-09T14:30:00'),
  },
  {
    id: 'doc-export-2',
    title: 'leads-export-2026-04-07.csv',
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv', 'export-pending'],
    folderId: 'fld-11',
    auditLog: [{ action: 'Exported', timestamp: new Date('2026-04-07T09:15:00'), userId: 'user-1', userName: 'You', details: 'Exported 8 leads to CSV' }],
    createdAt: new Date('2026-04-07T09:15:00'),
    updatedAt: new Date('2026-04-07T09:15:00'),
  },
  {
    id: 'doc-export-3',
    title: 'leads-export-2026-04-03.csv',
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv'],
    folderId: 'fld-11',
    auditLog: [{ action: 'Exported', timestamp: new Date('2026-04-03T16:45:00'), userId: 'user-1', userName: 'You', details: 'Exported 23 leads to CSV' }],
    createdAt: new Date('2026-04-03T16:45:00'),
    updatedAt: new Date('2026-04-03T16:45:00'),
  },
  {
    id: 'doc-export-4',
    title: 'leads-export-2026-03-28.csv',
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv'],
    folderId: 'fld-11',
    auditLog: [{ action: 'Exported', timestamp: new Date('2026-03-28T11:00:00'), userId: 'user-1', userName: 'You', details: 'Exported 12 leads to CSV' }],
    createdAt: new Date('2026-03-28T11:00:00'),
    updatedAt: new Date('2026-03-28T11:00:00'),
  },
  {
    id: 'doc-export-5',
    title: 'leads-export-2026-03-21.csv',
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv'],
    folderId: 'fld-11',
    auditLog: [{ action: 'Exported', timestamp: new Date('2026-03-21T08:30:00'), userId: 'user-1', userName: 'You', details: 'Exported 31 leads to CSV' }],
    createdAt: new Date('2026-03-21T08:30:00'),
    updatedAt: new Date('2026-03-21T08:30:00'),
  },
];

// Document Versions
const documentVersionsData: DocumentVersion[] = [
  {
    id: 'doc-ver-1',
    documentId: 'doc-2',
    version: 1,
    fileUrl: '/docs/psa-phoenix-sfr-v1.pdf',
    changeLog: 'Initial version',
    createdAt: new Date('2024-01-10T09:00:00'),
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
    sizeBytes: 245000,
  },
  {
    id: 'doc-ver-2',
    documentId: 'doc-2',
    version: 2,
    fileUrl: '/docs/psa-phoenix-sfr-v2.pdf',
    changeLog: 'Updated earnest money amount from $5,000 to $7,500',
    createdAt: new Date('2024-01-10T11:00:00'),
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
    sizeBytes: 246000,
  },
];

// Envelopes
const envelopesData: Envelope[] = [
  {
    id: 'env-1',
    documentId: 'doc-1',
    provider: 'mock',
    providerEnvelopeId: 'MOCK-ENV-001',
    status: 'signed',
    signerEvents: [
      { signerId: 'signer-1', signerEmail: 'mjohnson@phoenixacq.com', signerName: 'Phoenix Acquisitions LLC', event: 'sent', timestamp: new Date('2024-01-05T10:15:00') },
      { signerId: 'signer-1', signerEmail: 'mjohnson@phoenixacq.com', signerName: 'Phoenix Acquisitions LLC', event: 'viewed', timestamp: new Date('2024-01-06T14:00:00'), ipAddress: '192.168.1.100' },
      { signerId: 'signer-1', signerEmail: 'mjohnson@phoenixacq.com', signerName: 'Phoenix Acquisitions LLC', event: 'signed', timestamp: new Date('2024-01-06T14:30:00'), ipAddress: '192.168.1.100' },
      { signerId: 'signer-2', signerEmail: 'smithfamily@email.com', signerName: 'John Smith', event: 'sent', timestamp: new Date('2024-01-05T10:15:00') },
      { signerId: 'signer-2', signerEmail: 'smithfamily@email.com', signerName: 'John Smith', event: 'viewed', timestamp: new Date('2024-01-06T16:30:00'), ipAddress: '10.0.0.50' },
      { signerId: 'signer-2', signerEmail: 'smithfamily@email.com', signerName: 'John Smith', event: 'signed', timestamp: new Date('2024-01-06T16:45:00'), ipAddress: '10.0.0.50' },
    ],
    lastEventAt: new Date('2024-01-06T16:45:00'),
    sentAt: new Date('2024-01-05T10:15:00'),
    completedAt: new Date('2024-01-06T16:45:00'),
  },
  {
    id: 'env-2',
    documentId: 'doc-2',
    provider: 'mock',
    providerEnvelopeId: 'MOCK-ENV-002',
    status: 'sent',
    signerEvents: [
      { signerId: 'signer-3', signerEmail: 'mjohnson@phoenixacq.com', signerName: 'Phoenix Acquisitions LLC', event: 'sent', timestamp: new Date('2024-01-10T11:30:00') },
      { signerId: 'signer-4', signerEmail: 'smithfamily@email.com', signerName: 'John Smith', event: 'sent', timestamp: new Date('2024-01-10T11:30:00') },
      { signerId: 'signer-4', signerEmail: 'smithfamily@email.com', signerName: 'John Smith', event: 'viewed', timestamp: new Date('2024-01-11T08:00:00'), ipAddress: '10.0.0.51' },
    ],
    lastEventAt: new Date('2024-01-11T08:00:00'),
    sentAt: new Date('2024-01-10T11:30:00'),
  },
];

// Packets
const packetsData: Packet[] = [
  {
    id: 'pkt-1',
    name: 'Acquisition Packet - Phoenix SFR',
    packetType: 'Acquisition',
    status: 'signed',
    relatedDealId: 'DEAL-001',
    relatedDealName: '123 Main St, Phoenix',
    folderId: 'fld-3',
    packetItems: [
      { templateId: 'tpl-1', title: 'LOI - Phoenix SFR', order: 1, status: 'signed' },
      { templateId: 'tpl-5', title: 'NDA - Property Info', order: 2, status: 'signed' },
    ],
    createdAt: new Date('2024-01-05T09:00:00'),
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
  },
  {
    id: 'pkt-2',
    name: 'Under-Contract Packet - Phoenix SFR',
    packetType: 'Acquisition',
    status: 'partially_signed',
    relatedDealId: 'DEAL-001',
    relatedDealName: '123 Main St, Phoenix',
    folderId: 'fld-4',
    packetItems: [
      { documentId: 'doc-2', title: 'PSA - Phoenix SFR', order: 1, status: 'sent' },
      { templateId: 'tpl-6', title: 'Addendum - Disclosures', order: 2, status: 'pending' },
      { templateId: 'tpl-1', title: 'Wire Instructions', order: 3, status: 'pending' },
    ],
    createdAt: new Date('2024-01-10T08:00:00'),
    createdByUserId: 'user-1',
    createdByUserName: 'Michael Johnson',
  },
  {
    id: 'pkt-3',
    name: 'Assignment Packet - Scottsdale',
    packetType: 'Assignment',
    status: 'draft',
    relatedDealId: 'DEAL-002',
    relatedDealName: '456 Desert View, Scottsdale',
    folderId: 'fld-6',
    packetItems: [
      { documentId: 'doc-3', title: 'Assignment Agreement', order: 1, status: 'pending' },
      { templateId: 'tpl-6', title: 'Notice to Seller', order: 2, status: 'pending' },
    ],
    createdAt: new Date('2024-01-12T13:00:00'),
    createdByUserId: 'user-2',
    createdByUserName: 'Sarah Martinez',
  },
];

// Retention Policies
const retentionPoliciesData: RetentionPolicy[] = [
  {
    id: 'ret-1',
    policyName: 'Signed Contracts',
    appliesTo: 'tag',
    appliesValue: 'signed-contract',
    retentionYears: 7,
    legalHold: false,
    autoDelete: false,
    description: 'Keep all signed contracts for 7 years per state requirements',
  },
  {
    id: 'ret-2',
    policyName: 'NDAs',
    appliesTo: 'doc_type',
    appliesValue: 'NDA',
    retentionYears: 3,
    legalHold: false,
    autoDelete: true,
    description: 'Retain NDAs for 3 years after expiration',
  },
  {
    id: 'ret-3',
    policyName: 'Deal Documents',
    appliesTo: 'folder',
    appliesValue: '/Deals',
    retentionYears: 5,
    legalHold: false,
    autoDelete: false,
    description: 'Keep all deal-related documents for 5 years',
  },
];

// Export all seed data
export const documentsSeedData = {
  documents: documentsData,
  templates: templateData,
  clauses: clausesData,
  mergeDatasets: mergeDatasetsData,
  folders: foldersData,
  documentVersions: documentVersionsData,
  envelopes: envelopesData,
  packets: packetsData,
  retentionPolicies: retentionPoliciesData,
};

// Helper functions
export function getDocumentsByStatus(status: Document['status']) {
  return documentsData.filter(doc => doc.status === status);
}

export function getDocumentsByFolder(folderId: string) {
  return documentsData.filter(doc => doc.folderId === folderId);
}

export function getTemplatesByCategory(category: string) {
  return templateData.filter(tpl => tpl.category === category);
}

export function getDocumentVersions(documentId: string) {
  return documentVersionsData.filter(ver => ver.documentId === documentId);
}

export const LEAD_EXPORTS_FOLDER_ID = 'fld-11';

export function saveLeadExport(filename: string, leadCount: number) {
  const doc: Document = {
    id: `doc-export-${Date.now()}`,
    title: filename,
    status: 'signed',
    docType: 'Other',
    signerRoles: [],
    relatedEntity: undefined,
    version: 1,
    createdByUserId: 'user-1',
    createdByUserName: 'You',
    tags: ['lead-export', 'csv'],
    folderId: LEAD_EXPORTS_FOLDER_ID,
    auditLog: [{
      action: 'Exported',
      timestamp: new Date(),
      userId: 'user-1',
      userName: 'You',
      details: `Exported ${leadCount} leads to CSV`,
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  documentsData.push(doc);
  const folder = foldersData.find(f => f.id === LEAD_EXPORTS_FOLDER_ID);
  if (folder) folder.documentCount = (folder.documentCount || 0) + 1;
  return doc;
}

export function calculateDocumentMetrics() {
  const total = documentsData.length;
  const byStatus = {
    draft: documentsData.filter(d => d.status === 'draft').length,
    sent: documentsData.filter(d => d.status === 'sent').length,
    signed: documentsData.filter(d => d.status === 'signed').length,
    expired: documentsData.filter(d => d.status === 'expired').length,
    void: documentsData.filter(d => d.status === 'void').length,
  };
  
  const avgSigningTime = documentsData
    .filter(d => d.signedAt && d.createdAt)
    .map(d => (d.signedAt!.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60)) // hours
    .reduce((a, b, i, arr) => a + b / arr.length, 0);

  return {
    total,
    byStatus,
    avgSigningTimeHours: Math.round(avgSigningTime),
    templatesActive: templateData.filter(t => t.isActive).length,
    packetsInProgress: packetsData.filter(p => p.status === 'sent' || p.status === 'partially_signed').length,
  };
}