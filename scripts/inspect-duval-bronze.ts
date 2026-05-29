/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const snap = await prisma.rawSnapshot.findFirst({
    where: { source: "playwright", countyFips: "12031" },
    orderBy: { capturedAt: "desc" },
  });
  if (!snap) {
    console.log("No bronze row");
    return;
  }
  const r = snap.rawResponse as { extracted: unknown[]; htmlBytes: number; htmlSample: string };
  console.log("Captured at:", snap.capturedAt);
  console.log("Extracted rows:", r.extracted?.length);
  console.log("HTML bytes:", r.htmlBytes);
  console.log("\n--- HTML SAMPLE [0:3000] ---");
  console.log((r.htmlSample ?? "").slice(0, 3000));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
