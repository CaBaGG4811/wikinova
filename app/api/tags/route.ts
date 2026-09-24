import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, conflict } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(1, 'Укажите название тега').max(60),
});

export async function GET(): Promise<Response> {
  const tags = await db.tag.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  });
  return Response.json({ tags });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? 'Некорректные данные');
  }

  const slug = slugify(parsed.data.name);
  const exists = await db.tag.findUnique({ where: { slug } });
  if (exists) return conflict('Тег с таким slug уже существует');

  const tag = await db.tag.create({ data: { name: parsed.data.name.trim(), slug } });
  await logActivity(guard.session.user.id, 'create', 'tag', tag.id);
  return Response.json({ tag }, { status: 201 });
}
