import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Guards the /api/properties UNION arity invariant.
//
// The endpoint UNION-ALLs four lead-source branches (mine, tax-virtual, auction,
// probate). Postgres requires EVERY branch of a UNION to project the same number
// of columns, or it throws "each UNION query must have the same number of
// columns" at RUNTIME — which `tsc` cannot see because the SQL lives inside
// Prisma.sql template strings. A column added to only some branches (exactly what
// happened with attorney_name/attorney_address in cd4a23d) ships a green
// typecheck and then 500s the DEFAULT leads list (source=all assembles all four
// branches). This test fails the moment a trailing marker column is missing from
// any branch.
describe("/api/properties UNION column arity", () => {
  const src = readFileSync(
    path.join(process.cwd(), "app/api/properties/route.ts"),
    "utf8",
  );
  const aliasCount = (alias: string): number =>
    (src.match(new RegExp(`AS ${alias}\\b`, "g")) || []).length;

  it("projects case_count in all four UNION branches", () => {
    // mine + tax-virtual + auction + probate
    expect(aliasCount("case_count")).toBe(4);
  });

  it("projects attorney_name/attorney_address in EVERY branch that has case_count", () => {
    const branches = aliasCount("case_count");
    expect(aliasCount("attorney_name")).toBe(branches);
    expect(aliasCount("attorney_address")).toBe(branches);
  });
});
