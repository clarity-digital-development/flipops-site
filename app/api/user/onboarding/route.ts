import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/require-user';

// POST /api/user/onboarding
// Complete onboarding flow and set investor type
export async function POST(request: Request) {
  try {
    const guard = await requireUser();
    if ('error' in guard) return guard.error;
    const { userId } = guard;

    const body = await request.json();
    const { investorType, investorProfile } = body;

    // Validate investor type
    const validTypes = ['wholesaler', 'flipper', 'buy_and_hold', 'hybrid'];
    if (!investorType || !validTypes.includes(investorType)) {
      return NextResponse.json(
        { error: 'Invalid investor type. Must be one of: wholesaler, flipper, buy_and_hold, hybrid' },
        { status: 400 }
      );
    }

    // Look up current investorProfile to preserve it when new value not provided
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { investorProfile: true },
    });

    // Update user with investor type and mark onboarding complete
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        investorType,
        onboardingComplete: true,
        investorProfile: investorProfile ? JSON.stringify(investorProfile) : existing?.investorProfile,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        investorType: updatedUser.investorType,
        onboardingComplete: updatedUser.onboardingComplete,
        investorProfile: updatedUser.investorProfile ? JSON.parse(updatedUser.investorProfile) : null,
      },
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
