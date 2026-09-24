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

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

const CreateBody = z.object({
  title: z.string().min(3, 'Заголовок слишком короткий').max(200),
  excerpt: z.string().max(600).optional().default(''),
  content: z.string().min(1, 'Статья пустая'),
  coverImage: z.string().max(500).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  featured: z.boolean().optional().default(false),
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

async function uniqueArticleSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; n <= 60; n += 1) {
    const exists = await db.article.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const isEditor = hasRole(session?.user?.role, 'EDITOR');

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const tag = searchParams.get('tag');
  const author = searchParams.get('author');
  const q = searchParams.get('q')?.trim();
  const sort = searchParams.get('sort');
  const statusRaw = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(60, Math.max(1, Number(searchParams.get('pageSize') ?? '12') || 12));

  const where: Prisma.ArticleWhereInput = {};
  const editorAll = isEditor && statusRaw === 'all';
  if (!editorAll) {
    if (isEditor && statusRaw && STATUSES.includes(statusRaw as ArticleStatus)) {
      where.status = statusRaw;
    } else {
      where.status = 'published';
    }
  }
  if (category) where.category = { slug: category };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (author) where.authorId = author;
  if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    sort === 'views'
      ? [{ views: 'desc' }]
      : sort === 'title'
        ? [{ title: 'asc' }]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      include: cardInclude,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.article.count({ where }),
  ]);

  return Response.json({ items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(req: Request): Promise<Response> {
  const guard = await requireRole('EDITOR');
  if (guard.error) return guard.error;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
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

  const slug = await uniqueArticleSlug(body.title);
  const article = await db.article.create({
    data: {
      title: body.title,
      slug,
      excerpt: body.excerpt,
      content: body.content,
      coverImage: body.coverImage ?? null,
      status: body.status,
      featured: body.featured,
      readingTime: readingTime(body.content),
      authorId: guard.session.user.id,
      categoryId: body.categoryId ?? null,
      requestId: body.requestId ?? null,
      seoTitle: body.seoTitle ?? null,
      seoDescription: body.seoDescription ?? null,
      ogImage: body.ogImage ?? null,
      publishedAt: body.status === 'published' ? new Date() : null,
    },
  });

  const tagIdList = await resolveTagIds(body.tagIds, body.tags);
  if (tagIdList.length > 0) {
    await db.articleTag.createMany({
      data: tagIdList.map((tagId) => ({ articleId: article.id, tagId })),
    });
  }

  await logActivity(guard.session.user.id, 'create', 'article', article.id);
  const full = await db.article.findUnique({ where: { id: article.id }, include: cardInclude });
  return Response.json({ article: full }, { status: 201 });
}
