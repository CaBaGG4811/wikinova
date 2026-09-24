import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { cardInclude, spStr } from '@/lib/article';
import { ArticleGrid } from '@/components/article/ArticleGrid';
import { ArticleFilters } from '@/components/article/ArticleFilters';
import { Pagination } from '@/components/article/Pagination';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Статьи',
  description: 'Каталог статей WikiNova с фильтрами по категории, тегу, автору и дате.',
};

const PAGE_SIZE = 12;

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const category = spStr(searchParams.category);
  const tag = spStr(searchParams.tag);
  const author = spStr(searchParams.author);
  const date = spStr(searchParams.date);
  const sort = spStr(searchParams.sort);
  const view = spStr(searchParams.view) === 'list' ? 'list' : 'grid';
  const page = Math.max(1, Number(spStr(searchParams.page)) || 1);

  const where: Prisma.ArticleWhereInput = { status: 'published' };
  if (category) where.category = { slug: category };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (author) where.authorId = author;
  if (date === 'week' || date === 'month' || date === 'year') {
    const days = date === 'week' ? 7 : date === 'month' ? 30 : 365;
    where.publishedAt = { gte: new Date(Date.now() - days * 86400000) };
  }

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    sort === 'views'
      ? [{ views: 'desc' }]
      : sort === 'title'
        ? [{ title: 'asc' }]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

  const [items, total, categories, tags, authors] = await Promise.all([
    db.article.findMany({
      where,
      include: cardInclude,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.article.count({ where }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
    db.tag.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
    db.user.findMany({
      where: { articles: { some: { status: 'published' } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterParams = { category, tag, author, date, sort, view: view === 'list' ? 'list' : '' };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Статьи' }]} />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Статьи</h1>
          <p className="mt-1 text-caption text-muted">Найдено: {total}</p>
        </div>
      </div>

      <div className="mb-6">
        <ArticleFilters
          categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
          tags={tags.map((t) => ({ value: t.slug, label: t.name }))}
          authors={authors.map((a) => ({ value: a.id, label: a.name }))}
          current={{ category, tag, author, date, sort, view }}
        />
      </div>

      <ArticleGrid items={items} view={view} stagger emptyText="Под эти фильтры статей нет" />

      <Pagination page={page} pages={pages} basePath="/articles" params={filterParams} />
    </div>
  );
}
