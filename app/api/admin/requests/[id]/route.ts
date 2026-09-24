import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, notFound } from '@/lib/admin-auth';
import type { RequestStatus } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const STATUSES: RequestStatus[] = ['pending', 'in_progress', 'done', 'rejected'];

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const request = await db.articleRequest.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      articles: { select: { id: true, title: true, slug: true, status: true } },
    },
  });
  if (!request) return notFound('Заявка не найдена');
  return Response.json({ request });
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const existing = await db.articleRequest.findUnique({ where: { id: params.id } });
  if (!existing) return notFound('Заявка не найдена');

  const body = (await req.json().catch(() => null)) as {
    status?: string;
    adminComment?: string;
    assignedToId?: string | null;
  } | null;
  if (!body) return badRequest('Пустой запрос');

  const data: { status?: string; adminComment?: string; assignedToId?: string | null } = {};

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as RequestStatus)) {
      return badRequest('Недопустимый статус');
    }
    data.status = body.status;
  }
  if (body.adminComment !== undefined) {
    data.adminComment = body.adminComment.slice(0, 4000);
  }
  if (body.assignedToId !== undefined) {
    if (body.assignedToId === null) {
      data.assignedToId = null;
    } else {
      const assignee = await db.user.findUnique({ where: { id: body.assignedToId } });
      if (!assignee) return notFound('Пользователь для назначения не найден');
      if (assignee.role !== 'EDITOR' && assignee.role !== 'ADMIN') {
        return badRequest('Назначать можно только редактора или администратора');
      }
      data.assignedToId = assignee.id;
    }
  }
  if (Object.keys(data).length === 0) return badRequest('Нет полей для обновления');

  const request = await db.articleRequest.update({
    where: { id: existing.id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      articles: { select: { id: true, title: true, slug: true, status: true } },
    },
  });
  await logActivity(guard.session.user.id, 'update', 'request', request.id);
  return Response.json({ request });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('ADMIN');
  if (guard.error) return guard.error;

  const existing = await db.articleRequest.findUnique({ where: { id: params.id } });
  if (!existing) return notFound('Заявка не найдена');

  try {
    await db.articleRequest.delete({ where: { id: existing.id } });
  } catch {
    return Response.json(
      { error: 'Нельзя удалить заявку: связанные статьи требуют ручной проверки' },
      { status: 409 },
    );
  }
  await logActivity(guard.session.user.id, 'delete', 'request', existing.id);
  return Response.json({ ok: true });
}
