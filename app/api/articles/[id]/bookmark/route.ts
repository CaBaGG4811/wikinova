import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { notFound } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const article = await db.article.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!article) return notFound('Статья не найдена');

  const key = { userId_articleId: { userId: session.user.id, articleId: article.id } };
  const existing = await db.bookmark.findUnique({ where: key });
  if (existing) {
    await db.bookmark.delete({ where: key });
  } else {
    await db.bookmark.create({ data: { userId: session.user.id, articleId: article.id } });
  }

  return Response.json({ bookmarked: !existing });
}
