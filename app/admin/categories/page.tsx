'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FlaskConical,
  Cpu,
  Landmark,
  Palette,
  Brain,
  Stethoscope,
  Rocket,
  Leaf,
  Globe,
  Music,
  GraduationCap,
  Heart,
  Atom,
  Camera,
  BookOpen,
  Circle,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';
import { Modal } from '@/components/admin/Modal';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  _count: { articles: number };
}

const iconMap: Record<string, LucideIcon> = {
  FlaskConical,
  Cpu,
  Landmark,
  Palette,
  Brain,
  Stethoscope,
  Rocket,
  Leaf,
  Globe,
  Music,
  GraduationCap,
  Heart,
  Atom,
  Camera,
  BookOpen,
};

const iconNames = Object.keys(iconMap);

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  icon: string;
  color: string;
}

const emptyForm: FormState = {
  id: null,
  name: '',
  slug: '',
  slugTouched: false,
  description: '',
  icon: '',
  color: '#166534',
};

export default function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { categories: CategoryRow[] };
      setRows(data.categories);
    } catch {
      toast('Не удалось загрузить категории', 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(row: CategoryRow) {
    setForm({
      id: row.id,
      name: row.name,
      slug: row.slug,
      slugTouched: true,
      description: row.description,
      icon: row.icon,
      color: row.color,
    });
    setModalOpen(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast('Укажите название категории', 'err');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slugTouched ? form.slug : slugify(form.name),
        description: form.description,
        icon: form.icon,
        color: form.color,
      };
      const res = await fetch(
        form.id ? `/api/admin/categories/${form.id}` : '/api/admin/categories',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Не удалось сохранить категорию');
      toast(form.id ? 'Категория обновлена' : 'Категория создана');
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
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? 'Не удалось удалить категорию');
      toast('Категория удалена');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка удаления', 'err');
    } finally {
      setBusy(false);
    }
  }

  const PreviewIcon = iconMap[form.icon] ?? Circle;

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Категории</h1>
          <p className="text-sm text-muted mt-1">Разделы энциклопедии</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Создать категорию
        </button>
      </header>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th className="px-4 py-3 font-medium">Категория</th>
                <th className="px-4 py-3 font-medium">Описание</th>
                <th className="px-4 py-3 font-medium text-right">Статей</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    Категорий пока нет
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const Icon = iconMap[row.icon] ?? Circle;
                  return (
                    <tr key={row.id} className="border-b border-line/70 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-line"
                            style={{ color: row.color }}
                          >
                            <Icon size={15} />
                          </span>
                          <div>
                            <div className="font-medium">{row.name}</div>
                            <div className="font-mono text-xs text-muted">/{row.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[280px] truncate">
                        {row.description || 'нет описания'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row._count.articles}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-1.5"
                            title="Редактировать"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !px-2 !py-1.5 hover:text-danger"
                            title="Удалить"
                            onClick={() => setDeleteTarget(row)}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Редактировать категорию' : 'Новая категория'}
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
                setForm((f) => ({
                  ...f,
                  name,
                  slug: f.slugTouched ? f.slug : slugify(name),
                }));
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Слаг</label>
            <input
              className="input font-mono text-xs"
              value={form.slug || slugify(form.name || '')}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))
              }
            />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea
              className="input min-h-[64px] resize-y"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Иконка</label>
              <select
                className="input"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              >
                <option value="">Без иконки</option>
                {iconNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Предпросмотр</label>
              <div className="input !w-14 !px-0 flex items-center justify-center" style={{ color: form.color }}>
                <PreviewIcon size={18} />
              </div>
            </div>
            <div>
              <label className="label">Цвет</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-9 h-9 rounded-md border border-line bg-surface p-0.5"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
                <input
                  className="input !w-28 font-mono text-xs"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить категорию?"
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
              Категория «{deleteTarget.name}» будет удалена безвозвратно. Статей в ней:{' '}
              {deleteTarget._count.articles}. Если статьи есть, удаление будет заблокировано.
            </>
          ) : null}
        </p>
      </Modal>
    </div>
  );
}
