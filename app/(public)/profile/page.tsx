import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { ProfileSignOut } from '@/components/ProfileSignOut';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Профиль',
  description: 'Профиль читателя WikiNova: закладки, лайки и заявки.',
};

const requestLabels: Record<string, string> = {
  pending: 'На рассмотрении',
  in_progress: 'В работе',
  done: 'Готово',
  rejected: 'Отклонена',
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login?from=/profile');

  const userId = session.user.id;
  const email = session.user.email ?? '';

  const [bookmarks, likes, requests] = await Promise.all([
    db.bookmark.findMany({
      where: { userId },
      include: {
        article: {
          select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true, status: true },
        },
      },
      orderBy: { article: { publishedAt: 'desc' } },
      take: 50,
    }),
    db.articleLike.findMany({
      where: { userId },
      include: {
        article: {
          select: { id: true, slug: true, title: true, excerpt: true, publishedAt: true, status: true },
        },
      },
      orderBy: { article: { publishedAt: 'desc' } },
      take: 50,
    }),
    db.articleRequest.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Профиль' }]} />

      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">{session.user.name ?? 'Профиль'}</h1>
          <p className="text-sm text-muted mt-1">{email}</p>
        </div>
        <ProfileSignOut />
      </header>

      <section className="mb-10">
        <h2 className="font-display text-h3 font-semibold mb-3">Закладки</h2>
        {bookmarks.length === 0 ? (
          <p className="text-sm text-muted">Закладок пока нет.</p>
        ) : (
          <ul className="divide-y divide-line/70 border border-line rounded-lg overflow-hidden">
            {bookmarks.map((b) => (
              <li key={b.articleId} className="px-4 py-3">
                <Link
                  href={`/article/${b.article.slug}`}
                  className="font-medium text-ink hover:text-primary transition-colors duration-150"
                >
                  {b.article.title}
                </Link>
                {b.article.excerpt ? (
                  <p className="text-sm text-muted mt-0.5 line-clamp-2">{b.article.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="font-display text-h3 font-semibold mb-3">Лайки</h2>
        {likes.length === 0 ? (
          <p className="text-sm text-muted">Лайков пока нет.</p>
        ) : (
          <ul className="divide-y divide-line/70 border border-line rounded-lg overflow-hidden">
            {likes.map((l) => (
              <li key={l.articleId} className="px-4 py-3">
                <Link
                  href={`/article/${l.article.slug}`}
                  className="font-medium text-ink hover:text-primary transition-colors duration-150"
                >
                  {l.article.title}
                </Link>
                {l.article.excerpt ? (
                  <p className="text-sm text-muted mt-0.5 line-clamp-2">{l.article.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-h3 font-semibold mb-3">Мои заявки</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">
            Заявок нет. Можете{' '}
            <Link href="/request" className="text-primary underline underline-offset-2">
              заказать статью
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line/70 border border-line rounded-lg overflow-hidden">
            {requests.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">{r.topic}</div>
                  <div className="text-xs text-muted">{formatDate(r.createdAt)}</div>
                </div>
                <span className="badge">{requestLabels[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
