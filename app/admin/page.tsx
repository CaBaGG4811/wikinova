'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Eye,
  FileText,
  Inbox,
  Users,
  Image as ImageIcon,
  Heart,
} from 'lucide-react';

interface Stats {
  articles: { total: number; published: number; draft: number };
  requests: { pending: number; in_progress: number; done: number; rejected: number };
  users: number;
  media: number;
  likes: number;
  viewsTotal: number;
  chart: { date: string; count: number }[];
  recent: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    user: { name: string; email: string } | null;
  }[];
}

const actionLabels: Record<string, string> = {
  create: 'Создано',
  update: 'Обновлено',
  delete: 'Удалено',
  restore: 'Восстановлено',
  login: 'Вход',
  seed: 'Инициализация',
  publish: 'Опубликовано',
  update_block: 'Обновлён блок',
};

const entityLabels: Record<string, string> = {
  article: 'Статья',
  category: 'Категория',
  tag: 'Тег',
  request: 'Заявка',
  user: 'Пользователь',
  media: 'Файл',
  settings: 'Настройки',
  version: 'Версия',
  system: 'Система',
  SiteBlock: 'Текстовый блок',
};

function numberFmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

function timeFmt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (!res.ok) throw new Error('Ошибка загрузки статистики');
        const data = (await res.json()) as Stats;
        if (alive) setStats(data);
      })
      .catch(() => {
        if (alive) setError('Не удалось загрузить статистику');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (!stats) {
    return <p className="text-sm text-muted">Загрузка...</p>;
  }

  const chartData = stats.chart.map((c) => ({
    ...c,
    label: new Date(c.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <div className="space-y-8 max-w-6xl">
      <header>
        <h1 className="font-display text-h2 font-bold">Дашборд</h1>
        <p className="text-sm text-muted mt-1">Состояние вики на сегодня</p>
      </header>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 rounded-lg border border-line bg-surface p-5 flex items-end justify-between gap-4">
          <div>
            <div className="text-caption text-muted">Просмотры статей</div>
            <div className="font-display text-[2.75rem] leading-none font-bold mt-2 tabular-nums">
              {numberFmt(stats.viewsTotal)}
            </div>
            <div className="text-xs text-muted mt-2">
              всего с момента запуска
            </div>
          </div>
          <Eye size={40} className="text-primary/50 shrink-0" />
        </div>

        <div className="col-span-12 sm:col-span-6 md:col-span-3 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">Статьи</span>
            <FileText size={18} className="text-primary/70" />
          </div>
          <div className="font-display text-3xl font-bold mt-3 tabular-nums">
            {numberFmt(stats.articles.total)}
          </div>
          <div className="text-xs text-muted mt-2">
            {numberFmt(stats.articles.published)} опубликовано, {numberFmt(stats.articles.draft)} черновиков
          </div>
        </div>

        <div className="col-span-12 sm:col-span-6 md:col-span-3 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">Заявки в работе</span>
            <Inbox size={18} className="text-accent/70" />
          </div>
          <div className="font-display text-3xl font-bold mt-3 tabular-nums">
            {numberFmt(stats.requests.pending + stats.requests.in_progress)}
          </div>
          <div className="text-xs text-muted mt-2">
            {stats.requests.pending} ждут ответа, {stats.requests.done} выполнено
          </div>
        </div>

        <div className="col-span-12 sm:col-span-4 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">Пользователи</span>
            <Users size={18} className="text-muted" />
          </div>
          <div className="font-display text-2xl font-bold mt-3 tabular-nums">
            {numberFmt(stats.users)}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-4 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">Медиафайлы</span>
            <ImageIcon size={18} className="text-muted" />
          </div>
          <div className="font-display text-2xl font-bold mt-3 tabular-nums">
            {numberFmt(stats.media)}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-4 rounded-lg border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-muted">Отметки нравится</span>
            <Heart size={18} className="text-muted" />
          </div>
          <div className="font-display text-2xl font-bold mt-3 tabular-nums">
            {numberFmt(stats.likes)}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="font-display text-h3 font-semibold">Публикации за 30 дней</h2>
          <span className="text-xs text-muted">
            всего {numberFmt(stats.chart.reduce((s, c) => s + c.count, 0))}
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }}
                tickLine={false}
                axisLine={{ stroke: 'rgb(var(--c-line))' }}
                interval={2}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'rgb(var(--c-muted))' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgb(var(--c-surface))',
                  border: '1px solid rgb(var(--c-line))',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'rgb(var(--c-ink))',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#166534"
                strokeWidth={2}
                fill="#166534"
                fillOpacity={0.12}
                name="Публикаций"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface overflow-hidden">
        <h2 className="font-display text-h3 font-semibold px-5 pt-5 pb-3">
          Последние действия
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th className="px-5 py-2.5 font-medium">Когда</th>
                <th className="px-5 py-2.5 font-medium">Действие</th>
                <th className="px-5 py-2.5 font-medium">Объект</th>
                <th className="px-5 py-2.5 font-medium">Кто</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-muted">
                    Пока нет записей
                  </td>
                </tr>
              ) : (
                stats.recent.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted">
                      {timeFmt(row.createdAt)}
                    </td>
                    <td className="px-5 py-2.5">{actionLabels[row.action] ?? row.action}</td>
                    <td className="px-5 py-2.5 text-muted">
                      {entityLabels[row.entity] ?? row.entity}
                    </td>
                    <td className="px-5 py-2.5">{row.user?.name ?? 'система'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
