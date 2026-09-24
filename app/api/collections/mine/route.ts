import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const collections = await db.collection.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });
  return Response.json({ collections });
}
