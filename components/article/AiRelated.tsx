'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RagSource } from '@/types';

export function AiRelated({ articleId }: { articleId: string }) {
  const [sources, setSources] = useState<RagSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('similar failed');
        return res.json() as Promise<{ sources?: RagSource[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.sources) ? data.sources : [];
        if (list.length > 0) setSources(list);
      })
      .catch(() => {
        // при ошибке блок просто не показывается
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (sources.length === 0) return null;

  return (
    <section className="mt-10 max-w-[68ch]">
      <h2 className="font-display mb-4 text-h3 font-semibold">Связанные</h2>
      <ul className="flex flex-col gap-2">
        {sources.map((s) => (
          <li key={s.id}>
            <Link
              href={`/article/${s.slug}`}
              className="card block p-3.5 transition-colors duration-150 hover:border-ink/30"
            >
              <span className="font-display block text-sm font-semibold">{s.title}</span>
              {s.excerpt ? (
                <span className="mt-1 block line-clamp-2 text-caption text-muted">{s.excerpt}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
