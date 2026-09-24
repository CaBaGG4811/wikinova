'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  categories: { slug: string; name: string }[];
}

const LEVELS = [
  { value: 'brief', label: 'Кратко', hint: 'Одна статья-обзор без глубокой детализации' },
  { value: 'standard', label: 'Стандарт', hint: 'Обычный формат энциклопедической статьи' },
  { value: 'detailed', label: 'Подробно', hint: 'Развёрнутый материал с разделами и примерами' },
] as const;

interface FormState {
  topic: string;
  description: string;
  category: string;
  level: string;
  email: string;
  name: string;
  attachmentUrl: string;
}

const INITIAL: FormState = {
  topic: '',
  description: '',
  category: '',
  level: 'standard',
  email: '',
  name: '',
  attachmentUrl: '',
};

export function RequestForm({ categories }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  function upd<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: form.topic.trim(),
          description: form.description.trim(),
          category: form.category,
          level: form.level,
          email: form.email.trim(),
          name: form.name.trim(),
          attachmentUrl: form.attachmentUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setState('error');
        setError(data?.error ?? 'Не удалось отправить заявку');
        return;
      }
      setState('ok');
    } catch {
      setState('error');
      setError('Сеть недоступна, попробуйте позже');
    }
  }

  if (state === 'ok') {
    return (
      <div className="card p-6">
        <h2 className="font-display text-h3 font-semibold">Заявка отправлена</h2>
        <p className="mt-2 text-body text-muted">
          Редакция получила тему и свяжется по указанному email, когда материал возьмёт в работу.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/articles" className="btn-secondary">
            Перейти к статьям
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setForm(INITIAL);
              setState('idle');
            }}
          >
            Отправить ещё одну
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="card p-6 space-y-5">
      <label className="block">
        <span className="label">Тема статьи</span>
        <input
          className="input"
          value={form.topic}
          onChange={(e) => upd('topic', e.target.value)}
          required
          minLength={3}
          maxLength={200}
          placeholder="Например: история периодической таблицы"
        />
      </label>

      <label className="block">
        <span className="label">Описание</span>
        <textarea
          className="input min-h-[8rem] resize-y"
          value={form.description}
          onChange={(e) => upd('description', e.target.value)}
          maxLength={4000}
          placeholder="Что важно раскрыть, какие разделы нужны, есть ли источники"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Категория</span>
          <select
            className="input"
            value={form.category}
            onChange={(e) => upd('category', e.target.value)}
          >
            <option value="">Без категории</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Ваше имя</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => upd('name', e.target.value)}
            maxLength={100}
            placeholder="Как подписать заявку"
          />
        </label>
      </div>

      <fieldset>
        <legend className="label">Уровень детализации</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVELS.map((level) => (
            <label
              key={level.value}
              className={cn(
                'card cursor-pointer p-3 transition-colors duration-150',
                form.level === level.value && 'border-primary',
              )}
            >
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name="level"
                  value={level.value}
                  checked={form.level === level.value}
                  onChange={() => upd('level', level.value)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{level.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{level.hint}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Email для связи</span>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => upd('email', e.target.value)}
            required
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="label">Вложение (ссылка, необязательно)</span>
          <input
            type="url"
            className="input"
            value={form.attachmentUrl}
            onChange={(e) => upd('attachmentUrl', e.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-caption text-muted">Заявка попадает в очередь редакции со статусом «новая».</p>
        <button type="submit" className="btn-primary" disabled={state === 'sending'}>
          {state === 'sending' ? 'Отправляем' : 'Отправить заявку'}
        </button>
      </div>
    </form>
  );
}
