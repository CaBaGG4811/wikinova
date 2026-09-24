'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, Plus } from 'lucide-react';

interface CollectionOption {
  id: string;
  name: string;
}

interface Props {
  articleId: string;
}

export function AddToCollectionButton({ articleId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/collections/mine');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { collections?: CollectionOption[] };
        setCollections(data.collections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function add(collectionId: string) {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        setStatus('Уже в этой коллекции');
        return;
      }
      if (!res.ok) {
        setStatus(data?.error ?? 'Не удалось добавить');
        return;
      }
      setStatus('Добавлено');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !newName.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const createRes = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const created = (await createRes.json().catch(() => null)) as {
        collection?: { id: string };
        error?: string;
      } | null;
      if (!createRes.ok || !created?.collection) {
        setStatus(created?.error ?? 'Не удалось создать коллекцию');
        return;
      }
      await add(created.collection.id);
      setNewName('');
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-secondary !py-1.5 !px-2.5 text-sm"
        onClick={() => {
          setStatus(null);
          setCreating(false);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        <FolderPlus size={15} />
        <span className="hidden sm:inline">В коллекцию</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-1 z-40 card shadow-float p-2 w-64">
          {loading ? (
            <p className="text-xs text-muted px-1 py-1.5">Загружаем…</p>
          ) : collections.length === 0 && !creating ? (
            <p className="text-xs text-muted px-1 py-1.5">Коллекций пока нет</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {collections.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 text-sm rounded-md hover:bg-ink/5 transition-colors duration-150"
                    disabled={busy}
                    onClick={() => void add(c.id)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {creating ? (
            <form onSubmit={createAndAdd} className="mt-2 border-t border-line pt-2 space-y-1.5">
              <input
                className="input !py-1.5 text-sm"
                placeholder="Название коллекции"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button type="submit" className="btn-primary !py-1.5 text-xs flex-1" disabled={busy}>
                  Создать и добавить
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-xs"
                  onClick={() => setCreating(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="mt-1.5 w-full text-left px-2.5 py-1.5 text-sm rounded-md border-t border-line text-primary hover:bg-ink/5 transition-colors duration-150 flex items-center gap-1.5"
              onClick={() => setCreating(true)}
            >
              <Plus size={13} />
              Создать новую
            </button>
          )}

          {status ? <p className="mt-1.5 text-xs text-muted px-1">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
