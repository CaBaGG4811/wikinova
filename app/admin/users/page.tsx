'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trash2, Ban, Check } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';

interface UserRow {
  id: string;
  name: string;
  role: string;
  blocked: boolean;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  USER: 'Читатель',
  EDITOR: 'Редактор',
  ADMIN: 'Администратор',
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { users: UserRow[] };
      setRows(data.users);
    } catch {
      toast('Не удалось загрузить пользователей', 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/admin/login?from=/admin/users');
      return;
    }
    if (status === 'authenticated' && session?.user.role !== 'ADMIN') {
      router.replace('/admin');
      return;
    }
    if (status === 'authenticated' && session.user.role === 'ADMIN') {
      load();
    }
  }, [status, session, router, load]);

  if (status === 'loading' || (status === 'authenticated' && session?.user.role !== 'ADMIN')) {
    return <p className="text-sm text-muted">Загрузка...</p>;
  }

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'fail');
      }
      toast('Обновлено');
      load();
    } catch (err) {
      toast(err instanceof Error && err.message !== 'fail' ? err.message : 'Не удалось обновить пользователя', 'err');
    }
  }

  async function remove(user: UserRow) {
    if (!window.confirm(`Удалить пользователя ${user.name}?`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'fail');
      }
      toast('Пользователь удалён');
      load();
    } catch (err) {
      toast(err instanceof Error && err.message !== 'fail' ? err.message : 'Не удалось удалить пользователя', 'err');
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <header>
        <h1 className="font-display text-h2 font-bold">Пользователи</h1>
        <p className="text-sm text-muted mt-1">Роли и доступ к панели</p>
      </header>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-caption text-muted">
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Доступ</th>
                <th className="px-4 py-3 font-medium">Регистрация</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Загрузка...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Пользователей нет
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSelf = row.id === session?.user.id;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-line/70 last:border-0',
                        row.blocked && 'opacity-70',
                      )}
                    >
                      <td className="px-4 py-3 font-medium">
                        {row.name}
                        {isSelf ? <span className="badge ml-2">вы</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input !w-auto !py-1 text-xs"
                          value={row.role}
                          disabled={isSelf}
                          onChange={(e) => {
                            if (
                              window.confirm(
                                `Сменить роль ${row.name} на «${roleLabels[e.target.value]}»?`,
                              )
                            ) {
                              patch(row.id, { role: e.target.value });
                            }
                          }}
                        >
                          <option value="USER">{roleLabels.USER}</option>
                          <option value="EDITOR">{roleLabels.EDITOR}</option>
                          <option value="ADMIN">{roleLabels.ADMIN}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className={cn('badge', row.blocked ? 'border-danger/50 text-danger' : 'border-ok/40 text-ok')}
                          disabled={isSelf}
                          onClick={() => {
                            const next = !row.blocked;
                            const action = next ? 'заблокировать' : 'разблокировать';
                            if (window.confirm(`${action === 'заблокировать' ? 'Заблокировать' : 'Разблокировать'} ${row.name}?`)) {
                              patch(row.id, { blocked: next });
                            }
                          }}
                        >
                          {row.blocked ? <Ban size={12} className="mr-1" /> : <Check size={12} className="mr-1" />}
                          {row.blocked ? 'Заблокирован' : 'Активен'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn-ghost !px-2 !py-1.5 hover:text-danger"
                          disabled={isSelf}
                          title={isSelf ? 'Нельзя удалить себя' : 'Удалить'}
                          onClick={() => remove(row)}
                        >
                          <Trash2 size={15} />
                        </button>
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
