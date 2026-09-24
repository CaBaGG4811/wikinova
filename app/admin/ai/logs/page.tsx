'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

interface UsageLogRow {
  id: string;
  userId: string | null;
  feature: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  status: string;
  errorMsg: string | null;
  articleId: string | null;
  createdAt: string;
}

interface LogsData {
  errors: UsageLogRow[];
  rows: UsageLogRow[];
  logEnabled: boolean;
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AiLogsPage() {
  const [data, setData] = useState<LogsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/logs?limit=100');
      const payload = (await res.json().catch(() => null)) as LogsData | { error?: string } | null;
      if (!res.ok || !payload || !('rows' in payload)) {
        setError((payload as { error?: string } | null)?.error ?? `Ошибка загрузки (${res.status})`);
        return;
      }
      setData(payload);
    } catch {
      setError('Не удалось загрузить логи.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLogs(enabled: boolean) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/admin/ai/logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const payload = (await res.json().catch(() => null)) as { logEnabled?: boolean; error?: string } | null;
      if (!res.ok || !payload || typeof payload.logEnabled !== 'boolean') {
        setNote(payload?.error ?? 'Не удалось изменить настройку.');
        return;
      }
      setData((prev) => (prev ? { ...prev, logEnabled: payload.logEnabled as boolean } : prev));
      setNote(payload.logEnabled ? 'Логирование включено' : 'Логирование выключено');
    } finally {
      setBusy(false);
    }
  }

  async function clearOld() {
    if (!window.confirm('Удалить логи старше 30 дней?')) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/admin/ai/logs/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const payload = (await res.json().catch(() => null)) as { deleted?: number; error?: string } | null;
      if (!res.ok || !payload || typeof payload.deleted !== 'number') {
        setNote(payload?.error ?? 'Не удалось очистить логи.');
        return;
      }
      setNote(`Удалено записей: ${payload.deleted}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-h2 font-bold">Логи AI</h1>
          <p className="text-sm text-muted mt-1">
            Сырые записи обращений. Ротация 30 дней, тексты промтов и ответов не сохраняются.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/ai/settings" className="btn-ghost">Настройки</Link>
          <Link href="/admin/ai/prompts" className="btn-ghost">Промты</Link>
          <Link href="/admin/ai/usage" className="btn-ghost">Статистика</Link>
          <Link href="/admin/ai/logs" className="btn-secondary">Логи</Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={data?.logEnabled ?? false}
            disabled={busy || !data}
            onChange={(e) => void toggleLogs(e.target.checked)}
          />
          Вести логи
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={14} />
          Обновить
        </button>
        <button type="button" className="btn-secondary" onClick={() => void clearOld()} disabled={busy}>
          Очистить старые (30 дней)
        </button>
        {note ? <span className="text-sm text-muted">{note}</span> : null}
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>

      {data ? (
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-display font-semibold text-sm">Ошибки</h2>
              <p className="text-xs text-muted mt-0.5">Последние записи со статусом error</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Время</th>
                  <th className="px-4 py-2.5 font-medium">Функция</th>
                  <th className="px-4 py-2.5 font-medium">Модель</th>
                  <th className="px-4 py-2.5 font-medium">ms</th>
                  <th className="px-4 py-2.5 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((row) => (
                  <tr key={`e-${row.id}`} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">{formatTime(row.createdAt)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.feature}</td>
                    <td className="px-4 py-2 font-mono text-xs max-w-[160px] truncate">{row.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">{row.durationMs}</td>
                    <td className="px-4 py-2 text-xs text-danger">{row.errorMsg ?? ''}</td>
                  </tr>
                ))}
                {!data.errors.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                      Ошибок нет
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="card overflow-x-auto">
            <div className="px-4 py-3 border-b border-line">
              <h2 className="font-display font-semibold text-sm">Все записи</h2>
              <p className="text-xs text-muted mt-0.5">Последние 100 обращений</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Время</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Функция</th>
                  <th className="px-4 py-2.5 font-medium">Модель</th>
                  <th className="px-4 py-2.5 font-medium">Токены</th>
                  <th className="px-4 py-2.5 font-medium">ms</th>
                  <th className="px-4 py-2.5 font-medium">Пользователь</th>
                  <th className="px-4 py-2.5 font-medium">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">{formatTime(row.createdAt)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          row.status === 'error'
                            ? 'badge !border-danger/40 !text-danger'
                            : 'badge !border-ok/40 !text-ok'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.feature}</td>
                    <td className="px-4 py-2 font-mono text-xs max-w-[150px] truncate">{row.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.tokensIn}/{row.tokensOut}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.durationMs}</td>
                    <td className="px-4 py-2 font-mono text-xs max-w-[130px] truncate">
                      {row.userId ?? 'гость'}
                    </td>
                    <td className="px-4 py-2 text-xs text-danger max-w-[220px] truncate">
                      {row.errorMsg ?? ''}
                    </td>
                  </tr>
                ))}
                {!data.rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted">
                      Записей нет
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}
