import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_PROMPTS } from '@/lib/ai/prompts';
import { guardEditor, isNextResponse } from '@/lib/ai/guard';

const Body = z.object({
  key: z.string().min(1).max(64),
  template: z.string().max(20000).optional(),
  resetDefault: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;
  const rows = await db.aIPrompt.findMany({
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await guardEditor();
  if (isNextResponse(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });

  const { key } = parsed.data;
  let template = parsed.data.template;
  if (parsed.data.resetDefault) {
    template = DEFAULT_PROMPTS[key];
    if (template === undefined) {
      return NextResponse.json({ error: `Дефолтного шаблона для «${key}» нет` }, { status: 400 });
    }
  }
  if (typeof template !== 'string' || !template.trim()) {
    return NextResponse.json({ error: 'Пустой шаблон' }, { status: 400 });
  }

  const existing = await db.aIPrompt.findMany({ where: { key } });
  if (!existing.length && DEFAULT_PROMPTS[key] === undefined) {
    return NextResponse.json({ error: `Неизвестный ключ шаблона «${key}»` }, { status: 400 });
  }
  const maxVersion = existing.reduce((max, row) => Math.max(max, row.version), 0);

  await db.$transaction([
    db.aIPrompt.updateMany({ where: { key, isActive: true }, data: { isActive: false } }),
    db.aIPrompt.create({
      data: { key, template: template.trim(), version: maxVersion + 1, isActive: true },
    }),
  ]);

  const rows = await db.aIPrompt.findMany({ where: { key }, orderBy: { version: 'desc' } });
  return NextResponse.json({ rows });
}
