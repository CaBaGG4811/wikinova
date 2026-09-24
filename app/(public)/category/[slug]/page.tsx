import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { cardInclude, spStr } from '@/lib/article';
import { ArticleGrid } from '@/components/article/ArticleGrid';
import { Pagination } from '@/components/article/Pagination';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';

export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

const PAGE_SIZE = 12;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await db.category.findUnique({
    where: { slug: params.slug },
    select: { name: true, description: true },
  });
  if (!category) return { title: 'Категория' };
  return { title: category.name, description: category.description || `Статьи категории ${category.name}` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await db.category.findUnique({
    where: { slug: params.slug },
    include: { _count: { select: { articles: true } } },
  });
  if (!category) notFound();

  const page = Math.max(1, Number(spStr(searchParams.page)) || 1);
  const where = { categoryId: category.id, status: 'published' as const };
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
          { label: 'Статьи', href: '/articles' },
          { label: category.name },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: category.color }} />
          <h1 className="font-display text-h2 font-bold">{category.name}</h1>
        </div>
        {category.description ? (
          <p className="mt-2 max-w-[68ch] text-body text-muted">{category.description}</p>
        ) : null}
        <p className="mt-2 text-caption text-muted">Статей: {total}</p>
      </div>

      <ArticleGrid items={items} stagger emptyText="В этой категории пока нет статей" />
      <Pagination page={page} pages={pages} basePath={`/category/${category.slug}`} />
    </div>
  );
}
