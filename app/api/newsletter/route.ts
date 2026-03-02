import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appendRow } from '@/lib/integrations/sheets';
import { addToAudience } from '@/lib/integrations/resend';

const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

/**
 * POST /api/newsletter
 * Public endpoint — no auth required.
 * Adds email to newsletter Google Sheet + Resend Audience.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = newsletterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    const [sheetsResult, audienceResult] = await Promise.allSettled([
      appendRow(
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
        'Newsletter',
        [new Date().toISOString(), email, 'newsletter']
      ),
      addToAudience({ email }),
    ]);

    if (sheetsResult.status === 'rejected') {
      console.error('Newsletter sheets append failed:', sheetsResult.reason);
    }
    if (audienceResult.status === 'rejected') {
      console.error('Newsletter audience add failed:', audienceResult.reason);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
