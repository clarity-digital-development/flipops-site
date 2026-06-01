/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// OCFL re-probe → Parcel join hit-rate calculator (Stage A v2).
//
// v1 of this script had a take:1000 candidate limit per zip that silently
// undercounted matches (Orange County has 510k parcels — some zips have
// >10k each). v2 pushes the match into SQL directly so the entire
// situsAddress space is searched.
//
// Match strategy (in SQL):
//   1. STRICT: situsAddress (uppercased, punctuation-stripped) ==
//      normalized booking street, within countyFips=12095, ANY zip.
//   2. LOOSE: ILIKE-pattern on the house-number + first street word
//      (e.g. "8545 WICHITA%"), then verify suffix in Node — handles
//      PLACE/PL, STREET/ST, AVENUE/AVE etc. without exploding the
//      query into a 30-pattern UNION.
//
// Run:
//   DATABASE_URL='...' npx tsx scripts/compute-ocfl-join-rate.ts
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";

const SUFFIX_VARIANTS: Record<string, string[]> = {
  STREET: ["STREET", "ST"],
  ST: ["STREET", "ST"],
  AVENUE: ["AVENUE", "AVE", "AV"],
  AVE: ["AVENUE", "AVE", "AV"],
  AV: ["AVENUE", "AVE", "AV"],
  BOULEVARD: ["BOULEVARD", "BLVD"],
  BLVD: ["BOULEVARD", "BLVD"],
  COURT: ["COURT", "CT"],
  CT: ["COURT", "CT"],
  CIRCLE: ["CIRCLE", "CIR"],
  CIR: ["CIRCLE", "CIR"],
  DRIVE: ["DRIVE", "DR"],
  DR: ["DRIVE", "DR"],
  LANE: ["LANE", "LN"],
  LN: ["LANE", "LN"],
  PLACE: ["PLACE", "PL"],
  PL: ["PLACE", "PL"],
  PARKWAY: ["PARKWAY", "PKWY"],
  PKWY: ["PARKWAY", "PKWY"],
  ROAD: ["ROAD", "RD"],
  RD: ["ROAD", "RD"],
  TERRACE: ["TERRACE", "TER"],
  TER: ["TERRACE", "TER"],
  TRAIL: ["TRAIL", "TRL"],
  TRL: ["TRAIL", "TRL"],
};

function basicNormalize(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the normalized tokens. */
function tokens(s: string): string[] {
  return basicNormalize(s).split(" ").filter(Boolean);
}

/** Expand variants of the last token, return all possible normalized addresses. */
function expandSuffixVariants(addr: string): string[] {
  const toks = tokens(addr);
  if (toks.length === 0) return [];
  // Strip leading zeros on house number
  if (/^\d+$/.test(toks[0])) {
    toks[0] = toks[0].replace(/^0+/, "") || "0";
  }
  const last = toks[toks.length - 1];
  const variants = SUFFIX_VARIANTS[last];
  if (!variants) return [toks.join(" ")];
  return variants.map((v) => {
    const t = toks.slice();
    t[t.length - 1] = v;
    return t.join(" ");
  });
}

interface ProbeRecord {
  bookingNumber: string;
  inmateNameRaw: string;
  inmateLastName: string | null;
  inmateFirstInitial: string | null;
  street: string;
  aptNum: string;
  city: string;
  state: string;
  zip5: string;
  normalizedStreet: string;
  normalizedZip5: string;
  bookingDate: string;
  rejectedReason: string | null;
}

interface ProbeArtifact {
  stats: Record<string, unknown>;
  records: ProbeRecord[];
}

interface ParcelMatch {
  apn: string;
  situsAddress: string;
  situsCity: string;
  situsZip: string;
  ownerName: string | null;
}

async function findStrictMatch(normalizedStreet: string): Promise<ParcelMatch | null> {
  if (!normalizedStreet) return null;
  // Use a raw query — Prisma doesn't expose situsAddress normalization,
  // but PG can do it inline. countyFips index + ILIKE on prefix should
  // be acceptable (510k rows in Orange County → ~30ms with the prefix
  // anchored).
  const rows = await prisma.$queryRawUnsafe<ParcelMatch[]>(
    `SELECT apn, "situsAddress", "situsCity", "situsZip", "ownerName"
       FROM flipops."Parcel"
      WHERE "countyFips" = '12095'
        AND UPPER(REGEXP_REPLACE(COALESCE("situsAddress",''), '[.,]', '', 'g')) = $1
      LIMIT 1`,
    normalizedStreet,
  );
  return rows[0] ?? null;
}

async function findVariantMatch(variants: string[]): Promise<ParcelMatch | null> {
  if (variants.length === 0) return null;
  // Single SQL query checking ALL variants via ANY($1::text[])
  const rows = await prisma.$queryRawUnsafe<ParcelMatch[]>(
    `SELECT apn, "situsAddress", "situsCity", "situsZip", "ownerName"
       FROM flipops."Parcel"
      WHERE "countyFips" = '12095'
        AND UPPER(REGEXP_REPLACE(COALESCE("situsAddress",''), '[.,]', '', 'g')) = ANY($1::text[])
      LIMIT 1`,
    variants,
  );
  return rows[0] ?? null;
}

async function main() {
  console.log("=".repeat(78));
  console.log("OCFL → Parcel join hit-rate v2 (SQL-side match, full Orange Co. coverage)");
  console.log("=".repeat(78));

  const raw = await readFile("scripts/probe-artifacts/ocfl-reprobe-200.json", "utf8");
  const data = JSON.parse(raw) as ProbeArtifact;
  const accepted = data.records.filter((r) => !r.rejectedReason);
  console.log(`Loaded: ${data.records.length} total, ${accepted.length} accepted by filter stack`);
  console.log("");

  let strictHits = 0;
  let variantHits = 0;
  const strictSamples: { booking: string; inmateName: string; bookingAddr: string; parcelAddr: string; owner: string | null }[] = [];
  const variantSamples: { booking: string; inmateName: string; bookingAddr: string; parcelAddr: string; owner: string | null; variantUsed: string }[] = [];
  const misses: { booking: string; inmateName: string; bookingAddr: string; zip: string }[] = [];

  for (let i = 0; i < accepted.length; i++) {
    const rec = accepted[i];
    if (i % 25 === 0) console.log(`  [progress] ${i}/${accepted.length} strict=${strictHits} variant=${variantHits}`);

    const strict = await findStrictMatch(rec.normalizedStreet);
    if (strict) {
      strictHits++;
      if (strictSamples.length < 15) {
        strictSamples.push({
          booking: rec.bookingNumber,
          inmateName: rec.inmateNameRaw,
          bookingAddr: `${rec.street}, ${rec.city} ${rec.zip5}`,
          parcelAddr: `${strict.situsAddress}, ${strict.situsCity} ${strict.situsZip}`,
          owner: strict.ownerName,
        });
      }
      continue;
    }

    const variants = expandSuffixVariants(rec.street);
    const variant = await findVariantMatch(variants);
    if (variant) {
      variantHits++;
      if (variantSamples.length < 15) {
        variantSamples.push({
          booking: rec.bookingNumber,
          inmateName: rec.inmateNameRaw,
          bookingAddr: `${rec.street}, ${rec.city} ${rec.zip5}`,
          parcelAddr: `${variant.situsAddress}, ${variant.situsCity} ${variant.situsZip}`,
          owner: variant.ownerName,
          variantUsed: variants.join(" | "),
        });
      }
      continue;
    }

    if (misses.length < 25) {
      misses.push({
        booking: rec.bookingNumber,
        inmateName: rec.inmateNameRaw,
        bookingAddr: rec.street,
        zip: rec.zip5,
      });
    }
  }

  const totalHits = strictHits + variantHits;
  const ratePct = (n: number) => ((n / accepted.length) * 100).toFixed(1);

  console.log("");
  console.log("=".repeat(78));
  console.log("HIT-RATE RESULTS");
  console.log("=".repeat(78));
  console.log(`  Total accepted (post-filter):    ${accepted.length}`);
  console.log(`  Strict matches:                  ${strictHits}  (${ratePct(strictHits)}%)`);
  console.log(`  Suffix-variant additional:       ${variantHits}  (${ratePct(variantHits)}%)`);
  console.log(`  TOTAL matches (strict+variant):  ${totalHits}  (${ratePct(totalHits)}%)`);
  console.log("");
  console.log(`  End-to-end (matches / raw fetched): ${((totalHits / data.records.length) * 100).toFixed(1)}%`);

  console.log("");
  console.log("=".repeat(78));
  console.log("KILL-LINE CHECK (verifier threshold)");
  console.log("=".repeat(78));
  const looseAcceptRate = (totalHits / accepted.length) * 100;
  const verdict =
    looseAcceptRate >= 30 ? "GREEN  — above 30%; build with confidence"
    : looseAcceptRate >= 25 ? "AMBER  — 25-30%; build with disclosed first-pass limits"
    : looseAcceptRate >= 15 ? "RED    — 15-25%; v0 should pivot to county-aggregate display"
    : "BLACK  — <15%; defer Option B";
  console.log(`  Verdict: ${verdict}`);
  console.log("");

  console.log("=".repeat(78));
  console.log(`STRICT MATCH SAMPLES (top ${strictSamples.length})`);
  console.log("=".repeat(78));
  for (const s of strictSamples) {
    console.log(`  [${s.booking}] ${s.inmateName}`);
    console.log(`    booking:  ${s.bookingAddr}`);
    console.log(`    parcel:   ${s.parcelAddr}`);
    console.log(`    owner:    ${s.owner ?? "(null)"}`);
  }

  console.log("");
  console.log("=".repeat(78));
  console.log(`VARIANT-ONLY MATCH SAMPLES (top ${variantSamples.length})`);
  console.log("=".repeat(78));
  for (const s of variantSamples) {
    console.log(`  [${s.booking}] ${s.inmateName}`);
    console.log(`    booking:  ${s.bookingAddr}`);
    console.log(`    parcel:   ${s.parcelAddr}`);
    console.log(`    owner:    ${s.owner ?? "(null)"}`);
    console.log(`    variants: ${s.variantUsed}`);
  }

  console.log("");
  console.log("=".repeat(78));
  console.log(`MISS SAMPLES (no match in countyFips=12095) — top ${misses.length}`);
  console.log("=".repeat(78));
  for (const m of misses) {
    console.log(`  [${m.booking}] ${m.inmateName.padEnd(40)}  ${m.bookingAddr}  (zip ${m.zip})`);
  }
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
