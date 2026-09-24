import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, conflict } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(2, 'Слишком короткое название').max(80),
  description: z.string().max(400).optional().default(''),
  icon: z.string().max(60).optional().default(''),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB')
    .optional(),
});

export async function GET(): Promise<Response> {
  const categories = await db.category.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  });
  return Response.json({ categories });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? 'Некорректные данные');
  }

  const slug = slugify(parsed.data.name);
  const exists = await db.category.findUnique({ where: { slug } });
  if (exists) return conflict('Категория с таким slug уже существует');

  const category = await db.category.create({
    data: {
      name: parsed.data.name.trim(),
      slug,
      description: parsed.data.description,
      icon: parsed.data.icon,
      color: parsed.data.color ?? '#166534',
    },
  });
  await logActivity(guard.session.user.id, 'create', 'category', category.id);
  return Response.json({ category }, { status: 201 });
}
