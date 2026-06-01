/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function main() {
  const recent = await prisma.bulkIngestJob.findMany({
    where: {
      sourceKey: { in: ["duval-clerk-recordings", "realauction-fl-foreclosures"] },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true, sourceKey: true, sourceTag: true, triggerType: true,
      status: true, startedAt: true, finishedAt: true, durationMs: true,
      recordsFetched: true, recordsUpserted: true, rejectCount: true,
      http4xxCount: true, http5xxCount: true, cfChallengeCount: true,
      errorMessage: true,
    },
  });
  for (const r of recent) {
    console.log("-".repeat(78));
    console.log(`id=${r.id}  sourceKey=${r.sourceKey}  trigger=${r.triggerType}`);
    console.log(`sourceTag=${r.sourceTag}  scope?`);
    console.log(`status=${r.status}  started=${r.startedAt.toISOString()}  finished=${r.finishedAt?.toISOString() ?? "(in flight)"}`);
    console.log(`durationMs=${r.durationMs ?? "?"}  recordsFetched=${r.recordsFetched}  recordsUpserted=${r.recordsUpserted}  rejectCount=${r.rejectCount}`);
    console.log(`http4xx=${r.http4xxCount}  http5xx=${r.http5xxCount}  cfChallenge=${r.cfChallengeCount}`);
    if (r.errorMessage) console.log(`errorMessage: ${r.errorMessage.slice(0, 500)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
