import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardEditor, isNextResponse, badRequest } from '@/lib/ai/guard';

const Body = z.object({ days: z.number().int().min(1).max(3650).optional() });

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest('Некорректные параметры');
  const days = parsed.data.days ?? 30;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.aIUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return NextResponse.json({ deleted: result.count, days });
}
