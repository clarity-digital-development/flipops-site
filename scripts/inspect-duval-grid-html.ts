/* eslint-disable no-console */
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

async function main() {
  const snap = await prisma.rawSnapshot.findFirst({
    where: { source: "playwright", countyFips: "12031" },
    orderBy: { capturedAt: "desc" },
  });
  const html = (snap?.rawResponse as { htmlSample: string })?.htmlSample ?? "";
  const $ = cheerio.load(html);

  // Find the headers
  $("#RsltsGrid thead tr, .k-grid-header tr").each((i, tr) => {
    console.log(`Header row ${i}:`);
    $(tr).find("th").each((j, th) => {
      console.log(`  th[${j}]: "${$(th).text().trim().slice(0, 50)}"`);
    });
  });

  // Show first 3 data rows with cell structure
  $("#RsltsGrid tbody tr, .k-grid-content tbody tr").slice(0, 3).each((i, tr) => {
    console.log(`\nData row ${i}:`);
    $(tr).find("td").each((j, td) => {
      const t = $(td).text().trim();
      const cls = $(td).attr("class") ?? "";
      console.log(`  td[${j}] class="${cls.slice(0, 30)}": "${t.slice(0, 80)}"`);
    });
  });

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
