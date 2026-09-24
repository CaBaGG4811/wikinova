'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/types';
import { cn } from '@/lib/utils';

export function ArticleToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    if (items.length === 0) return;
    const visible = new Set<string>();
    const headings = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        for (const it of items) {
          if (visible.has(it.id)) {
            setActive(it.id);
            return;
          }
        }
      },
      { rootMargin: '-72px 0px -60% 0px', threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-20 border-l border-line py-1 pl-4" aria-label="Содержание статьи">
        <p className="font-display mb-2 text-caption font-medium text-muted">Содержание</p>
        <ul className="space-y-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={cn(
                  'block py-1 text-caption transition-colors duration-150',
                  it.level === 3 && 'pl-4',
                  active === it.id
                    ? 'font-medium text-primary'
                    : 'text-muted hover:text-ink',
                )}
              >
                {it.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
