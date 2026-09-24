import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const PutBody = z.object({ enabled: z.boolean() });

export async function GET(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit') ?? '100');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;

  const [errors, rows, settings] = await Promise.all([
    db.aIUsage.findMany({
      where: { status: 'error' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.aIUsage.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
    db.aISettings.findFirst({ orderBy: { id: 'asc' }, select: { logEnabled: true } }),
  ]);

  return NextResponse.json({
    errors,
    rows,
    logEnabled: settings?.logEnabled ?? true,
  });
}

export async function PUT(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ожидается {enabled}' }, { status: 400 });

  const existing = await db.aISettings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) {
    await db.aISettings.update({ where: { id: existing.id }, data: { logEnabled: parsed.data.enabled } });
  } else {
    return NextResponse.json({ error: 'Настройки AI не найдены' }, { status: 404 });
  }

  return NextResponse.json({ logEnabled: parsed.data.enabled });
}
