const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const arts = await db.article.findMany({
    where: { status: 'published' },
    select: { id: true, title: true, excerpt: true, content: true, category: { select: { name: true } } },
  });
  console.log('published:', arts.length);
  let hits = 0;
  for (const a of arts) {
    const t = `${a.title} ${a.excerpt} ${a.content}`;
    if (t.toLowerCase().includes('наука')) { hits++; console.log('HAS наука:', a.title, '| cat:', a.category?.name); }
  }
  console.log('articles containing наука:', hits);
  const cats = await db.category.findMany({ select: { name: true, _count: { select: { articles: true } } } });
  console.log('categories:', JSON.stringify(cats));
  try {
    const c = await db.$queryRawUnsafe('SELECT count(*) AS c FROM articles_fts');
    console.log('articles_fts rows:', Number(c[0].c));
  } catch (e) { console.log('fts err:', String(e.message).slice(0, 200)); }
  // case tests via LIKE on raw (SQLite ASCII-only LOWER, so test both cases)
  for (const w of ['наука', 'Наука', 'квантовая', 'Квантовая']) {
    const r = await db.$queryRawUnsafe(`SELECT count(*) AS c FROM "Article" WHERE status='published' AND (title LIKE '%' || ? || '%' OR excerpt LIKE '%' || ? || '%' OR content LIKE '%' || ? || '%')`, w, w, w);
    console.log(`LIKE contains '${w}':`, Number(r[0].c));
  }
  await db.$disconnect();
})();
