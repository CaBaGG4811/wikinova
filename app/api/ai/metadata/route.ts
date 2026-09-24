import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildMetadataPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardEditor, isNextResponse, badRequest } from '@/lib/ai/guard';
import { slugify } from '@/lib/utils';

const Body = z.object({ content: z.string().min(10).max(60000) });

interface MetadataResult {
  title: string;
  description: string;
  slug: string;
  excerpt: string;
  tags: string[];
  category: string;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {content}');

  const { content } = parsed.data;
  const settings = await getAISettings();

  const [tags, categories] = await Promise.all([
    db.tag.findMany({ take: 200, orderBy: { name: 'asc' }, select: { name: true } }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
  ]);
  const existingTagNames = tags.map((t) => t.name);
  const categoryLabels = categories.map((c) => `${c.slug} (${c.name})`);

  const system = await buildMetadataPrompt(content, {
    existingTags: existingTagNames,
    categories: categoryLabels,
  });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: 'Предложи метаданные. Ответь строго JSON без пояснений.' },
  ];

  const client = await getAIClient();
  const started = Date.now();
  let text = '';
  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: Math.min(settings.temperature, 0.4),
      max_tokens: Math.min(settings.maxTokens, 1200),
      messages,
    });
    text = pickMessageText(res.choices[0]?.message);
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'metadata',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }

  const obj = extractJsonObject(text);
  if (!obj) {
    await logUsage({
      userId: guard.userId,
      feature: 'metadata',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: 'Модель вернула некорректный JSON метаданных',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json(
      { error: 'Модель вернула некорректный JSON. Попробуйте ещё раз.' },
      { status: 502 },
    );
  }

  const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : '';
  const rawSlug = typeof obj.slug === 'string' ? obj.slug.trim() : '';
  const title = rawTitle || 'Без названия';
  const known = new Set(existingTagNames.map((n) => n.toLowerCase()));
  const rawTags = Array.isArray(obj.tags) ? obj.tags : [];
  const tagsOut: string[] = [];
  for (const t of rawTags) {
    if (typeof t !== 'string') continue;
    const name = t.trim();
    if (!name) continue;
    const normalized = known.has(name.toLowerCase())
      ? existingTagNames.find((n) => n.toLowerCase() === name.toLowerCase()) ?? name
      : name;
    if (!tagsOut.some((n) => n.toLowerCase() === normalized.toLowerCase())) tagsOut.push(normalized);
    if (tagsOut.length >= 10) break;
  }

  const rawCategory = typeof obj.category === 'string' ? obj.category.trim() : '';
  const categorySlug = categories.some((c) => c.slug === rawCategory)
    ? rawCategory
    : (categories[0]?.slug ?? '');

  const result: MetadataResult = {
    title,
    description: typeof obj.description === 'string' ? obj.description.trim() : '',
    slug: slugify(rawSlug || title),
    excerpt: typeof obj.excerpt === 'string' ? obj.excerpt.trim() : '',
    tags: tagsOut,
    category: categorySlug,
  };

  await logUsage({
    userId: guard.userId,
    feature: 'metadata',
    model: settings.model,
    tokensIn: estimateTokens(system),
    tokensOut: estimateTokens(text),
    durationMs: Date.now() - started,
    status: 'ok',
    logEnabled: settings.logEnabled,
  });

  return NextResponse.json(result);
}
