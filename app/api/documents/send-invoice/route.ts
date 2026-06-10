import { NextRequest, NextResponse } from 'next/server';
import type { ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-helpers';
import { InvoiceDocument, InvoiceData } from '@/lib/pdf-templates';
import { sendInvoiceEmail } from '@/lib/email';

/**
 * POST /api/documents/send-invoice
 * Generate and email an invoice PDF to a vendor
 *
 * Body:
 * - invoiceId: string (to generate from existing invoice)
 * - to?: string (override recipient email)
 * OR
 * - Custom invoice data + to email
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    const body = await request.json();
    let invoiceData: InvoiceData;
    let recipientEmail: string;
    let vendorName: string;
    let projectAddress: string | undefined;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    if (body.invoiceId) {
      // Generate from existing invoice
      const invoice = await prisma.invoice.findUnique({
        where: { id: body.invoiceId },
        include: {
          vendor: true,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (!invoice.vendor?.email && !body.to) {
        return NextResponse.json(
          { error: 'Vendor has no email address. Please provide a "to" email.' },
          { status: 400 }
        );
      }

      recipientEmail = body.to || invoice.vendor!.email!;
      vendorName = invoice.vendor?.name || 'Vendor';

      // Get deal info
      const deal = await prisma.dealSpec.findUnique({
        where: { id: invoice.dealId },
        select: { address: true },
      });

      projectAddress = deal?.address;

      invoiceData = {
        invoiceNumber: invoice.id.slice(-8).toUpperCase(),
        invoiceDate: invoice.createdAt.toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: invoice.status as 'pending' | 'approved' | 'paid',
        vendor: {
          name: invoice.vendor?.name || 'Unknown Vendor',
          email: invoice.vendor?.email || undefined,
          phone: invoice.vendor?.phone || undefined,
        },
        company: {
          name: user?.companyName || user?.name || 'FlipOps User',
          email: user?.email || undefined,
        },
        project: deal ? {
          address: deal.address,
          trade: invoice.trade,
        } : undefined,
        lineItems: [{
          description: `${invoice.trade} services`,
          quantity: 1,
          unitPrice: invoice.amount,
          total: invoice.amount,
        }],
        subtotal: invoice.amount,
        total: invoice.amount,
        paymentTerms: 'Net 30 - Payment due within 30 days of invoice date.',
      };
    } else {
      // Ad-hoc invoice
      if (!body.to) {
        return NextResponse.json({ error: 'Missing required field: to' }, { status: 400 });
      }
      if (!body.vendor || !body.lineItems || !body.total) {
        return NextResponse.json(
          { error: 'Missing required fields: vendor, lineItems, total' },
          { status: 400 }
        );
      }

      recipientEmail = body.to;
      vendorName = body.vendor.name;
      projectAddress = body.project?.address;

      const subtotal = body.subtotal || body.lineItems.reduce(
        (sum: number, item: { total: number }) => sum + item.total,
        0
      );

      invoiceData = {
        invoiceNumber: body.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`,
        invoiceDate: body.invoiceDate || new Date().toISOString(),
        dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: body.status || 'pending',
        vendor: body.vendor,
        company: body.company || {
          name: user?.companyName || user?.name || 'FlipOps User',
          email: user?.email || undefined,
        },
        project: body.project,
        lineItems: body.lineItems,
        subtotal: subtotal,
        tax: body.tax,
        taxRate: body.taxRate,
        total: body.total,
        notes: body.notes,
        paymentTerms: body.paymentTerms || 'Net 30 - Payment due within 30 days of invoice date.',
      };
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({ data: invoiceData }) as ReactElement<DocumentProps>
    );

    // Send email
    const emailResult = await sendInvoiceEmail({
      to: recipientEmail,
      vendorName: vendorName,
      invoiceNumber: invoiceData.invoiceNumber,
      amount: invoiceData.total,
      dueDate: invoiceData.dueDate,
      projectAddress: projectAddress,
      pdfBuffer: Buffer.from(pdfBuffer),
      from: user?.email || undefined,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
      messageId: emailResult.messageId,
      invoiceNumber: invoiceData.invoiceNumber,
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
