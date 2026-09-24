'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  Copy,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Video,
  Image as ImageIcon,
} from 'lucide-react';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';
import { Modal } from '@/components/admin/Modal';

type MediaKind = 'image' | 'video' | 'document';

interface MediaRow {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  mimeType: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string } | null;
}

const limits: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

function kindOf(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

function folderOf(kind: MediaKind): 'images' | 'videos' | 'docs' {
  if (kind === 'image') return 'images';
  if (kind === 'video') return 'videos';
  return 'docs';
}

const tabs: { key: '' | MediaKind; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'image', label: 'Изображения' },
  { key: 'video', label: 'Видео' },
  { key: 'document', label: 'Документы' },
];

export default function MediaPage() {
  const toast = useToast();
  const [items, setItems] = useState<MediaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [type, setType] = useState<'' | MediaKind>('');
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [renameTarget, setRenameTarget] = useState<MediaRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (type) params.set('type', type);
      const res = await fetch(`/api/admin/media?${params.toString()}`);
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { items: MediaRow[]; total: number; pageSize: number };
      setItems(data.items);
      setTotal(data.total);
      setPageSize(data.pageSize);
    } catch {
      toast('Не удалось загрузить медиатеку', 'err');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      for (const f of list) {
        const kind = kindOf(f);
        if (f.size > limits[kind]) {
          toast(
            `${f.name}: лимит ${kind === 'image' ? '10 МБ для изображений' : kind === 'video' ? '100 МБ для видео' : '20 МБ для документов'}`,
            'err',
          );
          return;
        }
      }
      setUploading(list.length);
      try {
        for (let i = 0; i < list.length; i += 3) {
          const chunk = list.slice(i, i + 3);
          await Promise.all(
            chunk.map(async (f) => {
              const fd = new FormData();
              fd.append('file', f);
              fd.append('folder', folderOf(kindOf(f)));
              const res = await fetch('/api/upload', { method: 'POST', body: fd });
              if (!res.ok) {
                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(data?.error ?? `Не удалось загрузить ${f.name}`);
              }
            }),
          );
        }
        toast(`Загружено файлов: ${list.length}`);
        load();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Ошибка загрузки', 'err');
      } finally {
        setUploading(0);
      }
    },
    [load, toast],
  );

  async function copyUrl(row: MediaRow) {
    try {
      await navigator.clipboard.writeText(row.url);
      toast('Скопировано');
    } catch {
      toast('Не удалось скопировать ссылку', 'err');
    }
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const base = renameValue.trim();
    if (!base) {
      toast('Введите новое имя', 'err');
      return;
    }
    try {
      const res = await fetch(`/api/admin/media/${renameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: base }),
      });
      if (!res.ok) throw new Error('fail');
      toast('Файл переименован');
      setRenameTarget(null);
      load();
    } catch {
      toast('Не удалось переименовать файл', 'err');
    }
  }

  async function remove(row: MediaRow) {
    if (!window.confirm(`Удалить файл «${row.filename}»?`)) return;
    try {
      const res = await fetch(`/api/admin/media/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('fail');
      toast('Файл удалён');
      load();
    } catch {
      toast('Не удалось удалить файл', 'err');
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-bold">Медиа</h1>
          <p className="text-sm text-muted mt-1">Файлов всего: {total}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
        >
          <Upload size={16} />
          {uploading > 0 ? `Загрузка...` : 'Загрузить файлы'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-150',
          dragOver ? 'border-primary bg-primary/5' : 'border-line',
        )}
      >
        <Upload size={20} className="mx-auto text-muted mb-2" />
        <p className="text-sm text-muted">
          Перетащите файлы сюда. Изображения до 10 МБ, видео до 100 МБ, документы до 20 МБ.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key || 'all'}
            type="button"
            className={cn('btn-secondary text-xs', type === t.key && 'bg-ink/8 border-ink/30')}
            onClick={() => {
              setType(t.key);
              setPage(1);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Файлов пока нет.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((row) => (
            <div key={row.id} className="card overflow-hidden flex flex-col">
              {row.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.url}
                  alt={row.filename}
                  className="w-full h-32 object-cover border-b border-line"
                />
              ) : row.type === 'video' ? (
                <div className="w-full h-32 bg-ink/90 flex items-center justify-center border-b border-line">
                  <Video size={26} className="text-stone-300" />
                </div>
              ) : (
                <div className="w-full h-32 bg-bg flex flex-col items-center justify-center gap-1 border-b border-line">
                  <FileText size={22} className="text-muted" />
                  <span className="font-mono text-[10px] text-muted px-3 text-center truncate max-w-full">
                    {row.mimeType || 'документ'}
                  </span>
                </div>
              )}
              <div className="p-3 flex-1 flex flex-col gap-1 min-w-0">
                <div className="text-xs font-medium truncate" title={row.filename}>
                  {row.filename}
                </div>
                <div className="text-[11px] text-muted">
                  {formatBytes(row.size)} · {formatDate(row.createdAt)}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    type="button"
                    className="btn-ghost !px-1.5 !py-1"
                    title="Копировать URL"
                    onClick={() => copyUrl(row)}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-1.5 !py-1"
                    title="Переименовать"
                    onClick={() => {
                      setRenameTarget(row);
                      setRenameValue(row.filename.replace(/\.[^.]+$/, ''));
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-1.5 !py-1 hover:text-danger"
                    title="Удалить"
                    onClick={() => remove(row)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
            Назад
          </button>
          <span className="text-sm text-muted">
            {page} из {pages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Далее
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Переименовать файл"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setRenameTarget(null)}>
              Отмена
            </button>
            <button type="button" className="btn-primary" onClick={confirmRename}>
              Сохранить
            </button>
          </>
        }
      >
        <label className="label">Новое имя (без расширения)</label>
        <input
          className="input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-muted mt-2">
          {renameTarget ? `Текущее расширение: ${renameTarget.filename.split('.').pop()}` : ''}
        </p>
      </Modal>
    </div>
  );
}
