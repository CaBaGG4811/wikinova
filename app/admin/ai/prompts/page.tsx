'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

interface PromptRow {
  id: string;
  key: string;
  template: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiPromptsPage() {
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [activeKey, setActiveKey] = useState('summarize');
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keys = Array.from(new Set(rows.map((r) => r.key))).sort();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/prompts');
      const data = (await res.json().catch(() => null)) as { rows?: PromptRow[]; error?: string } | null;
      if (!res.ok || !data || !Array.isArray(data.rows)) {
        setError(data?.error ?? `Не удалось загрузить шаблоны (${res.status})`);
        return;
      }
      setRows(data.rows);
    } catch {
      setError('Не удалось загрузить шаблоны.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const keyRows = rows.filter((r) => r.key === activeKey).sort((a, b) => b.version - a.version);
  const activeRow = keyRows.find((r) => r.isActive) ?? keyRows[0];
  const lastKeyRef = useRef<string | null>(null);

  function selectKey(key: string) {
    setNote(null);
    setActiveKey(key);
  }

  useEffect(() => {
    if (loading) return;
    const key = keys.includes(activeKey) ? activeKey : keys[0];
    if (!key) return;
    if (key !== activeKey) {
      setActiveKey(key);
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    const active = rows.find((r) => r.key === key && r.isActive) ?? rows.find((r) => r.key === key);
    setTemplate(active?.template ?? '');
  }, [loading, rows, keys, activeKey]);

  async function applyRows(next: { rows?: PromptRow[]; error?: string } | null, ok: boolean, success: string) {
    if (!ok || !next || !Array.isArray(next.rows)) {
      setNote(next?.error ?? 'Операция не выполнена.');
      return;
    }
    setRows(next.rows);
    const active = next.rows.find((r) => r.key === activeKey && r.isActive);
    if (active) setTemplate(active.template);
    setNote(success);
    window.setTimeout(() => setNote(null), 2500);
  }

  async function saveNewVersion() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ai/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: activeKey, template }),
      });
      const data = (await res.json().catch(() => null)) as { rows?: PromptRow[]; error?: string } | null;
      await applyRows(data, res.ok, 'Сохранено как новая версия');
    } finally {
      setBusy(false);
    }
  }

  async function resetDefault() {
    if (!window.confirm('Заменить активную версию на дефолтный шаблон?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/ai/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: activeKey, resetDefault: true }),
      });
      const data = (await res.json().catch(() => null)) as { rows?: PromptRow[]; error?: string } | null;
      await applyRows(data, res.ok, 'Создана версия с дефолтным шаблоном');
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ai/prompts/${id}/restore`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { rows?: PromptRow[]; error?: string } | null;
      await applyRows(data, res.ok, 'Версия активирована');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Удалить эту версию?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ai/prompts/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { rows?: PromptRow[]; error?: string } | null;
      await applyRows(data, res.ok, 'Версия удалена');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-muted">Загрузка шаблонов</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-h2 font-bold">Промты AI</h1>
          <p className="text-sm text-muted mt-1">Шаблоны с версионированием: активна всегда одна версия</p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/ai/settings" className="btn-ghost">Настройки</Link>
          <Link href="/admin/ai/prompts" className="btn-secondary">Промты</Link>
          <Link href="/admin/ai/usage" className="btn-ghost">Статистика</Link>
          <Link href="/admin/ai/logs" className="btn-ghost">Логи</Link>
        </nav>
      </div>

      {error ? <p className="text-sm text-danger mb-4">{error}</p> : null}
      {note ? <p className="text-sm text-muted mb-4">{note}</p> : null}

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="card p-3 h-fit">
          <p className="label">Ключи шаблонов</p>
          <div className="flex flex-col gap-1">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectKey(key)}
                className={
                  key === activeKey
                    ? 'text-left px-2.5 py-1.5 rounded-md text-sm bg-primary-soft text-primary font-mono'
                    : 'text-left px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150 font-mono'
                }
              >
                {key}
              </button>
            ))}
            {!keys.length ? <p className="text-xs text-muted px-1">Нет шаблонов</p> : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display font-semibold">{activeKey}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {activeRow ? `Активная версия v${activeRow.version}` : 'Активной версии нет, будет использован дефолт'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !template.trim()}
                  onClick={() => void saveNewVersion()}
                >
                  Сохранить как новую версию
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void resetDefault()}
                >
                  <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
                  Сбросить к дефолту
                </button>
              </div>
            </div>
            <textarea
              className="input min-h-[280px] resize-y font-mono text-[13px] leading-relaxed"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              spellCheck={false}
              aria-label={`Шаблон ${activeKey}`}
            />
            <p className="text-xs text-muted mt-2">
              Плейсхолдеры вида {'{content}'} подставляются на сервере. Правка сохраняется новой
              версией, прежние остаются в истории.
            </p>
          </div>

          <div className="card p-5">
            <h2 className="font-display font-semibold mb-3">История версий: {activeKey}</h2>
            {keyRows.length ? (
              <ul>
                {keyRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-t border-line first:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="badge font-mono">v{row.version}</span>
                      <span className="text-sm text-muted">{formatDate(row.createdAt)}</span>
                      {row.isActive ? (
                        <span className="badge !border-primary/50 !text-primary">Активна</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {!row.isActive ? (
                        <button
                          type="button"
                          className="btn-secondary !py-1 !px-2.5 text-xs"
                          disabled={busy}
                          onClick={() => void restore(row.id)}
                        >
                          Активировать
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost !py-1 !px-2.5 text-xs"
                        disabled={busy}
                        onClick={() => void remove(row.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Версий пока нет.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
