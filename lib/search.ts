import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { cardInclude } from '@/lib/article';

export interface SearchOut {
  items: Prisma.ArticleGetPayload<{ include: typeof cardInclude }>[];
  total: number;
}

async function syncFts(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(id UNINDEXED, title, excerpt, content, tokenize='unicode61')`,
  );
  await db.$executeRawUnsafe('DELETE FROM articles_fts');
  await db.$executeRawUnsafe(
    `INSERT INTO articles_fts(id, title, excerpt, content)
     SELECT a.id, a.title, a.excerpt, a.content || ' ' || COALESCE(c.name, '')
     FROM "Article" a
     LEFT JOIN "Category" c ON c.id = a.categoryId
     WHERE a.status = 'published'`,
  );
}

async function ftsIds(query: string, limit: number): Promise<string[]> {
  const phrase = `"${query.replace(/"/g, '""')}"`;
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM articles_fts WHERE articles_fts MATCH ? LIMIT ${limit}`,
    phrase,
  );
  return rows.map((r) => r.id);
}

async function fallbackSearch(query: string, limit: number): Promise<SearchOut> {
  const q = query.toLowerCase();
  const rows = await db.article.findMany({
    where: { status: 'published' },
    include: cardInclude,
    orderBy: { views: 'desc' },
  });
  const items = rows.filter((row) => {
    const haystack = `${row.title} ${row.excerpt ?? ''} ${row.content} ${row.category?.name ?? ''}`;
    return haystack.toLowerCase().includes(q);
  });
  return { items: items.slice(0, limit), total: items.length };
}

export async function searchArticles(q: string, limit = 20): Promise<SearchOut> {
  const query = q.trim();
  if (!query) return { items: [], total: 0 };
  const safeLimit = Math.min(50, Math.max(1, limit));
  try {
    await syncFts();
    const ids = await ftsIds(query, safeLimit);
    if (ids.length > 0) {
      const items = await db.article.findMany({
        where: { id: { in: ids }, status: 'published' },
        include: cardInclude,
        take: safeLimit,
      });
      if (items.length > 0) return { items, total: items.length };
    }
    return { items: [], total: 0 };
  } catch {
    // FTS5 недоступен — регистронезависимый fallback на уровне JS (юникод-корректный)
    return fallbackSearch(query, safeLimit);
  }
}
