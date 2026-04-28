import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { refreshCounty, listScrapeableCounties } from "@/lib/data-sources";

// ---------------------------------------------------------------------------
// /api/scrapers/test — admin endpoint to trigger a scraper manually.
//
// GET  → list registered scrapers
// POST → run a scrape: { countyFips, category, dryRun? }
//
// Auth: Clerk session required (admin-only is enforced separately if needed).
// Not exposed in production UI yet — intended for engineering smoke-tests
// while we build out per-county scrapers.
// ---------------------------------------------------------------------------

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    counties: listScrapeableCounties(),
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { countyFips?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { countyFips, category } = body;
  if (!countyFips || !category) {
    return NextResponse.json(
      { error: "countyFips and category are required" },
      { status: 400 },
    );
  }

  if (
    !["tax_delinquency", "assessment", "foreclosure", "lien", "permit", "deed"].includes(
      category,
    )
  ) {
    return NextResponse.json(
      { error: `Unknown category: ${category}` },
      { status: 400 },
    );
  }

  const result = await refreshCounty(
    countyFips,
    category as "tax_delinquency" | "assessment" | "foreclosure" | "lien" | "permit" | "deed",
    "user_request",
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
