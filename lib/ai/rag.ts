import { db } from '@/lib/db';
import { stripHtml } from '@/lib/utils';
import type { RagSource } from '@/types';

export interface RagHit extends RagSource {
  contentSnippet: string;
  score: number;
}

interface Candidate {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  plainContent: string;
  tags: string;
}

const FTS_TABLE = 'articles_fts';

export function tokenize(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^0-9a-zа-яё]+/gi)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  if (words.length) return Array.from(new Set(words)).slice(0, 12);
  const single = query.trim().toLowerCase();
  return single ? [single] : [];
}

export function extractTocSnippet(content: string, query: string | string[], maxLen = 800): string {
  const plain = stripHtml(content);
  if (plain.length <= maxLen) return plain;
  const words = (Array.isArray(query) ? query : tokenize(query)).map((w) => w.toLowerCase());
  let pos = -1;
  for (const w of words) {
    const i = plain.toLowerCase().indexOf(w);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  if (pos < 0) return plain.slice(0, maxLen).trim();
  const start = Math.max(0, pos - Math.floor(maxLen / 2));
  const end = Math.min(plain.length, start + maxLen);
  return plain.slice(start, end).trim();
}

async function ensureFtsTable(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(articleId UNINDEXED, slug UNINDEXED, title, excerpt, content, tags)`,
  );
}

async function ftsCount(): Promise<number> {
  const rows = await db.$queryRawUnsafe<{ c: number | bigint }[]>(`SELECT COUNT(*) AS c FROM ${FTS_TABLE}`);
  return Number(rows[0]?.c ?? 0);
}

async function publishedCount(): Promise<number> {
  return db.article.count({ where: { status: 'published' } });
}

async function syncFts(): Promise<void> {
  await ensureFtsTable();
  const indexed = await ftsCount();
  const published = await publishedCount();
  if (indexed > 0 && indexed === published) return;

  const articles = await db.article.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  await db.$executeRawUnsafe(`DELETE FROM ${FTS_TABLE}`);
  for (const a of articles) {
    await db.$executeRawUnsafe(
      `INSERT INTO ${FTS_TABLE} (articleId, slug, title, excerpt, content, tags) VALUES (?, ?, ?, ?, ?, ?)`,
      a.id,
      a.slug,
      a.title,
      a.excerpt,
      stripHtml(a.content),
      a.tags.map((t) => t.tag.name).join(' '),
    );
  }
}

function toMatchExpression(words: string[]): string {
  return words.map((w) => `"${w.replace(/"/g, '')}"`).join(' OR ');
}

async function fetchCandidates(ids: string[]): Promise<Candidate[]> {
  if (!ids.length) return [];
  const rows = await db.article.findMany({
    where: { id: { in: ids }, status: 'published' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    plainContent: stripHtml(a.content),
    tags: a.tags.map((t) => t.tag.name).join(' '),
  }));
}

async function ftsCandidates(words: string[], topK: number): Promise<Candidate[]> {
  await syncFts();
  const rows = await db.$queryRawUnsafe<{ articleId: string }[]>(
    `SELECT articleId FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ? ORDER BY rank LIMIT ?`,
    toMatchExpression(words),
    Math.max(topK * 4, 20),
  );
  return fetchCandidates(rows.map((r) => r.articleId));
}

async function likeCandidates(words: string[], topK: number): Promise<Candidate[]> {
  const or = words.flatMap((w) => [
    { title: { contains: w } },
    { excerpt: { contains: w } },
    { content: { contains: w } },
    { tags: { some: { tag: { name: { contains: w } } } } },
  ]);
  const rows = await db.article.findMany({
    where: { status: 'published', OR: or },
    take: Math.max(topK * 6, 40),
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    plainContent: stripHtml(a.content),
    tags: a.tags.map((t) => t.tag.name).join(' '),
  }));
}

function scoreCandidate(c: Candidate, words: string[]): number {
  const title = c.title.toLowerCase();
  const excerpt = c.excerpt.toLowerCase();
  const tags = c.tags.toLowerCase();
  const content = c.plainContent.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (title.includes(w)) score += 3;
    if (tags.includes(w)) score += 2;
    if (excerpt.includes(w)) score += 1;
    if (score === 0 && content.includes(w)) score += 0.5;
  }
  return score;
}

export async function searchRelevant(query: string, topK = 8): Promise<RagHit[]> {
  const words = tokenize(query);
  if (!words.length) return [];

  let candidates: Candidate[] = [];
  try {
    candidates = await ftsCandidates(words, topK);
  } catch {
    candidates = [];
  }
  if (!candidates.length) {
    candidates = await likeCandidates(words, topK);
  }

  const hits: RagHit[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const score = scoreCandidate(c, words);
    if (score <= 0) continue;
    hits.push({
      id: c.id,
      slug: c.slug,
      title: c.title,
      excerpt: c.excerpt,
      contentSnippet: extractTocSnippet(c.plainContent, words, 800),
      score,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}
