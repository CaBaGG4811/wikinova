import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

interface FolderRule {
  type: string;
  maxBytes: number;
  exts: string[];
}

const FOLDERS: Record<string, FolderRule> = {
  images: { type: 'image', maxBytes: 10 * 1024 * 1024, exts: ['jpg', 'jpeg', 'png', 'webp', 'svg'] },
  videos: { type: 'video', maxBytes: 100 * 1024 * 1024, exts: ['mp4', 'webm'] },
  docs: { type: 'document', maxBytes: 20 * 1024 * 1024, exts: ['pdf', 'docx'] },
};

const FORBIDDEN_EXT = new Set([
  'php', 'php3', 'php4', 'php5', 'phtml', 'js', 'mjs', 'jsx', 'ts', 'tsx',
  'exe', 'com', 'dll', 'bat', 'cmd', 'sh', 'bash', 'ps1', 'jar', 'py',
  'rb', 'pl', 'cgi', 'asp', 'aspx', 'jsp', 'msi', 'scr', 'vbs', 'wsf',
]);

function formatBytesRu(size: number): string {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Не авторизован' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest('Ожидается multipart/form-data');

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return badRequest('Файл не передан');

  const folderRaw = form.get('folder');
  const folder = typeof folderRaw === 'string' ? folderRaw : '';
  const rule = FOLDERS[folder];
  if (!rule) return badRequest('Папка должна быть images, videos или docs');

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ext) return badRequest('У файла нет расширения');
  if (FORBIDDEN_EXT.has(ext)) return badRequest(`Файлы .${ext} загружать нельзя`);
  if (!rule.exts.includes(ext)) {
    return badRequest(`Для этой папки допустимы: ${rule.exts.join(', ')}`);
  }
  if (file.size > rule.maxBytes) {
    return badRequest(`Файл больше лимита ${formatBytesRu(rule.maxBytes)}`);
  }

  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storedName = `${yyyymm}-${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  const originalName = (file.name.split(/[\\/]/).pop() ?? storedName).slice(0, 200);
  const url = `/uploads/${folder}/${storedName}`;
  const media = await db.media.create({
    data: {
      filename: originalName,
      url,
      type: rule.type,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      uploadedById: session.user.id,
    },
  });

  return Response.json(
    {
      id: media.id,
      url: media.url,
      filename: media.filename,
      type: media.type,
      size: media.size,
      mimeType: media.mimeType,
    },
    { status: 201 },
  );
}
