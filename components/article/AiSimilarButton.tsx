'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface SimilarArticle {
  id: string;
  slug: string;
  title: string;
  similarity: number;
}

export function AiSimilarButton({ articleId }: { articleId: string }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SimilarArticle[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/similar-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { articles?: SimilarArticle[]; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error ?? 'ai');
      setItems(data?.articles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось найти похожие статьи');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && !loading && !error) {
    return (
      <button type="button" className="btn-secondary !border-violet-300 !text-violet-700 hover:!bg-violet-50 !py-1.5 !px-2.5 text-sm" onClick={() => void load()}>
        <Sparkles size={15} />
        Найти с помощью ИИ
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary !border-violet-300 !text-violet-700 hover:!bg-violet-50 !py-1.5 !px-2.5 text-sm" onClick={() => void load()} disabled={loading}>
          <Sparkles size={15} />
          {loading ? 'Ищем…' : 'Обновить'}
        </button>
        {error ? <span className="text-caption text-danger">{error}</span> : null}
      </div>
      {items.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/article/${a.slug}`} className="card card-hoverable block p-3">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-sm font-bold">{a.title}</span>
                  <span className="mono-meta shrink-0">{a.similarity}%</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
