const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const rows = await db.$queryRawUnsafe('SELECT userId, COUNT(*) AS c FROM AIUsage GROUP BY userId');
  console.log('AIUsage by userId:', JSON.stringify(rows, (k, v) => (typeof v === 'bigint' ? Number(v) : v)));
  await db.$disconnect();
})();
