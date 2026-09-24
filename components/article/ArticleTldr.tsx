'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';

export function ArticleTldr({ articleId, initial }: { articleId: string; initial?: string | null }) {
  const [summary, setSummary] = useState<string | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(refresh = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, refresh }),
      });
      const data = (await res.json().catch(() => null)) as { summary?: string; error?: string } | null;
      if (!res.ok || !data?.summary) throw new Error(data?.error ?? 'ai');
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось получить краткое содержание');
    } finally {
      setLoading(false);
    }
  }

  if (!summary && !loading && !error) {
    return (
      <button type="button" className="btn-secondary !py-1.5 !px-2.5 text-sm mb-6" onClick={() => void load()}>
        <Zap size={15} />
        Краткое содержание
      </button>
    );
  }

  return (
    <aside className="mb-8 rounded-lg border border-primary/35 bg-primary-soft/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-primary">
          <Zap size={15} />
          Краткое содержание
        </span>
        <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => void load(true)} disabled={loading}>
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>
      {error ? <p className="text-caption text-danger">{error}</p> : null}
      <p className="text-body leading-relaxed text-ink">{summary ?? '…'}</p>
    </aside>
  );
}
