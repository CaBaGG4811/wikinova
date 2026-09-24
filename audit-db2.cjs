const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const tables = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name`);
  console.log('TABLES:', tables.map(t => t.name).join(', '));

  // try FTS against actual article table name
  for (const tbl of ['articles', 'Article']) {
    try {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS articles_fts_test`);
      await db.$executeRawUnsafe(`CREATE VIRTUAL TABLE articles_fts_test USING fts5(id UNINDEXED, title, excerpt, content, tokenize='unicode61')`);
      const ins = await db.$executeRawUnsafe(`INSERT INTO articles_fts_test(id, title, excerpt, content) SELECT id, title, excerpt, content FROM ${tbl} WHERE status='published'`);
      const cnt = await db.$queryRawUnsafe(`SELECT count(*) c FROM articles_fts_test`);
      const m = await db.$queryRawUnsafe(`SELECT id FROM articles_fts_test WHERE articles_fts_test MATCH '"квантовая"'`);
      const m2 = await db.$queryRawUnsafe(`SELECT id FROM articles_fts_test WHERE articles_fts_test MATCH '"наука"'`);
      console.log(`FTS on ${tbl}: inserted=${ins} count=${cnt[0].c} match квантовая=${m.length} match наука=${m2.length}`);
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS articles_fts_test`);
    } catch (e) { console.log(`FTS on ${tbl} ERROR: ${e.message.slice(0, 250)}`); }
  }

  // does real articles_fts exist already?
  const fts = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE name='articles_fts'`);
  console.log('articles_fts exists:', fts.length > 0);

  await db.$disconnect();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
