import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildImprovePrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardEditor, isNextResponse, badRequest } from '@/lib/ai/guard';

const Body = z.object({
  text: z.string().min(1).max(20000),
  mode: z.string().min(1).max(200).optional(),
});

function extractResult(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const value = (parsed as Record<string, unknown>).result;
        if (typeof value === 'string' && value.trim()) return value;
      }
    } catch {
      // не JSON, попробуем сырой текст
    }
  }
  const raw = text.trim();
  return raw || null;
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {text, mode?}');

  const { text, mode } = parsed.data;
  const settings = await getAISettings();
  const system = await buildImprovePrompt(mode?.trim() || 'сделать яснее и короче', text);
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    { role: 'user', content: 'Верни ТОЛЬКО JSON вида {"result": "..."}. Без пояснений.' },
  ];

  const client = await getAIClient();
  const started = Date.now();
  let responseText = '';
  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
    });
    responseText = pickMessageText(res.choices[0]?.message);
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'improve',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }

  const result = extractResult(responseText);
  if (!result) {
    await logUsage({
      userId: guard.userId,
      feature: 'improve',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: 'Пустой ответ модели',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: 'Модель вернула пустой ответ. Попробуйте ещё раз.' }, { status: 502 });
  }

  await logUsage({
    userId: guard.userId,
    feature: 'improve',
    model: settings.model,
    tokensIn: estimateTokens(system),
    tokensOut: estimateTokens(responseText),
    durationMs: Date.now() - started,
    status: 'ok',
    logEnabled: settings.logEnabled,
  });

  return NextResponse.json({ result });
}
