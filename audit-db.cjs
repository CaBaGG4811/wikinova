const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  // 1. FTS diagnostics
  try {
    await db.$executeRawUnsafe(`CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(id UNINDEXED, title, excerpt, content, tokenize='unicode61')`);
    await db.$executeRawUnsafe(`INSERT INTO articles_fts(id, title, excerpt, content) SELECT id, title, excerpt, content FROM articles WHERE status = 'published' AND id NOT IN (SELECT id FROM articles_fts)`);
    const cnt = await db.$queryRawUnsafe(`SELECT count(*) as c FROM articles_fts`);
    console.log('fts rows:', cnt);
    for (const q of ['"квантовая"', '"наука"', '"Квантовая"', 'квантовая']) {
      try {
        const rows = await db.$queryRawUnsafe(`SELECT id FROM articles_fts WHERE articles_fts MATCH ? LIMIT 5`, q);
        console.log('MATCH', q, '->', rows.length, rows.map(r => r.id));
      } catch (e) { console.log('MATCH', q, 'ERROR:', e.message.slice(0, 200)); }
    }
  } catch (e) { console.log('FTS SETUP ERROR:', e.message.slice(0, 300)); }

  // 2. LIKE fallback behaviour
  const like1 = await db.article.count({ where: { status: 'published', OR: [{ title: { contains: 'квантовая' } }, { excerpt: { contains: 'квантовая' } }] } });
  const like2 = await db.article.count({ where: { status: 'published', OR: [{ title: { contains: 'Квантовая' } }, { excerpt: { contains: 'Квантовая' } }] } });
  console.log('LIKE lowercase "квантовая":', like1, ' LIKE "Квантовая":', like2);
  const demo = await db.article.findFirst({ where: { status: 'published' }, select: { title: true, excerpt: true } });
  console.log('sample:', JSON.stringify(demo));

  // 3. AIUsage userId distribution (rate-limit key mismatch check)
  const rows = await db.$queryRawUnsafe(`SELECT userId, count(*) as c FROM AIUsage GROUP BY userId`);
  console.log('AIUsage by userId:', rows);

  // 4. restore AI settings baseUrl to found value
  const s = await db.aISettings.findFirst({ orderBy: { id: 'asc' } });
  console.log('AI settings before restore:', JSON.stringify({ baseUrl: s?.baseUrl, temperature: s?.temperature }));
  if (s && s.baseUrl !== 'http://localhost:1234/v1') {
    await db.aISettings.update({ where: { id: s.id }, data: { baseUrl: 'http://localhost:1234/v1' } });
    console.log('restored baseUrl -> http://localhost:1234/v1');
  }
  const s2 = await db.aISettings.findFirst({ orderBy: { id: 'asc' } });
  console.log('AI settings after:', JSON.stringify({ baseUrl: s2?.baseUrl, temperature: s2?.temperature, rateLimitAnon: s2?.rateLimitAnon, rateLimitUser: s2?.rateLimitUser }));

  // 5. leftover audit uploads?
  const media = await db.media.findMany({ select: { id: true, url: true, filename: true } });
  console.log('media rows:', media.length, JSON.stringify(media));

  // 6. rateLimit settings values
  await db.$disconnect();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
