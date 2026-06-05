import { test, expect } from './fixtures/auction-parcel';

// ---------------------------------------------------------------------------
// T6 — Leads UI auction promote e2e (v0.2, fixture-driven).
//
// Three assertion tiers — ALL run unconditionally now that the
// seededAuctionParcel fixture guarantees a deterministic virt-fc row in the
// /api/properties UNION response:
//   1. UI shell:   filter bar + 'Auction Scheduled' chip render.
//   2. Filter:     clicking the chip toggles aria-pressed and re-fetches
//                  /api/properties. We wait for the response before counting.
//   3. Promote:    locating the seeded row by its predictable virtual id,
//                  clicking it to open the LeadDetailSheet, then clicking the
//                  'Log Contact' action button inside the sheet to trigger
//                  withPromote(handleLogContact) -> POST /api/properties/promote.
//
// IMPORTANT — why 'Log Contact' and not the row click itself:
//   handleSelect in app/app/leads/page.tsx (lines 136-142) only sets
//   selectedId + opens the sheet + fires trackLeadEvent('opened'). It does
//   NOT call promoteIfVirtual. The promote POST is only fired through the
//   withPromote() wrappers on the four action handlers passed to
//   LeadDetailSheet (Skip Trace, Log Contact, Send to Underwriting, Add to
//   Campaign — page.tsx:398-401). 'Log Contact' is the safest choice for an
//   e2e test because it stays on the leads page (Send to Underwriting
//   navigates to /app/underwriting; Skip Trace + Add to Campaign open
//   additional modals).
//
// Run with:
//   E2E_BASE_URL=https://flipops.io \
//   DATABASE_URL=postgres://... \
//   E2E_ALLOW_DB_SEED=1 \
//   npx playwright test tests/e2e/leads-auction-promote.spec.ts
//
// Pre-launch the /app(.*) route is in middleware's public-bypass list
// (middleware.ts line 52), so the page renders without Clerk auth. However,
// /api/properties/promote/route.ts STILL calls auth() and returns 401 without
// a Clerk session — the public bypass applies to the middleware layer, not
// to handler-level Clerk checks. This means the spec will see promote return
// 401 without a Clerk test session. We assert that the POST FIRED (request
// was captured), not that it succeeded — the request capture happens before
// the network response, so the assertion is robust to either outcome. When
// Clerk auth is re-enabled for /app(.*) at beta cutover, both the page
// render AND the promote response will need a test session wired in.
// ---------------------------------------------------------------------------

test.describe('Leads UI — auction promote flow', () => {
  test('renders shell, filters, opens sheet, fires promote POST on action click', async ({
    page,
    seededAuctionParcel,
  }) => {
    // Capture promote-endpoint requests. We record the method so we can
    // assert on whether the POST was emitted regardless of the response status.
    const promoteRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/properties/promote')) {
        promoteRequests.push(req.method());
      }
    });

    // -----------------------------------------------------------------------
    // Assertion 1: UI shell renders.
    // -----------------------------------------------------------------------
    await page.goto('/app/leads');
    await page.waitForLoadState('networkidle');

    const auctionFilterChip = page.getByRole('button', {
      name: /Auction Scheduled/i,
    });
    await expect(auctionFilterChip).toBeVisible({ timeout: 30_000 });

    // -----------------------------------------------------------------------
    // Assertion 2: Filter interaction. Click the chip and WAIT for the
    // /api/properties refetch to complete before asserting on rows. This
    // replaces the v0.1 hardcoded waitForTimeout(500) which was racey against
    // Railway PG cold-roundtrip latency.
    // -----------------------------------------------------------------------
    const filterResponsePromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/api/properties') &&
          resp.request().method() === 'GET',
        { timeout: 30_000 },
      )
      .catch(() => {
        // Some implementations memoize the filter client-side and skip the
        // refetch — that's fine, we'll fall back on the locator timeout below.
      });
    await auctionFilterChip.click();
    await expect(auctionFilterChip).toHaveAttribute('aria-pressed', 'true');
    await filterResponsePromise;

    // -----------------------------------------------------------------------
    // Assertion 3: Promote flow (unconditional — fixture guarantees a row).
    // -----------------------------------------------------------------------
    // Locate the seeded row by the predictable virtual id the auction-virtual
    // branch produces: virt-fc-{countyFips}-{apn}. Unique and stable against
    // any text-rendering changes in LeadListPanel.
    const seededRowLocator = `[data-lead-id="${seededAuctionParcel.virtualId}"]`;
    const seededRow = page.locator(seededRowLocator);
    await expect(seededRow).toHaveCount(1, { timeout: 20_000 });

    // Sanity-check the row carries the seeded address (defends against the
    // /api/properties auction-virtual SQL silently changing its address
    // COALESCE chain in a way that drops situsAddress).
    await expect(seededRow).toContainText(seededAuctionParcel.address);

    // Click the seeded row -> handleSelect opens the LeadDetailSheet but does
    // NOT call promote. The sheet is a Radix Sheet (role=dialog).
    await seededRow.click();

    // Assertion 3a: detail sheet opens. Scope by hasText so we never match a
    // toast/command-palette/etc dialog that may also be open.
    const detailSheet = page.getByRole('dialog').filter({
      hasText: seededAuctionParcel.address,
    });
    await expect(detailSheet).toBeVisible({ timeout: 15_000 });

    // Assertion 3b: click 'Log Contact' inside the sheet to trigger
    // withPromote(handleLogContact) -> promoteIfVirtual -> POST
    // /api/properties/promote.
    const logContactButton = detailSheet.getByRole('button', {
      name: /Log Contact/i,
    });
    await expect(logContactButton).toBeVisible({ timeout: 10_000 });
    await logContactButton.click();

    // Assertion 3c: promote endpoint was hit. Wider window (20s) than v0.1
    // because CI-against-Railway has stacked latency. The request is captured
    // at fire-time, BEFORE the response, so we don't depend on a successful
    // 200 (a 401 from auth() still satisfies the capture).
    await expect
      .poll(() => promoteRequests.length, {
        message: 'Expected at least one POST to /api/properties/promote',
        timeout: 20_000,
      })
      .toBeGreaterThanOrEqual(1);
    expect(promoteRequests[0]).toBe('POST');

    // Assertion 3d: no destructive toast appeared. This project uses shadcn/ui
    // Toaster (NOT Sonner — see CLAUDE.md). We do NOT block on a 200 response
    // because the promote endpoint may legitimately return 401 in the
    // pre-launch unauthenticated path; what we DO assert is that the UI didn't
    // surface an error toast to the user as a result of the click.
    const destructiveToast = page.locator(
      '[data-state="open"][data-variant="destructive"]',
    );
    await expect(destructiveToast).toHaveCount(0);
  });
});
