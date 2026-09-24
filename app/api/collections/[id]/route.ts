import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { notFound, badRequest } from '@/lib/admin-auth';
import { cardInclude } from '@/lib/article';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  const collection = await db.collection.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { article: { include: cardInclude } },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!collection) return notFound('Коллекция не найдена');
  const isOwner = session?.user?.id === collection.userId;
  if (!collection.isPublic && !isOwner) return notFound('Коллекция не найдена');

  return Response.json({ collection, isOwner });
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const existing = await db.collection.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!existing) return notFound('Коллекция не найдена');
  if (existing.userId !== session.user.id) return notFound('Коллекция не найдена');

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Некорректные данные');

  const data: { name?: string; description?: string; isPublic?: boolean } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;

  const collection = await db.collection.update({ where: { id: params.id }, data });
  return Response.json({ collection });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const existing = await db.collection.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (!existing) return notFound('Коллекция не найдена');
  if (existing.userId !== session.user.id) return notFound('Коллекция не найдена');

  await db.collection.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
