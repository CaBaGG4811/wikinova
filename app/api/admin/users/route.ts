import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest } from '@/lib/admin-auth';
import type { Role } from '@/types';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['USER', 'EDITOR', 'ADMIN'];

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      blocked: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return Response.json({ users });
}

export async function PATCH(req: Request): Promise<Response> {
  const guard = await requireRole('ADMIN');
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    role?: string;
    blocked?: boolean;
  } | null;
  if (!body?.id) return badRequest('Не указан id пользователя');

  const user = await db.user.findUnique({ where: { id: body.id } });
  if (!user) return Response.json({ error: 'Пользователь не найден' }, { status: 404 });

  const data: { role?: string; blocked?: boolean } = {};
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role as Role)) return badRequest('Недопустимая роль');
    data.role = body.role;
  }
  if (body.blocked !== undefined) {
    if (typeof body.blocked !== 'boolean') return badRequest('Некорректное значение блокировки');
    if (body.blocked && body.id === guard.session.user.id) {
      return badRequest('Нельзя заблокировать самого себя');
    }
    data.blocked = body.blocked;
  }
  if (Object.keys(data).length === 0) return badRequest('Нет полей для обновления');

  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      blocked: true,
      avatar: true,
      createdAt: true,
    },
  });
  await logActivity(guard.session.user.id, 'update', 'user', user.id);
  return Response.json({ user: updated });
}

export async function DELETE(req: Request): Promise<Response> {
  const guard = await requireRole('ADMIN');
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return badRequest('Не указан id пользователя');
  if (body.id === guard.session.user.id) {
    return badRequest('Нельзя удалить самого себя');
  }

  const user = await db.user.findUnique({ where: { id: body.id } });
  if (!user) return Response.json({ error: 'Пользователь не найден' }, { status: 404 });

  try {
    await db.user.delete({ where: { id: user.id } });
  } catch {
    return Response.json(
      { error: 'Нельзя удалить: у пользователя есть статьи или другие связи' },
      { status: 409 },
    );
  }
  await logActivity(guard.session.user.id, 'delete', 'user', user.id);
  return Response.json({ ok: true });
}
