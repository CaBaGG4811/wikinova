import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildSimilarPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { stripHtml } from '@/lib/utils';

const Body = z.object({ articleId: z.string().min(1) });

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  const source = await db.article.findUnique({
    where: { id: parsed.data.articleId },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!source || source.status !== 'published') return notFound('Статья не найдена');

  const sourceTags = new Set(source.tags.map((t) => t.tag.name.toLowerCase()));
  const candidates = await db.article.findMany({
    where: { status: 'published', id: { not: source.id } },
    select: { id: true, slug: true, title: true, excerpt: true, content: true, tags: { select: { tag: { select: { name: true } } } } },
    take: 30,
  });

  const scored: { id: string; slug: string; title: string; similarity: number }[] = [];
  const pure: { id: string; slug: string; title: string; score: number }[] = [];

  for (const row of candidates) {
    let score = 0;
    for (const t of row.tags) {
      if (sourceTags.has(t.tag.name.toLowerCase())) score += 3;
    }
    const words = `${source.title}`.toLowerCase().split(/[^0-9a-zа-яё]+/gi).filter((w) => w.length >= 5);
    const plain = stripHtml(row.content).toLowerCase();
    for (const w of words) if (plain.includes(w)) score += 1;
    if (score > 0) pure.push({ id: row.id, slug: row.slug, title: row.title, score });
  }

  pure.sort((a, b) => b.score - a.score);
  const top = pure.slice(0, 8);
  if (top.length === 0) return NextResponse.json({ articles: [] });

  const settings = await getAISettings();
  const content = stripHtml(source.content).slice(0, 6000);
  const candText = top.map((t) => `id=${t.id} | ${t.title}`).join('\n');
  const system = await buildSimilarPrompt(content, candText);
  const client = await getAIClient();
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Оцени сходство. Ответь строго JSON.' },
      ],
    });
    const raw = pickMessageText(res.choices[0]?.message);
    const json = extractJson(raw);
    const results = Array.isArray((json as { results?: unknown })?.results)
      ? ((json as { results: { id?: unknown; similarity?: unknown }[] }).results ?? [])
      : [];
    const byId = new Map<string, number>();
    for (const r of results) {
      if (typeof r.id === 'string' && typeof r.similarity === 'number') {
        byId.set(r.id, Math.max(0, Math.min(100, Math.round(r.similarity))));
      }
    }
    const articles = top
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        similarity: byId.get(t.id) ?? Math.min(95, t.score * 5),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    await logUsage({
      userId: guard.userId,
      feature: 'similar_advanced',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(raw),
      durationMs: Date.now() - started,
      status: 'ok',
      articleId: source.id,
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ articles });
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'similar_advanced',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      articleId: source.id,
      logEnabled: settings.logEnabled,
    });
    const fallback = top.slice(0, 5).map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      similarity: Math.min(95, t.score * 5),
    }));
    return NextResponse.json({ articles: fallback, warning: humanizeAiError(err) });
  }
}
