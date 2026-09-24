import { z } from 'zod';
import { db } from '@/lib/db';
import { BLOCK_DEFAULTS, getBlocks, isBlockKey } from '@/lib/blocks';
import { requireRole, logActivity, badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const PatchBody = z.object({
  key: z.string().min(1),
  value: z.string().max(10000),
});

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get('keys') ?? '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) return badRequest('Укажите keys');
  if (keys.length > 50) return badRequest('Максимум 50 ключей');

  const blocks = await getBlocks(keys);
  return Response.json(blocks);
}

export async function PATCH(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Ожидается { key, value }');
  if (!isBlockKey(parsed.data.key)) return badRequest('Неизвестный ключ блока');
  if (!(parsed.data.key in BLOCK_DEFAULTS)) return badRequest('Неизвестный ключ блока');

  const { key, value } = parsed.data;
  const userId = guard.session.user.id;

  await db.siteBlock.upsert({
    where: { key },
    update: { value, updatedById: userId },
    create: { key, value, updatedById: userId },
  });

  await logActivity(userId, 'update_block', 'SiteBlock', key);

  return Response.json({ ok: true, value });
}
