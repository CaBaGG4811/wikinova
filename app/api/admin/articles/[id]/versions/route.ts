import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, notFound } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  const versions = await db.articleVersion.findMany({
    where: { articleId: article.id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return Response.json({ versions });
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
  } | null;
  if (typeof body?.content !== 'string') return badRequest('Укажите содержимое версии');

  const version = await db.articleVersion.create({
    data: {
      articleId: article.id,
      title: typeof body.title === 'string' && body.title ? body.title : article.title,
      content: body.content,
      createdById: guard.session.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  await logActivity(guard.session.user.id, 'create', 'version', version.id);
  return Response.json({ version }, { status: 201 });
}
