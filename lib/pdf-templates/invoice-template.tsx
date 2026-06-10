import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  invoiceTitle: {
    textAlign: 'right',
  },
  invoiceLabel: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  billToSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  billTo: {
    flex: 1,
  },
  invoiceDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  vendorName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vendorDetail: {
    fontSize: 10,
    color: '#444',
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 10,
    color: '#666',
    width: 80,
  },
  detailValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  table: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  col1: { width: '40%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '25%', textAlign: 'right' },
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 250,
  },
  totalLabel: {
    fontSize: 10,
    color: '#666',
    width: 120,
    textAlign: 'right',
    paddingRight: 20,
  },
  totalValue: {
    fontSize: 10,
    width: 130,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#2563eb',
    width: 250,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    width: 120,
    textAlign: 'right',
    paddingRight: 20,
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
    width: 130,
    textAlign: 'right',
  },
  notesSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 8,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusApproved: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusPaid: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
});

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: 'pending' | 'approved' | 'paid';
  // Vendor (who we're paying)
  vendor: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  // Company info (FlipOps user)
  company: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  // Property/Project
  project?: {
    address: string;
    trade?: string;
  };
  // Line items
  lineItems: InvoiceLineItem[];
  // Totals
  subtotal: number;
  tax?: number;
  taxRate?: number;
  total: number;
  // Additional
  notes?: string;
  paymentTerms?: string;
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

export const InvoiceDocument: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const getStatusStyle = () => {
    switch (data.status) {
      case 'paid':
        return styles.statusPaid;
      case 'approved':
        return styles.statusApproved;
      default:
        return styles.statusPending;
    }
  };

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{data.company.name || 'FlipOps'}</Text>
            {data.company.address && (
              <Text style={styles.companyDetail}>{data.company.address}</Text>
            )}
            {data.company.email && (
              <Text style={styles.companyDetail}>{data.company.email}</Text>
            )}
            {data.company.phone && (
              <Text style={styles.companyDetail}>{data.company.phone}</Text>
            )}
          </View>
          <View style={styles.invoiceTitle}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
            <View style={[styles.statusBadge, getStatusStyle()]}>
              <Text style={{ fontSize: 8, textTransform: 'uppercase' }}>
                {data.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Bill To & Invoice Details */}
        <View style={styles.billToSection}>
          <View style={styles.billTo}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.vendorName}>{data.vendor.name}</Text>
            {data.vendor.address && (
              <Text style={styles.vendorDetail}>{data.vendor.address}</Text>
            )}
            {data.vendor.email && (
              <Text style={styles.vendorDetail}>{data.vendor.email}</Text>
            )}
            {data.vendor.phone && (
              <Text style={styles.vendorDetail}>{data.vendor.phone}</Text>
            )}
          </View>
          <View style={styles.invoiceDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice Date:</Text>
              <Text style={styles.detailValue}>{formatDate(data.invoiceDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date:</Text>
              <Text style={styles.detailValue}>{formatDate(data.dueDate)}</Text>
            </View>
            {data.project && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Project:</Text>
                  <Text style={styles.detailValue}>{data.project.address}</Text>
                </View>
                {data.project.trade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trade:</Text>
                    <Text style={styles.detailValue}>{data.project.trade}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.col4]}>Amount</Text>
          </View>
          {data.lineItems.map((item, index) => (
            <View
              key={index}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.col4}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          {data.tax !== undefined && data.taxRate !== undefined && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({data.taxRate}%):</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.tax)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(data.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {(data.notes || data.paymentTerms) && (
          <View style={styles.notesSection}>
            {data.paymentTerms && (
              <>
                <Text style={styles.notesTitle}>Payment Terms</Text>
                <Text style={styles.notesText}>{data.paymentTerms}</Text>
              </>
            )}
            {data.notes && (
              <>
                <Text style={[styles.notesTitle, { marginTop: data.paymentTerms ? 10 : 0 }]}>
                  Notes
                </Text>
                <Text style={styles.notesText}>{data.notes}</Text>
              </>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for your business! | Generated by FlipOps
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoiceDocument;
