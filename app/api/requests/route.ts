import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  topic: z.string().min(3, 'Слишком короткая тема').max(200),
  description: z.string().max(4000).optional().default(''),
  category: z.string().max(100).optional().default(''),
  level: z.enum(['brief', 'standard', 'detailed']).optional().default('standard'),
  email: z.string().email('Укажите корректный email'),
  name: z.string().max(100).optional().default(''),
  attachmentUrl: z
    .string()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), 'Ссылка должна начинаться с http')
    .nullable(),
});

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const requests = await db.articleRequest.findMany({
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { articles: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json({ requests, total: requests.length });
}

export async function POST(req: Request): Promise<Response> {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message ?? 'Некорректные данные');
  }

  const body = parsed.data;
  const request = await db.articleRequest.create({
    data: {
      topic: body.topic.trim(),
      description: body.description,
      category: body.category,
      level: body.level,
      email: body.email.trim(),
      name: body.name.trim(),
      status: 'pending',
      attachmentUrl: body.attachmentUrl || null,
    },
  });
  await logActivity(null, 'create', 'request', request.id);
  return Response.json({ request }, { status: 201 });
}
