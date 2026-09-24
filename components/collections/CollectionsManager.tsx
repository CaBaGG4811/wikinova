'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderPlus, Globe, Lock, Pencil, Sparkles, Trash2 } from 'lucide-react';

interface CollectionRow {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  _count?: { items: number };
  items?: { id: string }[];
}

export function CollectionsManager() {
  const router = useRouter();
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublic, setEditPublic] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collections');
      if (res.status === 401) {
        router.push('/login?from=/collections');
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { collections?: CollectionRow[] };
        setRows(data.collections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description, isPublic }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? 'Не удалось создать коллекцию');
        return;
      }
      setName('');
      setDescription('');
      setIsPublic(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: CollectionRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditDescription(row.description);
    setEditPublic(row.isPublic);
  }

  async function saveEdit(id: string) {
    if (busy || !editName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription,
          isPublic: editPublic,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Не удалось сохранить');
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Удалить коллекцию «${title}»?`)) return;
    const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  const [aiBusy, setAiBusy] = useState(false);

  async function describeWithAi(
    colName: string,
    collectionId: string | null,
    apply: (v: string) => void,
  ) {
    if (!colName.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      let articles: { title: string; excerpt: string }[] = [];
      if (collectionId) {
        const res = await fetch(`/api/collections/${collectionId}`);
        const data = (await res.json().catch(() => null)) as
          | { collection?: { items?: { article?: { title?: string; excerpt?: string } }[] } }
          | null;
        articles = (data?.collection?.items ?? [])
          .map((i) => ({ title: i.article?.title ?? '', excerpt: i.article?.excerpt ?? '' }))
          .filter((a) => a.title);
      }
      const aiRes = await fetch('/api/ai/collection-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: colName.trim(), articles }),
      });
      const data = (await aiRes.json().catch(() => null)) as { description?: string; error?: string } | null;
      if (!aiRes.ok || !data?.description) throw new Error(data?.error ?? 'ai');
      apply(data.description.slice(0, 400));
    } catch {
      setError('ИИ не смог описать коллекцию. Попробуйте позже.');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderPlus size={15} className="text-primary" />
          Новая коллекция
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="col-name">Название</label>
            <input
              id="col-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Космос"
              maxLength={80}
            />
          </div>
          <div>
            <label className="label" htmlFor="col-desc">Описание</label>
            <div className="flex gap-2">
              <input
                id="col-desc"
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Необязательно"
                maxLength={400}
              />
              <button
                type="button"
                className="btn-secondary !px-2.5 shrink-0"
                title="Описать с помощью ИИ"
                disabled={aiBusy || !name.trim()}
                onClick={() => void describeWithAi(name, null, setDescription)}
              >
                <Sparkles size={15} />
              </button>
            </div>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-[rgb(var(--c-primary))]"
          />
          Публичная (видна всем по ссылке)
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy ? 'Создаём' : 'Создать'}
        </button>
      </form>

      <section>
        <h2 className="font-display text-h3 font-semibold mb-3">Мои коллекции</h2>
        {loading ? (
          <p className="text-sm text-muted">Загружаем…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Коллекций пока нет. Создайте первую выше.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="card p-4">
                {editingId === row.id ? (
                  <div className="space-y-3">
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={80}
                    />
                    <div className="flex gap-2">
                      <input
                        className="input"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        maxLength={400}
                        placeholder="Описание"
                      />
                      <button
                        type="button"
                        className="btn-secondary !px-2.5 shrink-0"
                        title="Описать с помощью ИИ"
                        disabled={aiBusy}
                        onClick={() => void describeWithAi(editName, row.id, setEditDescription)}
                      >
                        <Sparkles size={15} />
                      </button>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPublic}
                        onChange={(e) => setEditPublic(e.target.checked)}
                        className="accent-[rgb(var(--c-primary))]"
                      />
                      Публичная
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary !py-1.5 text-sm" onClick={() => void saveEdit(row.id)} disabled={busy}>
                        Сохранить
                      </button>
                      <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/collection/${row.id}`}
                          className="font-medium text-ink hover:text-primary transition-colors duration-150"
                        >
                          {row.name}
                        </Link>
                        <span className="badge">
                          {row.isPublic ? <Globe size={11} className="mr-1" /> : <Lock size={11} className="mr-1" />}
                          {row.isPublic ? 'Публичная' : 'Личная'}
                        </span>
                        <span className="text-xs text-muted">
                          {row._count?.items ?? row.items?.length ?? 0} статей
                        </span>
                      </div>
                      {row.description ? (
                        <p className="text-sm text-muted mt-1">{row.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1.5"
                        title="Редактировать"
                        onClick={() => startEdit(row)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1.5 hover:text-danger"
                        title="Удалить"
                        onClick={() => void remove(row.id, row.name)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
