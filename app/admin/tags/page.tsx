'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Hash } from 'lucide-react';
import { slugify } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';
import { Modal } from '@/components/admin/Modal';

interface TagRow {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  slugTouched: boolean;
}

const emptyForm: FormState = { id: null, name: '', slug: '', slugTouched: false };

export default function TagsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tags');
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { tags: TagRow[] };
      setRows(data.tags);
    } catch {
      toast('Не удалось загрузить теги', 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!form.name.trim()) {
      toast('Укажите название тега', 'err');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(form.id ? `/api/admin/tags/${form.id}` : '/api/admin/tags', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slugTouched ? form.slug : slugify(form.name),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Не удалось сохранить тег');
      toast(form.id ? 'Тег обновлён' : 'Тег создан');
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка сохранения', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tags/${deleteTarget.id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Не удалось удалить тег');
      toast('Тег удалён. Связи со статьями сняты.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка удаления', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Теги</h1>
          <p className="text-sm text-muted mt-1">Метки для связывания статей</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setForm(emptyForm);
            setModalOpen(true);
          }}
        >
          <Plus size={16} />
          Создать тег
        </button>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? (
          <p className="text-sm text-muted">Загрузка...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Тегов пока нет.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="card p-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-sm">
                  <Hash size={14} className="text-muted shrink-0" />
                  <span className="truncate">{row.name}</span>
                </div>
                <div className="font-mono text-xs text-muted mt-0.5 truncate">/{row.slug}</div>
                <div className="text-xs text-muted mt-1">статей: {row._count.articles}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="btn-ghost !px-1.5 !py-1.5"
                  title="Редактировать"
                  onClick={() => {
                    setForm({
                      id: row.id,
                      name: row.name,
                      slug: row.slug,
                      slugTouched: true,
                    });
                    setModalOpen(true);
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-1.5 !py-1.5 hover:text-danger"
                  title="Удалить"
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Редактировать тег' : 'Новый тег'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }));
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Слаг</label>
            <input
              className="input font-mono text-xs"
              value={form.slug || slugify(form.name || '')}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить тег?"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>
              Отмена
            </button>
            <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
              {busy ? 'Удаление...' : 'Удалить'}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {deleteTarget ? (
            <>
              Тег «{deleteTarget.name}» исчезнет из {deleteTarget._count.articles} статей.
              Продолжить?
            </>
          ) : null}
        </p>
      </Modal>
    </div>
  );
}
