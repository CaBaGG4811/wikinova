'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

interface Hit {
  slug: string;
  title: string;
  excerpt: string;
}

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`);
        if (!res.ok) return;
        const data = (await res.json()) as { items?: Hit[] };
        setHits(Array.isArray(data.items) ? data.items.slice(0, 6) : []);
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function openHit(slug: string) {
    setOpen(false);
    router.push(`/article/${slug}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit} role="search">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Найти статью: квантовая механика, Рим, алгоритмы"
          aria-label="Поиск статей"
          className="input !py-4 !pl-12 !pr-28 !text-lg shadow-lg focus:!ring-4 focus:!ring-primary/10"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2">
          Найти
        </button>
      </form>

      {open && hits.length > 0 ? (
        <ul className="card shadow-float absolute left-0 right-0 z-30 mt-1 overflow-hidden py-1">
          {hits.map((hit) => (
            <li key={hit.slug}>
              <button
                type="button"
                className="block w-full px-4 py-2.5 text-left transition-colors duration-150 hover:bg-ink/5"
                onClick={() => openHit(hit.slug)}
              >
                <span className="block text-sm font-medium text-ink">{hit.title}</span>
                {hit.excerpt ? (
                  <span className="mt-0.5 block line-clamp-1 text-caption text-muted">
                    {hit.excerpt}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
