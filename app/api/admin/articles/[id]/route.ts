import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, notFound } from '@/lib/admin-auth';
import type { ArticleStatus } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  const body = (await req.json().catch(() => null)) as {
    status?: string;
    authorId?: string;
    featured?: boolean;
  } | null;
  if (!body) return badRequest('Пустой запрос');

  const data: { status?: string; authorId?: string; featured?: boolean } = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as ArticleStatus)) {
      return badRequest('Недопустимый статус');
    }
    data.status = body.status;
  }
  if (body.authorId !== undefined) {
    const author = await db.user.findUnique({ where: { id: body.authorId } });
    if (!author) return notFound('Автор не найден');
    if (author.role === 'USER') return badRequest('Автором может быть только редактор');
    data.authorId = author.id;
  }
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (Object.keys(data).length === 0) return badRequest('Нет полей для обновления');

  const updated = await db.article.update({
    where: { id: article.id },
    data,
    select: { id: true, status: true, authorId: true, featured: true },
  });
  await logActivity(guard.session.user.id, 'update', 'article', article.id);
  return Response.json({ article: updated });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  await db.article.delete({ where: { id: article.id } });
  await logActivity(guard.session.user.id, 'delete', 'article', article.id);
  return Response.json({ ok: true });
}
