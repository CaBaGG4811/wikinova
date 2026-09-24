import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildSummarizeShortPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest, notFound } from '@/lib/ai/guard';
import { stripHtml } from '@/lib/utils';

const Body = z.object({
  articleId: z.string().min(1),
  refresh: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  const article = await db.article.findUnique({
    where: { id: parsed.data.articleId },
    select: { id: true, title: true, content: true, summary: true, status: true },
  });
  if (!article || article.status !== 'published') return notFound('Статья не найдена');

  if (article.summary && !parsed.data.refresh) {
    return NextResponse.json({ summary: article.summary, cached: true });
  }

  const settings = await getAISettings();
  const content = stripHtml(article.content).slice(0, 12000);
  const system = await buildSummarizeShortPrompt(content);
  const client = await getAIClient();
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: Math.min(settings.temperature, 0.4),
      max_tokens: Math.min(settings.maxTokens, 500),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Дай только краткое содержание, 3-4 предложения.' },
      ],
    });
    const summary = pickMessageText(res.choices[0]?.message).trim();
    if (!summary) return badRequest('Модель не вернула summary');

    try {
      await db.article.update({ where: { id: article.id }, data: { summary } });
    } catch {
      // сохранение не критично для ответа
    }

    await logUsage({
      userId: guard.userId,
      feature: 'summarize_short',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(summary),
      durationMs: Date.now() - started,
      status: 'ok',
      articleId: article.id,
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ summary, cached: false });
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'summarize_short',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      articleId: article.id,
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }
}
