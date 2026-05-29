/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";

async function main() {
  const snap = await prisma.rawSnapshot.findFirst({
    where: { source: "playwright", countyFips: "12031" },
    orderBy: { capturedAt: "desc" },
  });
  const r = snap?.rawResponse as { htmlSample: string };
  const html = r?.htmlSample ?? "";
  const hasRsltsGrid = html.includes("RsltsGrid");
  const hasKGrid = html.includes("k-grid");
  const hasNoResults = /no results|no record|0 record/i.test(html);
  const hasError = /error|exception/i.test(html);
  const hasSearchForm = /<form[^>]*id="schfrm"/.test(html);
  console.log("HTML length:", html.length);
  console.log("Has #RsltsGrid:", hasRsltsGrid);
  console.log("Has k-grid (Kendo):", hasKGrid);
  console.log("Says 'no results':", hasNoResults);
  console.log("Has error word:", hasError);
  console.log("Has search form:", hasSearchForm);

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/);
  const bodyText = (bodyMatch?.[0] ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  console.log("\nVisible body text:");
  console.log(bodyText.slice(0, 2000));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
