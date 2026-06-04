import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// T2 — Leads UI auction flow smoke test (v0.1 polish).
//
// Three assertion tiers:
//   1. UI shell: filter bar + auction filter chip render unconditionally.
//   2. Filter interaction: clicking the "Auction Scheduled" chip toggles state
//      without crashing the page.
//   3. Conditional promote: IF the filtered list has at least one virt-fc row,
//      click it, assert the detail sheet opens, assert no error toast, and
//      assert a POST to /api/properties/promote fired. IF the list is empty
//      (the 0-row morning case), log a skip and exit cleanly.
//
// Run with:
//   E2E_BASE_URL=https://flipops.io npx playwright test
//
// Pre-launch the /app(.*) route is in middleware's public-bypass list, so the
// test does NOT need to handle Clerk auth. When auth is re-enabled, add a
// test-only sign-in step or a staging-only bypass token here.
// ---------------------------------------------------------------------------

test.describe("Leads UI — auction flow", () => {
  test("renders UI shell + filter interaction + conditional promote", async ({ page }) => {
    // Capture promote-endpoint requests so we can assert on them later.
    const promoteRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/properties/promote")) {
        promoteRequests.push(req.method());
      }
    });

    // -----------------------------------------------------------------------
    // Assertion 1: UI shell renders.
    // -----------------------------------------------------------------------
    await page.goto("/app/leads");

    // Wait for the filter bar to render. The "Auction Scheduled" chip is a
    // button with that exact text inside the LeadFilterBar.
    const auctionFilterChip = page.getByRole("button", { name: /Auction Scheduled/i });
    await expect(auctionFilterChip).toBeVisible({ timeout: 20_000 });

    // -----------------------------------------------------------------------
    // Assertion 2: Filter interaction.
    // -----------------------------------------------------------------------
    await auctionFilterChip.click();

    // aria-pressed should flip to true once the chip is active.
    await expect(auctionFilterChip).toHaveAttribute("aria-pressed", "true");

    // Give the list a moment to re-filter; the lead count badge in the toolbar
    // will update.
    await page.waitForTimeout(500);

    // -----------------------------------------------------------------------
    // Assertion 3 (conditional): if virt-fc rows are present, click first one.
    // -----------------------------------------------------------------------
    // The LeadListPanel renders rows. We look for any row containing the
    // red "Auction" badge (Gavel icon + label) which only renders for
    // dataSource === 'parcel-auction-bridge' rows.
    const auctionBadgedRows = page.locator(
      '[data-lead-id]:has-text("Auction")',
    );
    const rowCount = await auctionBadgedRows.count();

    if (rowCount === 0) {
      test.info().annotations.push({
        type: "skip-reason",
        description:
          "No auction-virtual rows present in the filtered list (post-holiday morning or pre-scrape window). UI shell + filter interaction verified; skipping promote flow.",
      });
      console.log(
        "[e2e:leads-auction] No virt-fc rows visible; skipping promote-click assertion.",
      );
      return;
    }

    // Click the first virt-fc row. handleSelect fires promoteIfVirtual which
    // POSTs /api/properties/promote and swaps the id.
    await auctionBadgedRows.first().click();

    // Assertion 3a: detail sheet opens (Radix Sheet has role="dialog").
    const detailSheet = page.getByRole("dialog");
    await expect(detailSheet).toBeVisible({ timeout: 10_000 });

    // Assertion 3b: promote endpoint was called (request captured above).
    // We poll briefly because the POST is fired async from handleSelect.
    await expect
      .poll(() => promoteRequests.length, {
        message: "Expected at least one POST to /api/properties/promote",
        timeout: 5_000,
      })
      .toBeGreaterThanOrEqual(1);
    expect(promoteRequests[0]).toBe("POST");

    // Assertion 3c: no destructive toast appeared. The shadcn/ui toast root
    // has data-state="open" when a toast is visible. We check that none of
    // them carry the destructive variant.
    const destructiveToast = page.locator(
      '[data-state="open"][data-variant="destructive"]',
    );
    await expect(destructiveToast).toHaveCount(0);
  });
});
