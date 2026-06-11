import { prisma } from "@/lib/prisma";
async function main() {
  const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total, COUNT(latitude)::int AS geo FROM flipops."Parcel" WHERE "countyFips"='12099'`) as any[];
  console.log("12099 total:", r[0].total, "geocoded:", r[0].geo);
  const miss = await prisma.$queryRawUnsafe(`SELECT apn FROM flipops."Parcel" WHERE "countyFips"='12099' AND latitude IS NULL LIMIT 10`) as any[];
  console.log("ungeocoded samples:", miss.map((x:any)=>x.apn));
  await prisma.$disconnect();
}
main().catch(e=>{console.error("ERR",e?.message??e);process.exit(1);});
