import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions, hasRole } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Role } from '@/types';

export type Guarded =
  | { session: Session; error?: undefined }
  | { error: Response; session?: undefined };

export async function requireRole(...allowed: Role[]): Promise<Guarded> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: Response.json({ error: 'Не авторизован' }, { status: 401 }) };
  }
  if (!hasRole(session.user.role, ...allowed)) {
    return { error: Response.json({ error: 'Недостаточно прав' }, { status: 403 }) };
  }
  return { session };
}

export async function logActivity(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
): Promise<void> {
  try {
    await db.activityLog.create({
      data: { userId, action, entity, entityId: entityId ?? null },
    });
  } catch {
    return;
  }
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Не найдено'): Response {
  return Response.json({ error: message }, { status: 404 });
}

export function conflict(message: string): Response {
  return Response.json({ error: message }, { status: 409 });
}
