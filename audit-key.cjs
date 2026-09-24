const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const s = await db.aISettings.findFirst();
  console.log('apiKeyEncrypted len:', (s.apiKeyEncrypted || '').length, 'value:', JSON.stringify(s.apiKeyEncrypted || ''));
  await db.$disconnect();
})();
