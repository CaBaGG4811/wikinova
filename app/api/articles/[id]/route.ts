import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authOptions, hasRole } from '@/lib/auth';
import { requireRole, logActivity, badRequest, notFound } from '@/lib/admin-auth';
import { readingTime, slugify } from '@/lib/utils';
import { cardInclude } from '@/lib/article';
import type { ArticleStatus } from '@/types';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

const PatchBody = z.object({
  title: z.string().min(3, 'Заголовок слишком короткий').max(200).optional(),
  excerpt: z.string().max(600).optional(),
  content: z.string().min(1, 'Статья пустая').optional(),
  coverImage: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  requestId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).max(20).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  ogImage: z.string().max(500).optional().nullable(),
});

function firstError(error: z.ZodError): string {
  return error.errors[0]?.message ?? 'Некорректные данные';
}

async function resolveTagIds(tagIds?: string[], names?: string[]): Promise<string[]> {
  const ids = new Set<string>();
  if (tagIds) {
    for (const id of tagIds) {
      const tag = await db.tag.findUnique({ where: { id } });
      if (tag) ids.add(tag.id);
    }
  }
  if (names) {
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const slug = slugify(name);
      const found = await db.tag.findUnique({ where: { slug } });
      const tag = found ?? (await db.tag.create({ data: { slug, name } }));
      ids.add(tag.id);
    }
  }
  return Array.from(ids);
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  const isEditor = hasRole(session?.user?.role, 'EDITOR');
  const article = await db.article.findUnique({ where: { id: params.id }, include: cardInclude });
  if (!article) return notFound('Статья не найдена');
  if (article.status !== 'published' && !isEditor) return notFound('Статья не найдена');
  return Response.json({ article });
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(firstError(parsed.error));
  const body = parsed.data;

  if (body.categoryId) {
    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category) return notFound('Категория не найдена');
  }
  if (body.requestId) {
    const request = await db.articleRequest.findUnique({ where: { id: body.requestId } });
    if (!request) return notFound('Заявка не найдена');
  }

  const data: Prisma.ArticleUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.excerpt !== undefined) data.excerpt = body.excerpt;
  if (body.content !== undefined) {
    data.content = body.content;
    data.readingTime = readingTime(body.content);
  }
  if (body.coverImage !== undefined) data.coverImage = body.coverImage;
  if (body.featured !== undefined) data.featured = body.featured;
  if (body.categoryId !== undefined) {
    data.category = body.categoryId ? { connect: { id: body.categoryId } } : { disconnect: true };
  }
  if (body.requestId !== undefined) {
    data.request = body.requestId ? { connect: { id: body.requestId } } : { disconnect: true };
  }
  if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle;
  if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription;
  if (body.ogImage !== undefined) data.ogImage = body.ogImage;
  if (body.status !== undefined && STATUSES.includes(body.status)) {
    data.status = body.status;
    if (body.status === 'published' && !article.publishedAt) data.publishedAt = new Date();
  }

  if (Object.keys(data).length === 0 && body.tagIds === undefined && body.tags === undefined) {
    return badRequest('Нет полей для обновления');
  }

  if (Object.keys(data).length > 0) {
    await db.article.update({ where: { id: article.id }, data });
  }

  if (body.tagIds !== undefined || body.tags !== undefined) {
    const tagIdList = await resolveTagIds(body.tagIds, body.tags);
    await db.$transaction([
      db.articleTag.deleteMany({ where: { articleId: article.id } }),
      ...tagIdList.map((tagId) => db.articleTag.create({ data: { articleId: article.id, tagId } })),
    ]);
  }

  await logActivity(guard.session.user.id, 'update', 'article', article.id);
  const full = await db.article.findUnique({ where: { id: article.id }, include: cardInclude });
  return Response.json({ article: full });
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const guard = await requireRole('ADMIN');
  if (guard.error) return guard.error;

  const article = await db.article.findUnique({ where: { id: params.id } });
  if (!article) return notFound('Статья не найдена');

  await db.article.delete({ where: { id: article.id } });
  await logActivity(guard.session.user.id, 'delete', 'article', article.id);
  return Response.json({ ok: true });
}
