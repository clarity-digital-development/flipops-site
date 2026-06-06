import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { resolveCountyFromZip } from "@/lib/data-sources/zip-to-county";
import { refreshCounty, listScrapeableCounties } from "@/lib/data-sources";

// ---------------------------------------------------------------------------
// POST /api/leads/pull-by-zip
//
// The product loop: user types a ZIP on the Leads map and hits "Pull leads".
// We resolve ZIP → county FIPS → scraper, trigger a scrape, and the freshly
// scraped properties land in the Property table where the map reads them.
//
// Resolution order:
//   1. If we have a registered scraper for the ZIP's county → scrape it (cheap)
//   2. Else → signal the caller to fall back to BatchData API (per-call cost)
//
// Body: { zip: string, category?: "tax_delinquency" | "assessment" }
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  category: z
    .enum(["tax_delinquency", "assessment", "foreclosure"])
    .default("assessment"),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { zip, category } = parsed;
  const county = resolveCountyFromZip(zip);

  if (!county) {
    return NextResponse.json({
      ok: false,
      strategy: "api_fallback",
      message: `No county mapping for ZIP ${zip}. Fall back to BatchData.`,
    });
  }

  const scrapeable = listScrapeableCounties().map((c) => c.countyFips);
  if (!scrapeable.includes(county.fips)) {
    return NextResponse.json({
      ok: false,
      strategy: "api_fallback",
      county,
      message: `${county.county}, ${county.state} (FIPS ${county.fips}) not yet onboarded for scraping. Fall back to BatchData.`,
    });
  }

  // We have a scraper for this county — run it.
  const result = await refreshCounty(county.fips, category, "user_request");
  return NextResponse.json(
    {
      ok: result.ok,
      strategy: "scraper",
      county,
      recordsScraped: result.recordsScraped,
      message: result.message,
    },
    { status: result.ok ? 200 : 502 },
  );
}
