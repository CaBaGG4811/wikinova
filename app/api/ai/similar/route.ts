import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { RagSource } from '@/types';
import { db } from '@/lib/db';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { stripHtml } from '@/lib/utils';

const Body = z.object({ articleId: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  const source = await db.article.findUnique({
    where: { id: parsed.data.articleId },
    select: { id: true, title: true, excerpt: true, tags: { select: { tagId: true } } },
  });
  if (!source) return notFound('Статья не найдена');

  const sourceTagIds = new Set(source.tags.map((t) => t.tagId));
  const words = Array.from(
    new Set(
      `${source.title} ${source.excerpt}`
        .toLowerCase()
        .split(/[^0-9a-zа-яё]+/gi)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3),
    ),
  ).slice(0, 24);

  const rows = await db.article.findMany({
    where: { status: 'published', id: { not: source.id } },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      tags: { select: { tagId: true } },
    },
    take: 400,
  });

  const scored: { source: RagSource; score: number }[] = [];
  for (const row of rows) {
    let score = 0;
    for (const t of row.tags) {
      if (sourceTagIds.has(t.tagId)) score += 3;
    }
    const title = row.title.toLowerCase();
    const excerpt = row.excerpt.toLowerCase();
    const plain = stripHtml(row.content).toLowerCase();
    for (const w of words) {
      if (title.includes(w)) score += 1;
      if (excerpt.includes(w)) score += 1;
      if (plain.includes(w)) score += 1;
    }
    if (score <= 0) continue;
    scored.push({
      source: { id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt },
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return NextResponse.json({ sources: scored.slice(0, 4).map((s) => s.source) });
}
