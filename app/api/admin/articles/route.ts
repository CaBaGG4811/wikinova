import { db } from '@/lib/db';
import { requireRole } from '@/lib/admin-auth';
import type { ArticleStatus } from '@/types';

export const dynamic = 'force-dynamic';

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

export async function GET(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const categoryId = searchParams.get('categoryId');
  const q = searchParams.get('q')?.trim();

  const where: {
    status?: string;
    categoryId?: string;
    OR?: { title?: { contains: string }; slug?: { contains: string } }[];
  } = {};
  if (status && STATUSES.includes(status as ArticleStatus)) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [{ title: { contains: q } }, { slug: { contains: q } }];
  }

  const articles = await db.article.findMany({
    where,
    include: {
      author: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      ratings: { select: { value: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return Response.json({ articles });
}
