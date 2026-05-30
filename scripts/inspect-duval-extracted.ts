/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const snap = await prisma.rawSnapshot.findFirst({
    where: { source: "playwright", countyFips: "12031" },
    orderBy: { capturedAt: "desc" },
  });
  const r = snap?.rawResponse as { extracted: Array<Record<string, unknown>>; htmlBytes: number; htmlSample?: string };
  console.log("Rows extracted:", r.extracted?.length);
  console.log("HTML bytes:", r.htmlBytes);

  console.log("\nFirst 5 extracted rows (full):");
  r.extracted?.slice(0, 5).forEach((row, i) => console.log(`  [${i}]:`, JSON.stringify(row)));

  console.log("\nDocument types distribution:");
  const types: Record<string, number> = {};
  r.extracted?.forEach((row) => {
    const t = String(row.documentType ?? "?");
    types[t] = (types[t] || 0) + 1;
  });
  Object.entries(types).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${c} × "${t}"`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
