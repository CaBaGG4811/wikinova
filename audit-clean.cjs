const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const db = new PrismaClient();
(async () => {
  // svg rows: check if file exists on disk
  const rows = await db.media.findMany();
  for (const r of rows) {
    const p = path.join(process.cwd(), 'public', r.url.replace(/^\//, ''));
    console.log('media', r.id, r.filename, 'fileExists=', fs.existsSync(p));
  }
  // cleanup my audit upload
  const mine = rows.find(r => r.url.includes('e84fc205'));
  if (mine) {
    const p = path.join(process.cwd(), 'public', mine.url.replace(/^\//, ''));
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await db.media.delete({ where: { id: mine.id } });
    console.log('cleaned audit upload', mine.id);
  }
  // check svg accessibility via disk (no server assumption)
  await db.$disconnect();
})();
