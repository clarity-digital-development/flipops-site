import { NextRequest, NextResponse } from 'next/server';
import type { ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/auth-helpers';
import { InvoiceDocument, InvoiceData } from '@/lib/pdf-templates';

/**
 * POST /api/documents/generate-invoice
 * Generate an invoice PDF
 *
 * Body can contain:
 * - invoiceId: string (to generate from existing invoice)
 * OR
 * - Custom invoice data for ad-hoc generation
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

    // Get user info for company details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    if (body.invoiceId) {
      // Generate from existing invoice in database
      const invoice = await prisma.invoice.findUnique({
        where: { id: body.invoiceId },
        include: {
          vendor: true,
        },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      // Get deal info for project details
      const deal = await prisma.dealSpec.findUnique({
        where: { id: invoice.dealId },
        select: { address: true },
      });

      invoiceData = {
        invoiceNumber: invoice.id.slice(-8).toUpperCase(),
        invoiceDate: invoice.createdAt.toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
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
      // Use provided invoice data (ad-hoc generation)
      if (!body.vendor || !body.lineItems || !body.total) {
        return NextResponse.json(
          { error: 'Missing required fields: vendor, lineItems, total' },
          { status: 400 }
        );
      }

      // Calculate subtotal if not provided
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

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/generate-invoice?invoiceId=xxx
 * Quick way to download an invoice PDF
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserId();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.userId!;

    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, companyName: true },
    });

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        vendor: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get deal info
    const deal = await prisma.dealSpec.findUnique({
      where: { id: invoice.dealId },
      select: { address: true },
    });

    const invoiceData: InvoiceData = {
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

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({ data: invoiceData }) as ReactElement<DocumentProps>
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    );
  }
}
