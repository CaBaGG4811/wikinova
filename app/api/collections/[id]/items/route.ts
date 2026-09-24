import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { notFound, badRequest, conflict } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const AddBody = z.object({ articleId: z.string().min(1) });
const RemoveBody = z.object({ articleId: z.string().min(1) });

async function ownCollection(id: string, userId: string) {
  const collection = await db.collection.findUnique({ where: { id }, select: { userId: true } });
  if (!collection) return null;
  if (collection.userId !== userId) return null;
  return collection;
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const collection = await ownCollection(params.id, session.user.id);
  if (!collection) return notFound('Коллекция не найдена');

  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  const article = await db.article.findUnique({ where: { id: parsed.data.articleId }, select: { id: true } });
  if (!article) return notFound('Статья не найдена');

  const exists = await db.collectionItem.findUnique({
    where: { collectionId_articleId: { collectionId: params.id, articleId: article.id } },
  });
  if (exists) return conflict('Статья уже в коллекции');

  const max = await db.collectionItem.aggregate({
    where: { collectionId: params.id },
    _max: { order: true },
  });
  await db.collectionItem.create({
    data: {
      collectionId: params.id,
      articleId: article.id,
      order: (max._max.order ?? -1) + 1,
    },
  });
  const count = await db.collectionItem.count({ where: { collectionId: params.id } });
  return Response.json({ ok: true, count }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const collection = await ownCollection(params.id, session.user.id);
  if (!collection) return notFound('Коллекция не найдена');

  const parsed = RemoveBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается {articleId}');

  await db.collectionItem.deleteMany({
    where: { collectionId: params.id, articleId: parsed.data.articleId },
  });
  const count = await db.collectionItem.count({ where: { collectionId: params.id } });
  return Response.json({ ok: true, count });
}
