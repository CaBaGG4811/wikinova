import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';
import { envAiSettingsRow, getAdminAiSettings, normalizeBaseUrl } from '@/lib/ai/settings';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const Body = z.object({
  baseUrl: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() === '' ? '' : normalizeBaseUrl(v)))
    .refine((v) => v === undefined || v === '' || z.string().url().safeParse(v).success, {
      message: 'Некорректный URL',
    }),
  apiKey: z.string().max(500).optional(),
  clearKey: z.boolean().optional(),
  model: z.string().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(64).max(200000).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  systemPrompt: z.string().max(20000).optional(),
  languages: z.union([z.string(), z.array(z.string())]).optional(),
  features: z.union([z.string(), z.array(z.string())]).optional(),
  rateLimitUser: z.number().int().min(1).max(10000).optional(),
  rateLimitAnon: z.number().int().min(1).max(10000).optional(),
  logEnabled: z.boolean().optional(),
  reset: z.boolean().optional(),
});

function toList(value: string | string[]): string {
  const list = Array.isArray(value) ? value : value.split(',');
  return list
    .map((v) => v.trim())
    .filter(Boolean)
    .join(',');
}

export async function GET(): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;
  return NextResponse.json(await getAdminAiSettings());
}

export async function PUT(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные настройки' }, { status: 400 });
  }
  const body = parsed.data;

  if (body.reset) {
    await db.aISettings.deleteMany();
    await db.aISettings.create({ data: envAiSettingsRow() });
    return NextResponse.json(await getAdminAiSettings());
  }

  const data: Record<string, string | number | boolean> = {};
  if (body.baseUrl !== undefined) {
    data.baseUrl = normalizeBaseUrl(body.baseUrl) || envAiSettingsRow().baseUrl;
  }
  if (body.model !== undefined) data.model = body.model.trim();
  if (body.temperature !== undefined) data.temperature = body.temperature;
  if (body.maxTokens !== undefined) data.maxTokens = body.maxTokens;
  if (body.timeoutMs !== undefined) data.timeoutMs = body.timeoutMs;
  if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt;
  if (body.languages !== undefined) data.languages = toList(body.languages);
  if (body.features !== undefined) data.featuresEnabled = toList(body.features);
  if (body.rateLimitUser !== undefined) data.rateLimitUser = body.rateLimitUser;
  if (body.rateLimitAnon !== undefined) data.rateLimitAnon = body.rateLimitAnon;
  if (body.logEnabled !== undefined) data.logEnabled = body.logEnabled;
  if (body.clearKey === true) {
    data.apiKeyEncrypted = '';
  } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    data.apiKeyEncrypted = encryptSecret(body.apiKey.trim());
  }

  const existing = await db.aISettings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) {
    await db.aISettings.update({ where: { id: existing.id }, data });
  } else {
    await db.aISettings.create({
      data: { ...envAiSettingsRow(), ...data },
    });
  }

  return NextResponse.json(await getAdminAiSettings());
}
