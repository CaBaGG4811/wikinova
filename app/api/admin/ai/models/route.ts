import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createAIClient, humanizeAiError } from '@/lib/ai/client';
import { getAISettings } from '@/lib/ai/settings';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const Body = z.object({
  baseUrl: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const body = parsed.success ? parsed.data : {};
  const settings = await getAISettings();

  const baseUrl = (body.baseUrl ?? '').trim() || settings.baseUrl;
  const apiKey = body.apiKey !== undefined && body.apiKey !== '' ? body.apiKey.trim() : settings.apiKey;

  const client = createAIClient({ baseUrl, apiKey, timeoutMs: 15000 });
  try {
    const list = await client.models.list();
    const models = list.data.map((m) => m.id).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { error: `Не удалось получить список моделей: ${humanizeAiError(err)}` },
      { status: 502 },
    );
  }
}
