'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type RangeKey = '24h' | '7d' | '30d';

interface Totals {
  requests: number;
  tokensIn: number;
  tokensOut: number;
  avgMs: number;
  errors: number;
}

interface ChartPoint {
  date: string;
  requests: number;
  tokensOut: number;
}

interface UsageRow {
  id: string;
  feature: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  status: string;
  errorMsg: string | null;
  createdAt: string;
}

interface UsageData {
  totals: Totals;
  chart: ChartPoint[];
  rows: UsageRow[];
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '24h', label: '24 часа' },
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
];

const FEATURES = [
  'summarize',
  'qa_article',
  'qa_global',
  'translate',
  'factcheck',
  'draft',
  'improve',
  'metadata',
  'test',
];

const PRIMARY = '#166534';

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

export default function AiUsagePage() {
  const [range, setRange] = useState<RangeKey>('24h');
  const [feature, setFeature] = useState('');
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (feature) params.set('feature', feature);
      const res = await fetch(`/api/admin/ai/usage?${params.toString()}`);
      const payload = (await res.json().catch(() => null)) as UsageData | { error?: string } | null;
      if (!res.ok || !payload || !('totals' in payload)) {
        setError((payload as { error?: string } | null)?.error ?? `Ошибка загрузки (${res.status})`);
        return;
      }
      setData(payload);
    } catch {
      setError('Не удалось загрузить статистику.');
    } finally {
      setLoading(false);
    }
  }, [range, feature]);

  useEffect(() => {
    void load();
  }, [load]);

  const csvHref = `/api/admin/ai/usage?format=csv&range=${range}${feature ? `&feature=${encodeURIComponent(feature)}` : ''}`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-h2 font-bold">Статистика AI</h1>
          <p className="text-sm text-muted mt-1">Запросы, токены и ошибки за период</p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/ai/settings" className="btn-ghost">Настройки</Link>
          <Link href="/admin/ai/prompts" className="btn-ghost">Промты</Link>
          <Link href="/admin/ai/usage" className="btn-secondary">Статистика</Link>
          <Link href="/admin/ai/logs" className="btn-ghost">Логи</Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={r.key === range ? 'btn-secondary !border-primary/60 !text-primary' : 'btn-ghost'}
          >
            {r.label}
          </button>
        ))}
        <select
          className="input !w-auto"
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          aria-label="Фильтр по функции"
        >
          <option value="">Все функции</option>
          {FEATURES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <a href={csvHref} className="btn-secondary ml-auto">
          Экспорт CSV
        </a>
      </div>

      {error ? <p className="text-sm text-danger mb-4">{error}</p> : null}

      {loading && !data ? (
        <p className="text-sm text-muted">Загрузка</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-muted">Запросов</p>
              <p className="font-display text-h3 font-bold mt-1">{formatNumber(data.totals.requests)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Токены (вход/выход)</p>
              <p className="font-display text-h3 font-bold mt-1 font-mono text-base">
                {formatNumber(data.totals.tokensIn)} / {formatNumber(data.totals.tokensOut)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Среднее время</p>
              <p className="font-display text-h3 font-bold mt-1">{formatNumber(data.totals.avgMs)} ms</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted">Ошибки</p>
              <p className="font-display text-h3 font-bold mt-1">
                <span className={data.totals.errors ? 'text-danger' : undefined}>
                  {formatNumber(data.totals.errors)}
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <div className="card p-4">
              <h2 className="text-sm font-medium text-muted mb-3 font-display">Запросы</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <defs>
                      <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#57534E' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#57534E' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E5E4', fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      name="Запросы"
                      stroke={PRIMARY}
                      strokeWidth={2}
                      fill="url(#fillRequests)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-sm font-medium text-muted mb-3 font-display">Токены на выходе</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chart} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#57534E' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#57534E' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E7E5E4', fontSize: 12 }} />
                    <Bar dataKey="tokensOut" name="Токены" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Функция</th>
                  <th className="px-4 py-2.5 font-medium">Модель</th>
                  <th className="px-4 py-2.5 font-medium">Токены</th>
                  <th className="px-4 py-2.5 font-medium">ms</th>
                  <th className="px-4 py-2.5 font-medium">Статус</th>
                  <th className="px-4 py-2.5 font-medium">Время</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{row.feature}</td>
                    <td className="px-4 py-2 font-mono text-xs max-w-[180px] truncate">{row.model}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {row.tokensIn}/{row.tokensOut}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.durationMs}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          row.status === 'error'
                            ? 'badge !border-danger/40 !text-danger'
                            : 'badge !border-ok/40 !text-ok'
                        }
                      >
                        {row.status === 'error' ? 'ошибка' : 'ок'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                      {formatTime(row.createdAt)}
                    </td>
                  </tr>
                ))}
                {!data.rows.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                      За выбранный период запросов нет
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
