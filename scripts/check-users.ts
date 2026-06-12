import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true }
  });
  console.log('All users:');
  users.forEach(u => console.log('  ' + u.email + ' | id: ' + u.id));

  const contracts = await prisma.contract.findMany({
    select: { id: true, userId: true, property: { select: { address: true } } }
  });
  console.log('\nAll contracts (' + contracts.length + '):');
  contracts.forEach(c => console.log('  ' + c.property.address + ' | userId: ' + c.userId));

  await prisma.$disconnect();
}

check();
