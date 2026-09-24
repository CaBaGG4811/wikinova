import { db } from '@/lib/db';
import { requireRole } from '@/lib/admin-auth';
import type { RequestStatus } from '@/types';

export const dynamic = 'force-dynamic';

const STATUSES: RequestStatus[] = ['pending', 'in_progress', 'done', 'rejected'];

export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const where =
    status && STATUSES.includes(status as RequestStatus)
      ? { status }
      : undefined;

  const requests = await db.articleRequest.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { articles: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({ requests });
}
