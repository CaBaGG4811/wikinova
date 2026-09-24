import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { notFound, badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const Body = z.object({ value: z.number().int().min(1).max(5) });

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const article = await db.article.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!article) return notFound('Статья не найдена');

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается value от 1 до 5');

  const key = { articleId_userId: { articleId: article.id, userId: session.user.id } };
  await db.articleRating.upsert({
    where: key,
    create: { articleId: article.id, userId: session.user.id, value: parsed.data.value },
    update: { value: parsed.data.value },
  });

  const agg = await db.articleRating.aggregate({
    where: { articleId: article.id },
    _avg: { value: true },
    _count: { value: true },
  });

  return Response.json({
    value: parsed.data.value,
    average: agg._avg.value ?? 0,
    count: agg._count.value,
  });
}
