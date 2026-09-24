import type { Metadata } from 'next';
import Link from 'next/link';
import { spStr } from '@/lib/article';
import { searchArticles } from '@/lib/search';
import { formatDate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Поиск',
  description: 'Поиск по статьям WikiNova.',
};

interface Props {
  searchParams: { [key: string]: string | string[] | undefined };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={`${i}-${part}`} className="bg-primary-soft text-ink">
            {part}
          </mark>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        ),
      )}
    </>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const q = (spStr(searchParams.q) ?? '').trim();
  const { items, total } = await searchArticles(q, 30);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Поиск' }]} />

      <h1 className="font-display mb-2 text-h2 font-bold">Поиск</h1>
      <p className="mb-8 text-caption text-muted">
        {q ? `Запрос: ${q}. Найдено: ${total}` : 'Введите запрос в строке поиска в шапке.'}
      </p>

      {q && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line py-10 text-center text-caption text-muted">
          По запросу «{q}» ничего не нашлось. Попробуйте другие слова или закажите статью.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {items.map((a, i) => (
          <li key={a.id} className="stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
            <Link
              href={`/article/${a.slug}`}
              className="card block p-5 transition-colors duration-150 hover:border-ink/30"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {a.category ? (
                  <span className="badge">
                    <span
                      className="mr-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: a.category.color }}
                    />
                    {a.category.name}
                  </span>
                ) : null}
                <span className="text-caption text-muted">
                  {formatDate(a.publishedAt ?? a.createdAt)}
                </span>
              </div>
              <h2 className="font-display text-lg font-semibold leading-snug">
                <Highlight text={a.title} q={q} />
              </h2>
              {a.excerpt ? (
                <p className="mt-1.5 line-clamp-2 text-caption text-muted">
                  <Highlight text={a.excerpt} q={q} />
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
