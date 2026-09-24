'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Copy,
  Trash2,
  Plus,
  Search,
  PenLine,
  X,
  CheckSquare,
} from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';

type ArticleStatus = 'draft' | 'published' | 'archived';

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  status: ArticleStatus;
  views: number;
  featured: boolean;
  content: string;
  createdAt: string;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  author: { id: string; name: string };
  category: { id: string; name: string; slug: string; color: string } | null;
  tags: { tag: { id: string; name: string; slug: string } }[];
  ratings?: { value: number }[];
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface AiMetadata {
  excerpt?: string;
  description?: string;
}

const AI_DOWN = 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';

const statusView: Record<ArticleStatus, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: 'border-line text-muted bg-surface' },
  published: { label: 'Опубликована', cls: 'border-ok/40 text-ok bg-ok/10' },
  archived: { label: 'В архиве', cls: 'border-accent/40 text-accent bg-accent/10' },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface GenState {
  total: number;
  done: number;
  title: string;
}

export default function ArticlesAdminPage() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gen, setGen] = useState<GenState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: CategoryOption[] }) => setCategories(d.categories ?? []))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (categoryId) params.set('categoryId', categoryId);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/admin/articles?${params.toString()}`);
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { articles: ArticleRow[] };
      setRows(data.articles);
      setSelected(new Set());
    } catch {
      toast('Не удалось загрузить статьи', 'err');
    } finally {
      setLoading(false);
    }
  }, [status, categoryId, q, toast]);

  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);

  async function bulkStatus(next: ArticleStatus) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/articles/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next }),
          }),
        ),
      );
      toast(`Обновлено статей: ${ids.length}`);
      load();
    } catch {
      toast('Не удалось обновить статьи', 'err');
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Удалить выбранные статьи (${ids.length})? Это необратимо.`)) return;
    try {
      await Promise.all(
        ids.map((id) => fetch(`/api/admin/articles/${id}`, { method: 'DELETE' })),
      );
      toast(`Удалено статей: ${ids.length}`);
      load();
    } catch {
      toast('Не удалось удалить статьи', 'err');
    }
  }

  async function generateExcerpts() {
    const ids = Array.from(selected);
    if (ids.length === 0 || gen) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGen({ total: ids.length, done: 0, title: '' });
    try {
      for (const id of ids) {
        if (controller.signal.aborted) break;
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        setGen((g) => (g ? { ...g, title: row.title } : g));
        const aiRes = await fetch('/api/ai/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: row.content }),
          signal: controller.signal,
        });
        if (!aiRes.ok) throw new Error('ai-down');
        const meta = (await aiRes.json()) as AiMetadata;
        const excerpt = (meta.excerpt ?? meta.description ?? '').trim();
        if (excerpt) {
          const patchRes = await fetch(`/api/articles/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ excerpt }),
            signal: controller.signal,
          });
          if (!patchRes.ok) throw new Error('patch-fail');
        }
        setGen((g) => (g ? { ...g, done: g.done + 1 } : g));
      }
      if (controller.signal.aborted) {
        toast('Генерация остановлена');
      } else {
        toast('Краткие описания обновлены');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') toast('Генерация остановлена');
      else if ((err as Error).message === 'ai-down') toast(AI_DOWN, 'err');
      else toast('Не удалось обновить описания', 'err');
    } finally {
      abortRef.current = null;
      setGen(null);
      load();
    }
  }

  async function duplicate(row: ArticleRow) {
    const title = `${row.title} (копия)`;
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
          excerpt: row.excerpt,
          content: row.content,
          coverImage: row.coverImage,
          status: 'draft',
          featured: false,
          categoryId: row.category?.id ?? null,
          tagIds: row.tags.map((t) => t.tag.id),
          seoTitle: row.seoTitle ?? null,
          seoDescription: row.seoDescription ?? null,
          ogImage: null,
        }),
      });
      const data = (await res.json()) as { article?: { id: string }; error?: string };
      if (!res.ok || !data.article) throw new Error(data.error ?? 'fail');
      toast('Копия создана как черновик');
      router.push(`/admin/articles/${data.article.id}/edit`);
    } catch {
      toast('Не удалось продублировать статью', 'err');
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Статьи</h1>
          <p className="text-sm text-muted mt-1">Всего в базе: {rows.length}</p>
        </div>
        <Link href="/admin/articles/new" className="btn-primary">
          <Plus size={16} />
          Создать статью
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            className="input !pl-9"
            placeholder="Поиск по заголовку или слагу"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="draft">Черновики</option>
          <option value="published">Опубликованные</option>
          <option value="archived">В архиве</option>
        </select>
        <select
          className="input !w-auto"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {gen ? (
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Генерируем описания: {gen.done} из {gen.total}
              {gen.title ? <span className="text-muted"> · {gen.title}</span> : null}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => abortRef.current?.abort()}
            >
              <X size={16} />
              Отменить
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round((gen.done / Math.max(1, gen.total)) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted mr-1">Выбрано: {selected.size}</span>
          <button type="button" className="btn-secondary" onClick={() => bulkStatus('published')}>
            Опубликовать
          </button>
          <button type="button" className="btn-secondary" onClick={() => bulkStatus('archived')}>
            В архив
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={generateExcerpts}
            disabled={Boolean(gen)}
          >
            <PenLine size={16} />
            Сгенерировать краткие описания
          </button>
          <button type="button" className="btn-danger" onClick={bulkDelete}>
            <Trash2 size={16} />
            Удалить
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())}>
            Снять выделение
          </button>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Выбрать все"
                    className="accent-[rgb(var(--c-primary))]"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Статья</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Автор</th>
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium text-right">Рейтинг</th>
                <th className="px-4 py-3 font-medium text-right">Просмотры</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    Ничего не найдено
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const st = statusView[row.status];
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-line/70 last:border-0 transition-colors duration-150',
                        selected.has(row.id) && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={`Выбрать ${row.title}`}
                          className="accent-[rgb(var(--c-primary))]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {row.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.coverImage}
                              alt=""
                              className="w-10 h-7 object-cover rounded-sm border border-line shrink-0 mt-0.5"
                            />
                          ) : (
                            <span className="w-10 h-7 rounded-sm border border-dashed border-line shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate max-w-[280px]">
                              {row.title}
                            </div>
                            <div className="font-mono text-xs text-muted truncate max-w-[280px]">
                              /{row.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={cn('badge', st.cls)}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 align-top text-muted">{row.author.name}</td>
                      <td className="px-4 py-3 align-top text-muted whitespace-nowrap">
                        {shortDate(row.publishedAt ?? row.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-right tabular-nums">
                        {(() => {
                          const ratings = row.ratings ?? [];
                          if (ratings.length === 0) return <span className="text-muted">—</span>;
                          const avg = ratings.reduce((s, r) => s + r.value, 0) / ratings.length;
                          return (
                            <span title={`Оценок: ${ratings.length}`}>
                              {avg.toFixed(1)} <span className="text-muted">({ratings.length})</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 align-top text-right tabular-nums">
                        {row.views.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/articles/${row.id}/edit`}
                            className="btn-ghost !px-2 !py-1.5"
                            title="Редактировать"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-1.5"
                            title="Дублировать"
                            onClick={() => duplicate(row)}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-1.5 hover:text-danger"
                            title="Удалить"
                            onClick={async () => {
                              if (!window.confirm(`Удалить «${row.title}»?`)) return;
                              const res = await fetch(`/api/admin/articles/${row.id}`, {
                                method: 'DELETE',
                              });
                              if (res.ok) {
                                toast('Статья удалена');
                                load();
                              } else {
                                toast('Не удалось удалить статью', 'err');
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden">
          <span className="badge bg-surface">
            <CheckSquare size={14} className="mr-1.5" />
            выбрано {selected.size}
          </span>
        </div>
      ) : null}
    </div>
  );
}
