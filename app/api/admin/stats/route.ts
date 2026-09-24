import { db } from '@/lib/db';
import { requireRole } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalArticles,
    statusGroups,
    requestGroups,
    users,
    media,
    likes,
    viewsAgg,
    publishedSince,
    recent,
  ] = await Promise.all([
    db.article.count(),
    db.article.groupBy({ by: ['status'], _count: { _all: true } }),
    db.articleRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    db.user.count(),
    db.media.count(),
    db.articleLike.count(),
    db.article.aggregate({ _sum: { views: true } }),
    db.article.findMany({
      where: { publishedAt: { gte: since } },
      select: { publishedAt: true },
    }),
    db.activityLog.findMany({
      take: 12,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const requestMap = new Map(requestGroups.map((g) => [g.status, g._count._all]));

  const countMap = new Map<string, number>();
  for (const row of publishedSince) {
    if (!row.publishedAt) continue;
    const key = row.publishedAt.toISOString().slice(0, 10);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }
  const chart: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    chart.push({ date: key, count: countMap.get(key) ?? 0 });
  }

  return Response.json({
    articles: {
      total: totalArticles,
      published: statusMap.get('published') ?? 0,
      draft: statusMap.get('draft') ?? 0,
    },
    requests: {
      pending: requestMap.get('pending') ?? 0,
      in_progress: requestMap.get('in_progress') ?? 0,
      done: requestMap.get('done') ?? 0,
      rejected: requestMap.get('rejected') ?? 0,
    },
    users,
    media,
    likes,
    viewsTotal: viewsAgg._sum.views ?? 0,
    chart,
    recent,
  });
}
