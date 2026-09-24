import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, conflict } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const categories = await db.category.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  });
  return Response.json({ categories });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
  } | null;
  if (!body?.name?.trim()) return badRequest('Укажите название категории');

  const slug = slugify(body.slug?.trim() || body.name);
  const exists = await db.category.findUnique({ where: { slug } });
  if (exists) return conflict('Категория с таким slug уже существует');

  if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    return badRequest('Цвет должен быть в формате #RRGGBB');
  }

  const category = await db.category.create({
    data: {
      name: body.name.trim(),
      slug,
      description: body.description?.trim() ?? '',
      icon: body.icon?.trim() ?? '',
      color: body.color ?? '#166534',
    },
  });
  await logActivity(guard.session.user.id, 'create', 'category', category.id);
  return Response.json({ category }, { status: 201 });
}
