/* eslint-disable no-console */
import { scrapeRealAuctionsPlaywright } from "@/lib/scrapers/vendors/realauction-playwright";
import { REALAUCTION_COUNTIES, type RealAuctionTrack } from "@/lib/scrapers/vendors/realauction";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== RealAuction Playwright — ALL 16 FL counties ===\n");

  const beforeForeclose = await prisma.foreclosure.count();
  const beforeLiens = await prisma.lien.count({ where: { lienCategory: "tax" } });

  const results: Array<{ county: string; track: RealAuctionTrack; found: number; sec: number; err?: string }> = [];
  const overall = Date.now();

  for (const c of REALAUCTION_COUNTIES) {
    for (const track of c.tracks) {
      const t0 = Date.now();
      try {
        const r = await scrapeRealAuctionsPlaywright({ countyFips: c.countyFips, track, useProxy: false });
        const sec = (Date.now() - t0) / 1000;
        const found = r?.found ?? 0;
        results.push({ county: c.subdomain, track, found, sec });
        console.log(`  ✓ ${c.subdomain.padEnd(14)} ${track.padEnd(12)} ${found.toString().padStart(4)} auctions in ${sec.toFixed(1)}s`);
      } catch (err) {
        const sec = (Date.now() - t0) / 1000;
        const msg = (err as Error).message.split("\n")[0];
        results.push({ county: c.subdomain, track, found: 0, sec, err: msg });
        console.log(`  ✗ ${c.subdomain.padEnd(14)} ${track.padEnd(12)} failed in ${sec.toFixed(1)}s: ${msg}`);
      }
    }
  }

  const afterForeclose = await prisma.foreclosure.count();
  const afterLiens = await prisma.lien.count({ where: { lienCategory: "tax" } });
  const totalFound = results.reduce((s, r) => s + r.found, 0);
  const totalSec = (Date.now() - overall) / 1000;

  console.log("\n=== Summary ===");
  console.log(`  Counties × tracks attempted: ${results.length}`);
  console.log(`  Total auctions extracted:    ${totalFound.toLocaleString()}`);
  console.log(`  Foreclosure rows persisted:  ${afterForeclose - beforeForeclose}`);
  console.log(`  Tax-lien rows persisted:     ${afterLiens - beforeLiens}`);
  console.log(`  Wall-clock:                  ${totalSec.toFixed(0)}s`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
