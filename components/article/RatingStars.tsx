'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  articleId: string;
  average: number;
  count: number;
  userValue: number | null;
  canRate: boolean;
}

export function RatingStars({ articleId, average, count, userValue, canRate }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(userValue);
  const [avg, setAvg] = useState(average);
  const [total, setTotal] = useState(count);
  const [busy, setBusy] = useState(false);

  async function rate(next: number) {
    if (!canRate || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      if (res.status === 401) {
        router.push(`/login?from=/article`);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { value: number; average: number; count: number };
      setValue(data.value);
      setAvg(data.average);
      setTotal(data.count);
    } finally {
      setBusy(false);
    }
  }

  const shown = Math.round(avg);

  return (
    <span
      className="inline-flex items-center gap-1"
      title={total > 0 ? `Средняя оценка ${avg.toFixed(1)} из 5 (${total})` : 'Оценок пока нет'}
    >
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Рейтинг ${avg.toFixed(1)} из 5`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= shown;
          if (!canRate) {
            return (
              <Star
                key={n}
                size={13}
                className={cn(active ? 'text-accent fill-current' : 'text-muted/50')}
              />
            );
          }
          return (
            <button
              key={n}
              type="button"
              onClick={() => void rate(n)}
              disabled={busy}
              aria-label={`Оценить на ${n}`}
              className="p-0.5 transition-colors duration-150 hover:text-accent"
            >
              <Star
                size={13}
                className={cn(
                  n <= (value ?? 0) || (value == null && active)
                    ? 'text-accent fill-current'
                    : 'text-muted/50',
                )}
              />
            </button>
          );
        })}
      </span>
      <span className="text-xs tabular-nums text-muted">
        {total > 0 ? avg.toFixed(1) : '—'}
      </span>
    </span>
  );
}
