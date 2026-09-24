'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type RequestStatus = 'pending' | 'in_progress' | 'done' | 'rejected';

interface RequestRow {
  id: string;
  topic: string;
  name: string;
  email: string;
  status: RequestStatus;
  createdAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  _count?: { articles: number };
}

const statusView: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: 'Ожидает', cls: 'border-line text-muted bg-surface' },
  in_progress: { label: 'В работе', cls: 'border-primary/40 text-primary bg-primary/8' },
  done: { label: 'Выполнена', cls: 'border-ok/40 text-ok bg-ok/10' },
  rejected: { label: 'Отклонена', cls: 'border-accent/40 text-accent bg-accent/10' },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/requests?${params.toString()}`);
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { requests: RequestRow[] };
      setRows(data.requests);
      setError(null);
    } catch {
      setError('Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      r.topic.toLowerCase().includes(needle) ||
      r.name.toLowerCase().includes(needle) ||
      r.email.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <header>
        <h1 className="font-display text-h2 font-bold">Заявки</h1>
        <p className="text-sm text-muted mt-1">Запросы статей от читателей</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            className="input !pl-9"
            placeholder="Поиск по теме или автору"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="pending">Ожидают</option>
          <option value="in_progress">В работе</option>
          <option value="done">Выполнены</option>
          <option value="rejected">Отклонены</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th className="px-4 py-3 font-medium">Тема</th>
                <th className="px-4 py-3 font-medium">Заявитель</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Загрузка...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-danger">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Заявок нет
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const st = statusView[row.status];
                  return (
                    <tr key={row.id} className="border-b border-line/70 last:border-0 hover:bg-ink/[0.03] transition-colors duration-150">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/requests/${row.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {row.topic}
                        </Link>
                        {row._count && row._count.articles > 0 ? (
                          <span className="badge ml-2 align-middle">статей: {row._count.articles}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{row.name || 'аноним'}</td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">{row.email}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{shortDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', st.cls)}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
