import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildCollectionDescriptionPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardPublic, isNextResponse, badRequest } from '@/lib/ai/guard';

const Body = z.object({
  name: z.string().min(1).max(200),
  articles: z
    .array(z.object({ title: z.string().min(1).max(300), excerpt: z.string().max(2000).default('') }))
    .max(40)
    .default([]),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardPublic(req);
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {name, articles[]}');

  const settings = await getAISettings();
  const articlesText = parsed.data.articles
    .map((a, i) => `${i + 1}. ${a.title}${a.excerpt ? ` — ${a.excerpt}` : ''}`)
    .join('\n');
  const system = await buildCollectionDescriptionPrompt(parsed.data.name, articlesText);
  const client = await getAIClient();
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: Math.min(settings.temperature, 0.5),
      max_tokens: Math.min(settings.maxTokens, 600),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Дай только описание, без заголовков и пояснений.' },
      ],
    });
    const description = pickMessageText(res.choices[0]?.message).trim();
    if (!description) return badRequest('Модель не вернула описание');
    await logUsage({
      userId: guard.userId,
      feature: 'collection_description',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(description),
      durationMs: Date.now() - started,
      status: 'ok',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ description });
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'collection_description',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }
}
