import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const Body = z.object({ template: z.string().min(1).max(20000) });

interface Params {
  params: { id: string };
}

async function findPrompt(id: string) {
  return db.aIPrompt.findUnique({ where: { id } });
}

export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const current = await findPrompt(params.id);
  if (!current) return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Пустой шаблон' }, { status: 400 });

  // Решение: правка любой версии создаёт новую версию (история не теряется)
  const siblings = await db.aIPrompt.findMany({ where: { key: current.key } });
  const maxVersion = siblings.reduce((max, row) => Math.max(max, row.version), 0);

  await db.$transaction([
    db.aIPrompt.updateMany({ where: { key: current.key, isActive: true }, data: { isActive: false } }),
    db.aIPrompt.create({
      data: {
        key: current.key,
        template: parsed.data.template.trim(),
        version: maxVersion + 1,
        isActive: true,
      },
    }),
  ]);

  const rows = await db.aIPrompt.findMany({ where: { key: current.key }, orderBy: { version: 'desc' } });
  return NextResponse.json({ rows });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const current = await findPrompt(params.id);
  if (!current) return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 });

  const others = await db.aIPrompt.count({ where: { key: current.key, id: { not: current.id } } });
  if (others === 0) {
    return NextResponse.json(
      { error: 'Нельзя удалить единственную версию шаблона' },
      { status: 400 },
    );
  }

  await db.aIPrompt.delete({ where: { id: current.id } });

  if (current.isActive) {
    const next = await db.aIPrompt.findFirst({
      where: { key: current.key },
      orderBy: { version: 'desc' },
    });
    if (next) await db.aIPrompt.update({ where: { id: next.id }, data: { isActive: true } });
  }

  const rows = await db.aIPrompt.findMany({ where: { key: current.key }, orderBy: { version: 'desc' } });
  return NextResponse.json({ rows });
}
