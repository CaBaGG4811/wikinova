import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { cardInclude } from '@/lib/article';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { ArticleCard } from '@/components/article/ArticleCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function CollectionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const collection = await db.collection.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true } },
      items: {
        include: { article: { include: cardInclude } },
        orderBy: { order: 'asc' },
      },
    },
  });
  if (!collection) notFound();
  const isOwner = session?.user?.id === collection.userId;
  if (!collection.isPublic && !isOwner) notFound();

  const articles = collection.items.map((i) => i.article);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs
        items={[
          { label: 'Главная', href: '/' },
          { label: 'Коллекции', href: '/collections' },
          { label: collection.name },
        ]}
      />

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="badge">{collection.isPublic ? 'Публичная' : 'Личная'}</span>
          {!collection.isPublic && isOwner ? <span className="badge border-primary/40 text-primary">Ваша</span> : null}
        </div>
        <h1 className="font-display text-h2 font-bold">{collection.name}</h1>
        <p className="mt-1 text-caption text-muted">
          {collection.user.name} · {articles.length} статей
        </p>
        {collection.description ? (
          <p className="mt-3 text-body text-ink max-w-[70ch]">{collection.description}</p>
        ) : null}
      </header>

      {articles.length === 0 ? (
        <div className="card p-6 text-sm text-muted">В этой коллекции пока нет статей.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <div key={a.id} className="stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
              <ArticleCard article={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
