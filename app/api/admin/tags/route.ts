import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, conflict } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const tags = await db.tag.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  });
  return Response.json({ tags });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as { name?: string; slug?: string } | null;
  if (!body?.name?.trim()) return badRequest('Укажите название тега');

  const slug = slugify(body.slug?.trim() || body.name);
  const exists = await db.tag.findUnique({ where: { slug } });
  if (exists) return conflict('Тег с таким slug уже существует');

  const tag = await db.tag.create({ data: { name: body.name.trim(), slug } });
  await logActivity(guard.session.user.id, 'create', 'tag', tag.id);
  return Response.json({ tag }, { status: 201 });
}
