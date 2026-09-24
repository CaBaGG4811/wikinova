import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildDraftPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardEditor, isNextResponse, badRequest } from '@/lib/ai/guard';
import { searchRelevant } from '@/lib/ai/rag';

const Body = z.object({
  topic: z.string().min(2).max(300),
  points: z.string().max(2000).optional(),
  level: z.string().max(120).optional(),
  style: z.string().max(200).optional(),
  requestId: z.string().optional(),
});

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
  if (!parsed.success) return badRequest('Ожидается {topic, points?, level?, style?}');

  const { topic, points, level, style } = parsed.data;
  const settings = await getAISettings();

  const hits = await searchRelevant(topic, 6);
  const ragContext = hits.length
    ? hits.map((h) => `### ${h.title}\n${h.excerpt}\n${h.contentSnippet}`).join('\n\n')
    : 'Пока нет релевантных статей вики.';

  const system = await buildDraftPrompt({
    topic,
    points: points?.trim() || 'нет',
    level: level?.trim() || 'средний',
    style: style?.trim() || 'нейтральный энциклопедический',
    ragContext,
  });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Тема: ${topic}. Верни ТОЛЬКО JSON вида {"title": "...", "content": "<html с <h2> и <p>"}.`,
    },
  ];

  const client = await getAIClient();
  const started = Date.now();
  let text = '';
  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
    });
    text = pickMessageText(res.choices[0]?.message);
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'draft',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }

  const obj = extractJsonObject(text);
  const title = obj && typeof obj.title === 'string' ? obj.title.trim() : '';
  const content = obj && typeof obj.content === 'string' ? obj.content.trim() : '';
  if (!title || !content) {
    await logUsage({
      userId: guard.userId,
      feature: 'draft',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(text),
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: 'Модель вернула некорректный JSON черновика',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json(
      { error: 'Модель вернула некорректный JSON. Попробуйте ещё раз.' },
      { status: 502 },
    );
  }

  await logUsage({
    userId: guard.userId,
    feature: 'draft',
    model: settings.model,
    tokensIn: estimateTokens(system),
    tokensOut: estimateTokens(text),
    durationMs: Date.now() - started,
    status: 'ok',
    logEnabled: settings.logEnabled,
  });

  return NextResponse.json({ title, content });
}
