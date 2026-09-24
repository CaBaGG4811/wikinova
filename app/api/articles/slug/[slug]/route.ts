import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions, hasRole } from '@/lib/auth';
import { notFound } from '@/lib/admin-auth';
import { cardInclude } from '@/lib/article';

export const dynamic = 'force-dynamic';

type Params = { params: { slug: string } };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  const isEditor = hasRole(session?.user?.role, 'EDITOR');

  const article = await db.article.findUnique({
    where: { slug: params.slug },
    include: cardInclude,
  });
  if (!article) return notFound('Статья не найдена');
  if (article.status !== 'published' && !isEditor) return notFound('Статья не найдена');

  const updated = await db.article.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
    include: cardInclude,
  });

  return Response.json({ article: updated });
}
