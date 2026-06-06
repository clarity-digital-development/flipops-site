import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const allUsers = await p.user.findMany({
    select: { id: true, email: true, _count: { select: { properties: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log('Recent users:', JSON.stringify(allUsers, null, 2));
  const total = await p.user.count();
  console.log('Total user count:', total);
  await p.$disconnect();
})();
