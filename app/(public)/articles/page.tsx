import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { db } from '@/lib/db';
import { cardInclude, spStr } from '@/lib/article';
import { ArticleGrid } from '@/components/article/ArticleGrid';
import { Pagination } from '@/components/article/Pagination';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Энциклопедия',
  description: 'Энциклопедия ГАЛИЛЕО: области знаний, статьи и поиск по страницам.',
};

const PAGE_SIZE = 12;

export default async function EncyclopediaPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const category = spStr(searchParams.category);
  const q = spStr(searchParams.q);
  const page = Math.max(1, Number(spStr(searchParams.page)) || 1);

  if (!category) {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: { where: { status: 'published' } } } } },
    });

    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Энциклопедия' }]} />

        <div className="mb-8">
          <h1 className="font-display text-h2 font-bold text-ink">Энциклопедия</h1>
          <p className="mt-1 text-caption text-muted">Выберите область знаний</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/articles?category=${encodeURIComponent(c.slug)}`}
              className="card card-hoverable group flex items-center gap-4 p-5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <BookOpen size={22} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display font-semibold text-ink transition-colors group-hover:text-accent">
                  {c.name}
                </span>
                <span className="block text-xs text-muted">
                  {c._count.articles} {c._count.articles === 1 ? 'статья' : 'статей'}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
            Областей знаний пока нет
          </p>
        ) : null}
      </div>
    );
  }

  const cat = await db.category.findUnique({ where: { slug: category } });
  if (!cat) notFound();

  const where: Prisma.ArticleWhereInput = { status: 'published', category: { slug: category } };
  if (q) {
    where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];
  }

  const [items, total] = await Promise.all([
    db.article.findMany({
      where,
      include: cardInclude,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.article.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs
        items={[
          { label: 'Главная', href: '/' },
          { label: 'Энциклопедия', href: '/articles' },
          { label: cat.name },
        ]}
      />

      <Link
        href="/articles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={14} />
        Все области знаний
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-h2 font-bold text-ink">{cat.name}</h1>
        <p className="mt-1 text-caption text-muted">Найдено страниц: {total}</p>
      </div>

      <form method="GET" action="/articles" className="mb-8 flex gap-2">
        <input type="hidden" name="category" value={category} />
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Поиск по страницам..."
            aria-label="Поиск по страницам"
            autoComplete="off"
            className="input !py-2.5 !pl-9"
          />
        </div>
        <button type="submit" className="btn-primary">
          Найти
        </button>
      </form>

      <ArticleGrid items={items} view="grid" stagger emptyText="В этом разделе страниц пока нет" />

      <Pagination page={page} pages={pages} basePath="/articles" params={{ category, q }} />
    </div>
  );
}
