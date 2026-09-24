import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(1, 'Укажите название').max(80),
  description: z.string().max(400).optional().default(''),
  isPublic: z.boolean().optional().default(false),
});

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const collections = await db.collection.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({ collections });
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? 'Некорректные данные');
  }

  const collection = await db.collection.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description,
      isPublic: parsed.data.isPublic,
    },
  });
  return Response.json({ collection }, { status: 201 });
}
