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
  const tag = await db.tag.findUnique({ where: { slug: params.slug }, select: { name: true } });
  if (!tag) return { title: 'Тег' };
  return { title: `Тег: ${tag.name}`, description: `Статьи с тегом ${tag.name}` };
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = await db.tag.findUnique({ where: { slug: params.slug } });
  if (!tag) notFound();

  const page = Math.max(1, Number(spStr(searchParams.page)) || 1);
  const where = { status: 'published' as const, tags: { some: { tagId: tag.id } } };
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
          { label: `Тег: ${tag.name}` },
        ]}
      />

      <div className="mb-6">
        <h1 className="font-display text-h2 font-bold">Тег: {tag.name}</h1>
        <p className="mt-1 text-caption text-muted">Статей: {total}</p>
      </div>

      <ArticleGrid items={items} stagger emptyText="Статей с этим тегом пока нет" />
      <Pagination page={page} pages={pages} basePath={`/tag/${tag.slug}`} />
    </div>
  );
}
