'use client';

import { useEffect, useState } from 'react';
import { Flag, X } from 'lucide-react';

interface Props {
  articleTitle: string;
}

export function ReportErrorButton({ articleTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit() {
    if (state === 'sending') return;
    if (!text.trim() || !email.trim()) {
      setState('error');
      setError('Заполните описание ошибки и email');
      return;
    }
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `Ошибка в статье: ${articleTitle}`,
          description: text.trim(),
          category: '',
          level: 'standard',
          email: email.trim(),
          name: '',
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setState('error');
        setError(data?.error ?? 'Не удалось отправить сообщение');
        return;
      }
      setState('ok');
    } catch {
      setState('error');
      setError('Сеть недоступна, попробуйте позже');
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost !py-1.5 !px-2.5 text-sm" onClick={() => setOpen(true)}>
        <Flag size={15} />
        Сообщить об ошибке
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Сообщить об ошибке">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-ink/40"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 card shadow-float w-full max-w-md rounded-xl p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">Сообщить об ошибке</h2>
                <p className="text-xs text-muted mt-0.5">
                  Опишите проблему: неверный факт, опечатка, битая ссылка.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost w-9 h-9 !p-0 shrink-0"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {state === 'ok' ? (
              <div className="space-y-3">
                <p className="text-sm text-ink">Сообщение принято. Редакция посмотрит его в заявках.</p>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Закрыть
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Что не так</span>
                  <textarea
                    className="input min-h-[7rem] resize-y"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Например: во втором разделе неверная дата события"
                  />
                </label>
                <label className="block">
                  <span className="label">Ваш email</span>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void submit()}
                    disabled={state === 'sending'}
                  >
                    {state === 'sending' ? 'Отправляем' : 'Отправить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
