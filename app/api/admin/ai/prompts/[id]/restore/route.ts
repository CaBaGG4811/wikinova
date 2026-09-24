import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

interface Params {
  params: { id: string };
}

export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const target = await db.aIPrompt.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 });

  await db.$transaction([
    db.aIPrompt.updateMany({ where: { key: target.key, isActive: true }, data: { isActive: false } }),
    db.aIPrompt.update({ where: { id: target.id }, data: { isActive: true } }),
  ]);

  const rows = await db.aIPrompt.findMany({ where: { key: target.key }, orderBy: { version: 'desc' } });
  return NextResponse.json({ rows });
}
