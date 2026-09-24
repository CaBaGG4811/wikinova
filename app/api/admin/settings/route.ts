import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole, logActivity, badRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const SETTINGS_KEY = 'site_settings';

const defaults = {
  siteName: 'WikiNova',
  logo: '',
  primaryColor: '#166534',
  accentColor: '#C2410C',
  seoDefaultTitle: 'WikiNova',
  seoDefaultDescription: 'Локальная энциклопедия: статьи, категории, AI-ассистент.',
  socials: { telegram: '', vk: '', youtube: '' },
  homeText: '',
};

const settingsSchema = z.object({
  siteName: z.string().min(1).max(80),
  logo: z.string().max(300),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  seoDefaultTitle: z.string().max(200),
  seoDefaultDescription: z.string().max(400),
  socials: z.object({
    telegram: z.string().max(300),
    vk: z.string().max(300),
    youtube: z.string().max(300),
  }),
  homeText: z.string().max(8000),
});

export type SiteSettings = z.infer<typeof settingsSchema>;

async function readSettings(): Promise<SiteSettings> {
  const row = await db.aIPrompt.findFirst({
    where: { key: SETTINGS_KEY },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return defaults;
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(row.template));
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}

export async function GET(): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const settings = await readSettings();
  return Response.json({ settings });
}

export async function PUT(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Некорректные настройки: проверьте поля формы');
  }

  const template = JSON.stringify(parsed.data);
  const existing = await db.aIPrompt.findFirst({
    where: { key: SETTINGS_KEY },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await db.aIPrompt.update({
      where: { id: existing.id },
      data: { template, version: existing.version + 1, isActive: true },
    });
  } else {
    await db.aIPrompt.create({
      data: { key: SETTINGS_KEY, template, version: 1, isActive: true },
    });
  }

  await logActivity(guard.session.user.id, 'update', 'settings', SETTINGS_KEY);
  return Response.json({ settings: parsed.data });
}
