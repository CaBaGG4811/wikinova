import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildQualityCheckPrompt } from '@/lib/ai/prompts';
import { logUsage } from '@/lib/ai/log';
import { guardEditor, isNextResponse, badRequest } from '@/lib/ai/guard';

const Body = z.object({
  content: z.string().min(10).max(80000),
  title: z.string().min(1).max(300),
});

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

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 12);
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {content, title}');

  const settings = await getAISettings();
  const system = await buildQualityCheckPrompt(parsed.data.title, parsed.data.content);
  const client = await getAIClient();
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: 0.2,
      max_tokens: Math.min(settings.maxTokens, 1200),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Оцени статью. Ответь строго JSON без пояснений.' },
      ],
    });
    const raw = pickMessageText(res.choices[0]?.message);
    const json = extractJson(raw);
    const scoreRaw = Number((json as { score?: unknown })?.score);
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
    const issues = toStringArray((json as { issues?: unknown })?.issues);
    const suggestions = toStringArray((json as { suggestions?: unknown })?.suggestions);

    await logUsage({
      userId: guard.userId,
      feature: 'quality_check',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(raw),
      durationMs: Date.now() - started,
      status: 'ok',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ score, issues, suggestions });
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'quality_check',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }
}
