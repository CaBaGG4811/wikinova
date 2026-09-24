'use client';

import { LayoutGrid, List } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface Props {
  categories: Option[];
  tags: Option[];
  authors: Option[];
  current: {
    category?: string;
    tag?: string;
    author?: string;
    date?: string;
    sort?: string;
    view?: string;
  };
}

const DATES: Option[] = [
  { value: '', label: 'За всё время' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

const SORTS: Option[] = [
  { value: '', label: 'Сначала новые' },
  { value: 'views', label: 'По просмотрам' },
  { value: 'title', label: 'По алфавиту' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function ArticleFilters({ categories, tags, authors, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `/articles?${qs}` : '/articles', { scroll: false });
  }

  const view = current.view === 'list' ? 'list' : 'grid';

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 sm:w-44 sm:flex-none">
          <Field label="Категория">
            <select
              className="input"
              value={current.category ?? ''}
              onChange={(e) => setParam('category', e.target.value)}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex-1 sm:w-40 sm:flex-none">
          <Field label="Тег">
            <select
              className="input"
              value={current.tag ?? ''}
              onChange={(e) => setParam('tag', e.target.value)}
            >
              <option value="">Все теги</option>
              {tags.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex-1 sm:w-40 sm:flex-none">
          <Field label="Автор">
            <select
              className="input"
              value={current.author ?? ''}
              onChange={(e) => setParam('author', e.target.value)}
            >
              <option value="">Все авторы</option>
              {authors.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex-1 sm:w-40 sm:flex-none">
          <Field label="Дата">
            <select
              className="input"
              value={current.date ?? ''}
              onChange={(e) => setParam('date', e.target.value)}
            >
              {DATES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex-1 sm:w-44 sm:flex-none">
          <Field label="Сортировка">
            <select
              className="input"
              value={current.sort ?? ''}
              onChange={(e) => setParam('sort', e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <span className="label">Вид</span>
          <div className="flex items-center gap-1 rounded-md border border-line p-0.5">
            <button
              type="button"
              onClick={() => setParam('view', '')}
              aria-label="Сетка"
              aria-pressed={view === 'grid'}
              className={cn(
                'rounded-md p-1.5 transition-colors duration-150',
                view === 'grid' ? 'bg-ink/8 text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setParam('view', 'list')}
              aria-label="Список"
              aria-pressed={view === 'list'}
              className={cn(
                'rounded-md p-1.5 transition-colors duration-150',
                view === 'list' ? 'bg-ink/8 text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
