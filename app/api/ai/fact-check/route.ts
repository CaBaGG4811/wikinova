import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { FactCheckItem } from '@/types';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildFactCheckPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { searchRelevant } from '@/lib/ai/rag';
import { stripHtml } from '@/lib/utils';

const Body = z.object({ articleId: z.string().min(1) });

const VERDICTS = new Set(['confirmed', 'not_found', 'conflict']);

function parseItems(text: string): FactCheckItem[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: FactCheckItem[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.claim !== 'string' || !o.claim.trim()) continue;
    const verdictRaw = typeof o.verdict === 'string' && VERDICTS.has(o.verdict) ? o.verdict : 'not_found';
    items.push({
      claim: o.claim.trim(),
      verdict: verdictRaw as FactCheckItem['verdict'],
      note: typeof o.note === 'string' ? o.note : undefined,
    });
    if (items.length >= 12) break;
  }
  return items;
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  const { articleId } = parsed.data;
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) return notFound('Статья не найдена');

  const settings = await getAISettings();
  const system = await buildFactCheckPrompt(stripHtml(article.content));
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: 'Выдели утверждения и вынеси вердикты строго в JSON.' },
  ];
  const client = await getAIClient();
  const started = Date.now();

  let text = '';
  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: Math.min(settings.temperature, 0.3),
      max_tokens: settings.maxTokens,
      messages,
    });
    text = pickMessageText(res.choices[0]?.message);
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'factcheck',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      articleId,
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }

  const items = parseItems(text);

  for (const item of items) {
    if (item.verdict !== 'confirmed') continue;
    try {
      const hits = await searchRelevant(item.claim, 1);
      if (hits[0]) {
        item.sourceSlug = hits[0].slug;
        item.sourceTitle = hits[0].title;
      }
    } catch {
      // обогащение источником не критично
    }
  }

  await logUsage({
    userId: guard.userId,
    feature: 'factcheck',
    model: settings.model,
    tokensIn: estimateTokens(system),
    tokensOut: estimateTokens(text),
    durationMs: Date.now() - started,
    status: 'ok',
    articleId,
    logEnabled: settings.logEnabled,
  });

  return NextResponse.json({ items });
}
