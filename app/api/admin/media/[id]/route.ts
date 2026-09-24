import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest, notFound } from '@/lib/admin-auth';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

function resolveUploadPath(url: string): string | null {
  const clean = url.split('?')[0].split('#')[0];
  const prefix = '/uploads/';
  const idx = clean.indexOf(prefix);
  if (idx === -1) return null;
  const rel = clean.slice(idx + prefix.length);
  const abs = path.join(process.cwd(), 'public', 'uploads', rel);
  const root = path.join(process.cwd(), 'public', 'uploads');
  if (!abs.startsWith(root)) return null;
  return abs;
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const media = await db.media.findUnique({ where: { id: params.id } });
  if (!media) return notFound('Файл не найден');

  const body = (await req.json().catch(() => null)) as { filename?: string } | null;
  if (!body?.filename?.trim()) return badRequest('Укажите новое имя файла');

  const ext = path.extname(media.filename);
  const base = slugify(body.filename.replace(/\.[^.]+$/, '')).slice(0, 60);
  if (!base) return badRequest('Некорректное имя файла');
  const nextFilename = `${base}${ext}`;
  const oldAbs = resolveUploadPath(media.url);

  let nextUrl = media.url;
  if (oldAbs) {
    const dir = path.dirname(oldAbs);
    const nextAbs = path.join(dir, nextFilename);
    try {
      await fs.rename(oldAbs, nextAbs);
      const rel = path.relative(path.join(process.cwd(), 'public'), nextAbs);
      nextUrl = `/${rel.split(path.sep).join('/')}`;
    } catch {
      nextUrl = media.url;
    }
  }

  const updated = await db.media.update({
    where: { id: media.id },
    data: { filename: nextFilename, url: nextUrl },
  });
  await logActivity(guard.session.user.id, 'update', 'media', media.id);
  return Response.json({ media: updated });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const media = await db.media.findUnique({ where: { id: params.id } });
  if (!media) return notFound('Файл не найден');

  const abs = resolveUploadPath(media.url);
  if (abs) {
    try {
      await fs.unlink(abs);
    } catch {
    }
  }
  await db.media.delete({ where: { id: media.id } });
  await logActivity(guard.session.user.id, 'delete', 'media', media.id);
  return Response.json({ ok: true });
}
