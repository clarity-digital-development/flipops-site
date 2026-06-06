import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const cols = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='flipops' AND table_name='BulkIngestJob' ORDER BY ordinal_position`);
console.log('COLUMNS:', JSON.stringify(cols));
const rows = await p.$queryRawUnsafe(`SELECT * FROM flipops."BulkIngestJob" WHERE "sourceKey"='duval-clerk-recordings' ORDER BY "startedAt" DESC LIMIT 3`);
console.log(JSON.stringify(rows, (k,v)=>typeof v==='bigint'?v.toString():v, 2));
await p.$disconnect();
