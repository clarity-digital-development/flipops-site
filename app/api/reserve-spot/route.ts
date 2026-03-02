import { NextRequest, NextResponse } from 'next/server';
import { reserveSpotSchema } from '@/lib/validations/reserve-spot';
import { appendRow } from '@/lib/integrations/sheets';
import { sendEmail, addToAudience } from '@/lib/integrations/resend';

/**
 * POST /api/reserve-spot
 * Public endpoint — no auth required.
 * Collects pre-launch reservation signups, writes to Google Sheets + Resend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reserveSpotSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { firstName, lastName, company, email, phone, city, state, featureInterests, feedback } = parsed.data;
    const timestamp = new Date().toISOString();
    const providedFeedback =
      (featureInterests && featureInterests.length > 0) ||
      (!!feedback && feedback.trim().length > 0);

    // Fire Google Sheets + Resend in parallel — one failing doesn't block the other
    const [sheetsResult, emailResult, audienceResult] = await Promise.allSettled([
      // 1. Append row to Google Sheets (CRM)
      appendRow(
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
        process.env.GOOGLE_SHEETS_SHEET_NAME || 'Demo Signups',
        [
          timestamp,
          firstName,
          lastName,
          company || '',
          email,
          phone || '',
          city,
          state,
          featureInterests?.length ? JSON.stringify(featureInterests) : '',
          feedback || '',
        ]
      ),

      // 2. Send confirmation email to submitter
      sendEmail({
        to: email,
        subject: "You're on the list — FlipOps Early Access",
        html: buildConfirmationEmail(firstName),
        tags: [{ name: 'type', value: 'reservation' }],
      }),

      // 3. Add to Resend Audience for future email sequences
      addToAudience({
        email,
        firstName,
        lastName,
      }),
    ]);

    // Internal notification (non-blocking)
    sendEmail({
      to: 'hello@flipops.io',
      subject: `New Reserve: ${firstName} ${lastName}`,
      html: `
        <h2>New Reservation</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Company:</strong> ${company || 'N/A'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Location:</strong> ${city}, ${state}</p>
        <p><strong>Feature Interests:</strong> ${featureInterests?.join(', ') || 'None'}</p>
        <p><strong>Feedback:</strong> ${feedback || 'None'}</p>
        <p><strong>Provided Feedback:</strong> ${providedFeedback ? 'Yes' : 'No'}</p>
        <p><small>Submitted: ${timestamp}</small></p>
      `,
    }).catch((err) => console.error('Internal notification failed:', err));

    // Log any individual failures
    if (sheetsResult.status === 'rejected') {
      console.error('Google Sheets append failed:', sheetsResult.reason);
    }
    if (emailResult.status === 'rejected') {
      console.error('Confirmation email failed:', emailResult.reason);
    }
    if (audienceResult.status === 'rejected') {
      console.error('Resend audience add failed:', audienceResult.reason);
    }

    return NextResponse.json({
      success: true,
      providedFeedback,
      trialGranted: providedFeedback,
      betaAccess: providedFeedback,
      message: providedFeedback
        ? "You're in! Free 1-month trial + full beta access activated."
        : "Your spot is reserved! We'll be in touch soon.",
    });
  } catch (error) {
    console.error('Reserve-spot error:', error);
    return NextResponse.json(
      { error: 'Failed to process reservation' },
      { status: 500 }
    );
  }
}

function buildConfirmationEmail(firstName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f6;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <h1 style="margin: 0 0 8px; font-size: 24px; color: #111;">You're on the list, ${firstName}.</h1>
          <p style="margin: 0 0 24px; font-size: 16px; color: #555; line-height: 1.5;">
            Thanks for reserving your spot with FlipOps. We're building the platform real estate investors actually need — and you'll be among the first to use it.
          </p>
          <p style="margin: 0 0 24px; font-size: 16px; color: #555; line-height: 1.5;">
            We'll reach out soon with early access details. In the meantime, keep an eye on your inbox.
          </p>
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 24px;">
            <p style="margin: 0; font-size: 13px; color: #999;">
              FlipOps · Real estate investment automation<br>
              <a href="https://flipops.io" style="color: #0d9488; text-decoration: none;">flipops.io</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
