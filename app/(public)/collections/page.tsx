import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { CollectionsManager } from '@/components/collections/CollectionsManager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Коллекции',
  description: 'Личные коллекции статей WikiNova.',
};

export default async function CollectionsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Коллекции' }]} />
        <header className="mb-6">
          <h1 className="font-display text-h2 font-bold">Коллекции</h1>
          <p className="mt-1 text-caption text-muted">
            Собирайте статьи в подборки. Нужен аккаунт читателя.
          </p>
        </header>
        <div className="card p-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Войдите, чтобы создавать и редактировать коллекции.</p>
          <div className="flex gap-2">
            <Link href="/login?from=/collections" className="btn-secondary">Войти</Link>
            <Link href="/register" className="btn-primary">Регистрация</Link>
          </div>
        </div>
        <PublicCollectionsList />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Коллекции' }]} />
      <header className="mb-6">
        <h1 className="font-display text-h2 font-bold">Коллекции</h1>
        <p className="mt-1 text-caption text-muted">Ваши подборки статей: создание, редактирование, удаление.</p>
      </header>
      <CollectionsManager />
      <div className="mt-10">
        <PublicCollectionsList />
      </div>
    </div>
  );
}

async function PublicCollectionsList() {
  const publicOnes = await db.collection.findMany({
    where: { isPublic: true },
    include: {
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  if (publicOnes.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-h3 font-semibold mb-3">Публичные коллекции</h2>
      <ul className="divide-y divide-line/70 border border-line rounded-lg overflow-hidden">
        {publicOnes.map((c) => (
          <li key={c.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/collection/${c.id}`}
                className="font-medium text-ink hover:text-primary transition-colors duration-150"
              >
                {c.name}
              </Link>
              {c.description ? <p className="text-sm text-muted mt-0.5">{c.description}</p> : null}
            </div>
            <span className="text-xs text-muted shrink-0">
              {c.user.name} · {c._count.items} статей
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
