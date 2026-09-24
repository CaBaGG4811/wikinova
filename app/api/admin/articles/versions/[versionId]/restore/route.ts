import { db } from '@/lib/db';
import { requireRole, logActivity, notFound } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = { params: { versionId: string } };

export async function PUT(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const version = await db.articleVersion.findUnique({
    where: { id: params.versionId },
  });
  if (!version) return notFound('Версия не найдена');

  const article = await db.article.findUnique({ where: { id: version.articleId } });
  if (!article) return notFound('Статья не найдена');

  await db.articleVersion.create({
    data: {
      articleId: article.id,
      title: article.title,
      content: article.content,
      createdById: guard.session.user.id,
    },
  });

  const updated = await db.article.update({
    where: { id: article.id },
    data: { content: version.content, title: version.title },
    select: { id: true, title: true, content: true },
  });
  await logActivity(guard.session.user.id, 'restore', 'version', version.id);
  return Response.json({ article: updated });
}
