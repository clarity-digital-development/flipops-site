import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// requireAdmin() helper unit tests.
//
// Three cases (matches the verifier's spec):
//   1. unauthenticated → 401
//   2. authenticated non-admin → 403
//   3. authenticated admin → success with userId
//
// Mocks @clerk/nextjs/server.auth() + the prisma User.findUnique lookup so
// the test runs offline (no Railway PG dependency).
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (args: unknown) => mockUserFindUnique(args),
    },
  },
}));

// Import AFTER the mocks are registered.
import { requireAdmin, _internal } from "../../lib/auth/require-admin";

describe("requireAdmin()", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockUserFindUnique.mockReset();
    delete process.env.ADMIN_EMAIL;
  });

  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const result = await requireAdmin();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
      const body = await result.error.json();
      expect(body.error).toBe("Unauthorized");
    }
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when Clerk session is valid but no User row exists", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_user_orphan" });
    mockUserFindUnique.mockResolvedValue(null);
    const result = await requireAdmin();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(404);
    }
  });

  it("returns 403 when signed-in user is NOT the admin email", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_user_civilian" });
    mockUserFindUnique.mockResolvedValue({
      id: "db-uid-1",
      email: "someone-else@example.com",
    });
    const result = await requireAdmin();
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(403);
      const body = await result.error.json();
      expect(body.error).toBe("Forbidden");
    }
  });

  it("returns userId+email when signed-in user IS the admin email", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_admin" });
    mockUserFindUnique.mockResolvedValue({
      id: "db-uid-admin",
      email: "tannercarlson@vvsvault.com",
    });
    const result = await requireAdmin();
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.userId).toBe("db-uid-admin");
      expect(result.email).toBe("tannercarlson@vvsvault.com");
    }
  });

  it("admin email comparison is case-insensitive", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_admin_caps" });
    mockUserFindUnique.mockResolvedValue({
      id: "db-uid-2",
      email: "TannerCarlson@VVSvault.com",
    });
    const result = await requireAdmin();
    expect("error" in result).toBe(false);
  });

  it("respects ADMIN_EMAIL env override when set", async () => {
    process.env.ADMIN_EMAIL = "alt-admin@flipops.io";
    mockAuth.mockResolvedValue({ userId: "clerk_alt_admin" });
    mockUserFindUnique.mockResolvedValue({
      id: "db-uid-3",
      email: "alt-admin@flipops.io",
    });
    const result = await requireAdmin();
    expect("error" in result).toBe(false);

    // Confirm the hardcoded fallback no longer matches when env overrides.
    mockAuth.mockResolvedValue({ userId: "clerk_was_admin" });
    mockUserFindUnique.mockResolvedValue({
      id: "db-uid-4",
      email: "tannercarlson@vvsvault.com",
    });
    const result2 = await requireAdmin();
    expect("error" in result2).toBe(true);
    if ("error" in result2) {
      expect(result2.error.status).toBe(403);
    }
  });
});

describe("requireAdmin internal helpers", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAIL;
  });

  it("isAdminEmail returns false for null/empty", () => {
    expect(_internal.isAdminEmail(null)).toBe(false);
    expect(_internal.isAdminEmail("")).toBe(false);
    expect(_internal.isAdminEmail(undefined)).toBe(false);
  });

  it("isAdminEmail uses fallback when env unset", () => {
    expect(_internal.isAdminEmail(_internal.FALLBACK_ADMIN_EMAIL)).toBe(true);
  });
});
