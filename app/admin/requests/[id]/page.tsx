'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trash2, PenLine, Loader2, Paperclip, ExternalLink } from 'lucide-react';
import { cn, slugify, formatDate } from '@/lib/utils';
import { useToast } from '@/components/admin/ToastProvider';

type RequestStatus = 'pending' | 'in_progress' | 'done' | 'rejected';

interface RequestDetail {
  id: string;
  topic: string;
  description: string;
  category: string;
  level: string;
  email: string;
  name: string;
  status: RequestStatus;
  adminComment: string;
  attachmentUrl: string | null;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  articles: { id: string; title: string; slug: string; status: string }[];
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const AI_DOWN = 'Локальная модель недоступна. Проверьте Base URL в настройках AI.';

const statusLabels: Record<RequestStatus, string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
};

const statusCls: Record<RequestStatus, string> = {
  pending: 'border-line text-muted bg-surface',
  in_progress: 'border-primary/40 text-primary bg-primary/8',
  done: 'border-ok/40 text-ok bg-ok/10',
  rejected: 'border-accent/40 text-accent bg-accent/10',
};

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<RequestStatus>('pending');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/requests/${params.id}`);
      if (!res.ok) throw new Error('fail');
      const data = (await res.json()) as { request: RequestDetail };
      setRequest(data.request);
      setComment(data.request.adminComment);
      setStatus(data.request.status);
      setAssignedToId(data.request.assignedToId ?? '');
      setError(null);
    } catch {
      setError('Заявка не найдена или недоступна');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d: { users?: UserOption[] }) =>
        setUsers((d.users ?? []).filter((u) => u.role === 'EDITOR' || u.role === 'ADMIN')),
      )
      .catch(() => undefined);
  }, []);

  async function saveChanges() {
    if (!request) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          adminComment: comment,
          assignedToId: assignedToId || null,
        }),
      });
      if (!res.ok) throw new Error('fail');
      toast('Заявка обновлена');
      load();
    } catch {
      toast('Не удалось обновить заявку', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    if (!request) return;
    setDraftBusy(true);
    try {
      const draftRes = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: request.topic,
          points: request.description || undefined,
          level: request.level,
        }),
      });
      if (!draftRes.ok) throw new Error('ai');
      const draft = (await draftRes.json().catch(() => null)) as {
        title?: string;
        content?: string;
      } | null;
      if (!draft?.title || !draft.content) throw new Error('ai');

      const createRes = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          slug: `${slugify(draft.title)}-${Date.now().toString(36).slice(-4)}`,
          excerpt: '',
          content: draft.content,
          coverImage: null,
          status: 'draft',
          featured: false,
          categoryId: null,
          tagIds: [],
          seoTitle: draft.title,
          seoDescription: '',
          ogImage: null,
          requestId: request.id,
        }),
      });
      const created = (await createRes.json().catch(() => null)) as {
        article?: { id: string };
        error?: string;
      } | null;
      if (!createRes.ok || !created?.article) {
        throw new Error(created?.error ?? 'create-fail');
      }
      setCreatedId(created.article.id);
      toast('Статья-черновик создана');
      load();
    } catch (err) {
      if ((err as Error).message === 'ai') toast(AI_DOWN, 'err');
      else toast((err as Error).message || 'Не удалось создать черновик', 'err');
    } finally {
      setDraftBusy(false);
    }
  }

  async function removeRequest() {
    if (!request) return;
    if (!window.confirm(`Удалить заявку «${request.topic}»?`)) return;
    try {
      const res = await fetch(`/api/admin/requests/${request.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('fail');
      toast('Заявка удалена');
      router.push('/admin/requests');
    } catch {
      toast('Не удалось удалить заявку', 'err');
    }
  }

  if (loading) return <p className="text-sm text-muted">Загрузка...</p>;
  if (error || !request) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">{error ?? 'Заявка не найдена'}</p>
        <Link href="/admin/requests" className="btn-secondary">
          К списку заявок
        </Link>
      </div>
    );
  }

  const isAdmin = session?.user.role === 'ADMIN';
  const articleFromRequest = createdId
    ? request.articles.find((a) => a.id === createdId) ?? request.articles[0]
    : request.articles[0];

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/requests" className="text-sm text-muted hover:text-ink">
            К списку заявок
          </Link>
          <h1 className="font-display text-h2 font-bold mt-1">{request.topic}</h1>
          <p className="text-sm text-muted mt-1">
            {request.name || 'аноним'} · {request.email} · {formatDate(request.createdAt)}
          </p>
        </div>
        <span className={cn('badge', statusCls[request.status])}>
          {statusLabels[request.status]}
        </span>
      </header>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-display font-semibold mb-2">Описание</h2>
          <p className="text-sm whitespace-pre-wrap text-ink">
            {request.description || 'Без описания'}
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted">
            {request.category ? <span className="badge">Категория: {request.category}</span> : null}
            <span className="badge">Уровень: {request.level}</span>
          </div>
        </div>

        {request.attachmentUrl ? (
          <a
            href={request.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-accent"
          >
            <Paperclip size={15} />
            Вложение
            <ExternalLink size={13} />
          </a>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Статус</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as RequestStatus)}
            >
              {(Object.keys(statusLabels) as RequestStatus[]).map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Назначить редактора</label>
            <select
              className="input"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            >
              <option value="">Не назначен</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Комментарий редакции</label>
          <textarea
            className="input min-h-[96px] resize-y"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Виден команде, читателю не показывается"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={saveChanges} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={generateDraft}
            disabled={draftBusy}
          >
            {draftBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <PenLine size={16} />
            )}
            Сгенерировать черновик по заявке
          </button>
          {isAdmin ? (
            <button type="button" className="btn-danger ml-auto" onClick={removeRequest}>
              <Trash2 size={16} />
              Удалить
            </button>
          ) : null}
        </div>

        {articleFromRequest ? (
          <div className="rounded-sm border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              Создана статья:{' '}
              <Link
                href={`/admin/articles/${articleFromRequest.id}/edit`}
                className="font-medium text-primary hover:text-accent"
              >
                {articleFromRequest.title}
              </Link>
            </span>
            <span className="badge">черновик</span>
          </div>
        ) : null}
      </section>

      {request.articles.length > 1 || (createdId && request.articles.length > 0) ? (
        <section className="card p-5">
          <h2 className="font-display font-semibold mb-3">Статьи по заявке</h2>
          <ul className="space-y-2">
            {request.articles.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/admin/articles/${a.id}/edit`} className="hover:text-primary">
                  {a.title}
                </Link>
                <span className="badge">{a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
