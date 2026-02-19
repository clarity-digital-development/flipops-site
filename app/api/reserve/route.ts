import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reservationSchema } from '@/lib/validations/reservation';

/**
 * POST /api/reserve
 * Public endpoint — no auth required.
 * Collects pre-launch reservation signups with optional feature feedback.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = reservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const providedFeedback =
      (data.featureInterests && data.featureInterests.length > 0) ||
      (!!data.feedback && data.feedback.trim().length > 0);

    const reservationData = {
      phone: data.phone || null,
      city: data.city,
      state: data.state,
      featureInterests: data.featureInterests?.length
        ? JSON.stringify(data.featureInterests)
        : null,
      feedback: data.feedback || null,
      providedFeedback,
      trialGranted: providedFeedback,
      betaAccess: providedFeedback,
    };

    await prisma.reservation.upsert({
      where: { email: data.email.toLowerCase() },
      update: reservationData,
      create: {
        email: data.email.toLowerCase(),
        ...reservationData,
      },
    });

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
    console.error('Reservation error:', error);
    return NextResponse.json(
      { error: 'Failed to process reservation' },
      { status: 500 }
    );
  }
}
