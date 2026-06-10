import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.6,
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  contractNumber: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  partiesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 20,
  },
  partyBox: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  partyTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  partyDetail: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  propertyBox: {
    padding: 15,
    backgroundColor: '#f0f9ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 20,
  },
  propertyTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 8,
  },
  propertyAddress: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  propertyDetail: {
    fontSize: 10,
    color: '#444',
  },
  termsBox: {
    marginBottom: 20,
  },
  termRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  termLabel: {
    width: 150,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  termValue: {
    flex: 1,
    fontSize: 10,
    color: '#1a1a1a',
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 12,
    textAlign: 'justify',
  },
  clauseNumber: {
    fontWeight: 'bold',
    color: '#2563eb',
  },
  scopeTable: {
    marginBottom: 20,
  },
  scopeHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 8,
    borderRadius: 4,
  },
  scopeHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  scopeRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  scopeRowAlt: {
    backgroundColor: '#f8fafc',
  },
  scopeCol1: { width: '50%' },
  scopeCol2: { width: '25%', textAlign: 'center' },
  scopeCol3: { width: '25%', textAlign: 'right' },
  totalBox: {
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 4,
    width: 250,
  },
  totalLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
    width: 150,
  },
  totalValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  signatureSection: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 40,
  },
  signatureBox: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 8,
    height: 40,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateLine: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 10,
    color: '#666',
    marginRight: 10,
  },
  dateValue: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    flex: 1,
    height: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#999',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 50,
    fontSize: 8,
    color: '#999',
  },
});

export interface ScopeItem {
  description: string;
  quantity: string;
  price: number;
}

export interface ContractData {
  contractNumber: string;
  contractDate: string;
  contractType: 'vendor' | 'assignment' | 'purchase';
  // Parties
  party1: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    role: string; // "Contractor", "Buyer", "Seller", etc.
  };
  party2: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    role: string;
  };
  // Property
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    type?: string;
  };
  // Financial Terms
  terms: {
    totalAmount: number;
    depositAmount?: number;
    paymentSchedule?: string;
    startDate?: string;
    endDate?: string;
    closingDate?: string;
  };
  // Scope of work (for vendor contracts)
  scopeItems?: ScopeItem[];
  // Additional clauses
  additionalTerms?: string[];
  // Notes
  notes?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getContractTitle = (type: string): string => {
  switch (type) {
    case 'vendor':
      return 'CONTRACTOR SERVICE AGREEMENT';
    case 'assignment':
      return 'CONTRACT ASSIGNMENT AGREEMENT';
    case 'purchase':
      return 'REAL ESTATE PURCHASE AGREEMENT';
    default:
      return 'CONTRACT AGREEMENT';
  }
};

export const ContractDocument: React.FC<{ data: ContractData }> = ({ data }) => {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{getContractTitle(data.contractType)}</Text>
          <Text style={styles.subtitle}>
            Effective Date: {formatDate(data.contractDate)}
          </Text>
          <Text style={styles.contractNumber}>Contract #{data.contractNumber}</Text>
        </View>

        {/* Parties */}
        <View style={styles.partiesSection}>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>{data.party1.role}</Text>
            <Text style={styles.partyName}>{data.party1.name}</Text>
            {data.party1.address && (
              <Text style={styles.partyDetail}>{data.party1.address}</Text>
            )}
            {data.party1.email && (
              <Text style={styles.partyDetail}>{data.party1.email}</Text>
            )}
            {data.party1.phone && (
              <Text style={styles.partyDetail}>{data.party1.phone}</Text>
            )}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>{data.party2.role}</Text>
            <Text style={styles.partyName}>{data.party2.name}</Text>
            {data.party2.address && (
              <Text style={styles.partyDetail}>{data.party2.address}</Text>
            )}
            {data.party2.email && (
              <Text style={styles.partyDetail}>{data.party2.email}</Text>
            )}
            {data.party2.phone && (
              <Text style={styles.partyDetail}>{data.party2.phone}</Text>
            )}
          </View>
        </View>

        {/* Property */}
        <View style={styles.propertyBox}>
          <Text style={styles.propertyTitle}>SUBJECT PROPERTY</Text>
          <Text style={styles.propertyAddress}>{data.property.address}</Text>
          <Text style={styles.propertyDetail}>
            {data.property.city}, {data.property.state} {data.property.zip}
          </Text>
          {data.property.type && (
            <Text style={styles.propertyDetail}>Property Type: {data.property.type}</Text>
          )}
        </View>

        {/* Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contract Terms</Text>
          <View style={styles.termsBox}>
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Contract Amount:</Text>
              <Text style={styles.termValue}>{formatCurrency(data.terms.totalAmount)}</Text>
            </View>
            {data.terms.depositAmount && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Deposit/Earnest Money:</Text>
                <Text style={styles.termValue}>{formatCurrency(data.terms.depositAmount)}</Text>
              </View>
            )}
            {data.terms.paymentSchedule && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Payment Schedule:</Text>
                <Text style={styles.termValue}>{data.terms.paymentSchedule}</Text>
              </View>
            )}
            {data.terms.startDate && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Start Date:</Text>
                <Text style={styles.termValue}>{formatDate(data.terms.startDate)}</Text>
              </View>
            )}
            {data.terms.endDate && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Completion Date:</Text>
                <Text style={styles.termValue}>{formatDate(data.terms.endDate)}</Text>
              </View>
            )}
            {data.terms.closingDate && (
              <View style={styles.termRow}>
                <Text style={styles.termLabel}>Closing Date:</Text>
                <Text style={styles.termValue}>{formatDate(data.terms.closingDate)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Scope of Work (for vendor contracts) */}
        {data.scopeItems && data.scopeItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Work</Text>
            <View style={styles.scopeTable}>
              <View style={styles.scopeHeader}>
                <Text style={[styles.scopeHeaderText, styles.scopeCol1]}>Description</Text>
                <Text style={[styles.scopeHeaderText, styles.scopeCol2]}>Quantity</Text>
                <Text style={[styles.scopeHeaderText, styles.scopeCol3]}>Price</Text>
              </View>
              {data.scopeItems.map((item, index) => (
                <View
                  key={index}
                  style={index % 2 === 1 ? [styles.scopeRow, styles.scopeRowAlt] : styles.scopeRow}
                >
                  <Text style={styles.scopeCol1}>{item.description}</Text>
                  <Text style={styles.scopeCol2}>{item.quantity}</Text>
                  <Text style={styles.scopeCol3}>{formatCurrency(item.price)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.totalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Contract Value:</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.terms.totalAmount)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Standard Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Terms & Conditions</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.clauseNumber}>1. </Text>
            Both parties agree to perform their obligations under this agreement in good faith and in accordance with all applicable laws and regulations.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.clauseNumber}>2. </Text>
            Any modifications to this agreement must be made in writing and signed by both parties.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.clauseNumber}>3. </Text>
            This agreement shall be governed by and construed in accordance with the laws of the state in which the property is located.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.clauseNumber}>4. </Text>
            In the event of a dispute, both parties agree to attempt resolution through mediation before pursuing legal action.
          </Text>
          {data.additionalTerms?.map((term, index) => (
            <Text key={index} style={styles.paragraph}>
              <Text style={styles.clauseNumber}>{5 + index}. </Text>
              {term}
            </Text>
          ))}
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.paragraph}>{data.notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>{data.party1.role} Signature:</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{data.party1.name}</Text>
            <View style={styles.dateLine}>
              <Text style={styles.dateLabel}>Date:</Text>
              <View style={styles.dateValue} />
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>{data.party2.role} Signature:</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{data.party2.name}</Text>
            <View style={styles.dateLine}>
              <Text style={styles.dateLabel}>Date:</Text>
              <View style={styles.dateValue} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated by FlipOps | This document is legally binding when signed by all parties
          </Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default ContractDocument;
