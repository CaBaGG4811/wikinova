import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAISettings } from '@/lib/ai/settings';
import { estimateTokens, getAIClient, humanizeAiError, pickMessageText } from '@/lib/ai/client';
import { buildAutoTagsPrompt } from '@/lib/ai/prompts';
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

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {content, title}');

  const existing = await db.tag.findMany({ take: 200, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const settings = await getAISettings();
  const system = await buildAutoTagsPrompt(
    parsed.data.title,
    parsed.data.content.slice(0, 8000),
    existing.map((t) => t.name).join(', '),
  );
  const client = await getAIClient();
  const started = Date.now();

  try {
    const res = await client.chat.completions.create({
      model: settings.model,
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Предложи теги. Ответь строго JSON.' },
      ],
    });
    const raw = pickMessageText(res.choices[0]?.message);
    const json = extractJson(raw);
    const arr = Array.isArray((json as { suggestedTags?: unknown })?.suggestedTags)
      ? (json as { suggestedTags: { name?: unknown }[] }).suggestedTags
      : [];
    const names = arr
      .map((t) => (typeof t.name === 'string' ? t.name.trim() : ''))
      .filter(Boolean)
      .slice(0, 7);
    const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
    const suggestedTags: { id: string | null; name: string }[] = [];
    for (const name of names) {
      const hit = byName.get(name.toLowerCase());
      suggestedTags.push({ id: hit?.id ?? null, name: hit?.name ?? name });
    }

    await logUsage({
      userId: guard.userId,
      feature: 'auto_tags',
      model: settings.model,
      tokensIn: estimateTokens(system),
      tokensOut: estimateTokens(raw),
      durationMs: Date.now() - started,
      status: 'ok',
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ suggestedTags });
  } catch (err) {
    await logUsage({
      userId: guard.userId,
      feature: 'auto_tags',
      model: settings.model,
      durationMs: Date.now() - started,
      status: 'error',
      errorMsg: humanizeAiError(err),
      logEnabled: settings.logEnabled,
    });
    return NextResponse.json({ error: humanizeAiError(err) }, { status: 502 });
  }
}
