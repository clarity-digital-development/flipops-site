import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  const rows: any[] = await p.$queryRaw`
    SELECT id, status, "sourceKey", "triggerType", "startedAt", "finishedAt",
           "durationMs", "recordsFetched", "recordsUpserted", "errorMessage",
           "rejectCount", "http4xxCount", "http5xxCount"
    FROM flipops."BulkIngestJob"
    WHERE "sourceKey"='realauction-fl-foreclosures'
    ORDER BY "startedAt" DESC LIMIT 1
  `;
  console.log(JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
