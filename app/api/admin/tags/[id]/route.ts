import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, conflict, notFound } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const existing = await db.tag.findUnique({ where: { id: params.id } });
  if (!existing) return notFound('Тег не найден');

  const body = (await req.json().catch(() => null)) as { name?: string; slug?: string } | null;
  if (!body) return badRequest('Пустой запрос');

  const data: { name?: string; slug?: string } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return badRequest('Название не может быть пустым');
    data.name = body.name.trim();
  }
  if (body.slug !== undefined || body.name !== undefined) {
    const nextSlug = slugify(body.slug?.trim() || data.name || existing.name);
    if (nextSlug !== existing.slug) {
      const dup = await db.tag.findUnique({ where: { slug: nextSlug } });
      if (dup && dup.id !== existing.id) return conflict('Тег с таким slug уже существует');
      data.slug = nextSlug;
    }
  }
  if (Object.keys(data).length === 0) return badRequest('Нет полей для обновления');

  const tag = await db.tag.update({ where: { id: existing.id }, data });
  await logActivity(guard.session.user.id, 'update', 'tag', tag.id);
  return Response.json({ tag });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const existing = await db.tag.findUnique({
    where: { id: params.id },
    include: { _count: { select: { articles: true } } },
  });
  if (!existing) return notFound('Тег не найден');

  await db.tag.delete({ where: { id: existing.id } });
  await logActivity(guard.session.user.id, 'delete', 'tag', existing.id);
  return Response.json({ ok: true, removedFromArticles: existing._count.articles });
}
