import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createAIClient, humanizeAiError } from '@/lib/ai/client';
import { getAISettings } from '@/lib/ai/settings';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const Body = z.object({
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};
  const settings = await getAISettings();

  const baseUrl = (body.baseUrl ?? '').trim() || settings.baseUrl;
  const apiKey = body.apiKey !== undefined && body.apiKey !== '' ? body.apiKey.trim() : settings.apiKey;
  const model = (body.model ?? '').trim() || settings.model;

  const client = createAIClient({ baseUrl, apiKey, timeoutMs: 15000 });
  const started = Date.now();
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
    });
    const ms = Date.now() - started;
    return NextResponse.json({
      ok: true,
      ms,
      model: res.model || model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: humanizeAiError(err) });
  }
}
