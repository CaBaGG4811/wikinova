import { db } from '@/lib/db';
import {
  requireRole,
  logActivity,
  badRequest,
  conflict,
  notFound,
} from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const existing = await db.category.findUnique({ where: { id: params.id } });
  if (!existing) return notFound('Категория не найдена');

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
  } | null;
  if (!body) return badRequest('Пустой запрос');

  const data: {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
  } = {};

  if (body.name !== undefined) {
    if (!body.name.trim()) return badRequest('Название не может быть пустым');
    data.name = body.name.trim();
  }
  if (body.slug !== undefined || body.name !== undefined) {
    const nextSlug = slugify(body.slug?.trim() || data.name || existing.name);
    if (nextSlug !== existing.slug) {
      const dup = await db.category.findUnique({ where: { slug: nextSlug } });
      if (dup && dup.id !== existing.id) {
        return conflict('Категория с таким slug уже существует');
      }
      data.slug = nextSlug;
    }
  }
  if (body.description !== undefined) data.description = body.description;
  if (body.icon !== undefined) data.icon = body.icon.trim();
  if (body.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return badRequest('Цвет должен быть в формате #RRGGBB');
    }
    data.color = body.color;
  }
  if (Object.keys(data).length === 0) return badRequest('Нет полей для обновления');

  const category = await db.category.update({ where: { id: existing.id }, data });
  await logActivity(guard.session.user.id, 'update', 'category', category.id);
  return Response.json({ category });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const existing = await db.category.findUnique({
    where: { id: params.id },
    include: { _count: { select: { articles: true } } },
  });
  if (!existing) return notFound('Категория не найдена');
  if (existing._count.articles > 0) {
    return conflict(
      `Нельзя удалить: к категории привязано статей: ${existing._count.articles}`,
    );
  }

  await db.category.delete({ where: { id: existing.id } });
  await logActivity(guard.session.user.id, 'delete', 'category', existing.id);
  return Response.json({ ok: true });
}
