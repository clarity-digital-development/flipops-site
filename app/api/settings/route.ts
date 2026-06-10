import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;

    const user = await prisma.user.findFirst({
      where: { id: guard.userId },
      select: {
        timezone: true,
        currency: true,
        emailAlerts: true,
        dailyDigest: true,
        digestTime: true,
        emailSignatureEnabled: true,
        emailSenderName: true,
        emailCompanyName: true,
        emailSignature: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requireUser();
    if ("error" in guard) return guard.error;

    const body = await request.json();

    const user = await prisma.user.findFirst({
      where: { id: guard.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only update fields that are provided
    const updateData: Record<string, unknown> = {};

    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.emailAlerts !== undefined) updateData.emailAlerts = body.emailAlerts;
    if (body.dailyDigest !== undefined) updateData.dailyDigest = body.dailyDigest;
    if (body.digestTime !== undefined) updateData.digestTime = body.digestTime;
    if (body.emailSignatureEnabled !== undefined) updateData.emailSignatureEnabled = body.emailSignatureEnabled;
    if (body.emailSenderName !== undefined) updateData.emailSenderName = body.emailSenderName;
    if (body.emailCompanyName !== undefined) updateData.emailCompanyName = body.emailCompanyName;
    if (body.emailSignature !== undefined) updateData.emailSignature = body.emailSignature;

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
