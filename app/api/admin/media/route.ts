import { db } from '@/lib/db';
import { requireRole } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const TYPES = ['image', 'video', 'document'];

export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(60, Math.max(1, Number(searchParams.get('pageSize') ?? '24') || 24));

  const where = type && TYPES.includes(type) ? { type } : undefined;
  const total = await db.media.count({ where });
  const items = await db.media.findMany({
    where,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return Response.json({ items, total, page, pageSize });
}
