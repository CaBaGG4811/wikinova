import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  pages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}

export function Pagination({ page, pages, basePath, params = {} }: Props) {
  if (pages <= 1) return null;

  function href(p: number): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) sp.set(key, value);
    }
    if (p > 1) sp.set('page', String(p));
    else sp.delete('page');
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= pages;

  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Пагинация">
      {prevDisabled ? (
        <span className="btn-secondary pointer-events-none opacity-40">
          <ChevronLeft size={15} />
          Назад
        </span>
      ) : (
        <Link href={href(page - 1)} className="btn-secondary">
          <ChevronLeft size={15} />
          Назад
        </Link>
      )}
      <span className="text-caption text-muted tabular-nums">
        {page} / {pages}
      </span>
      {nextDisabled ? (
        <span className="btn-secondary pointer-events-none opacity-40">
          Далее
          <ChevronRight size={15} />
        </span>
      ) : (
        <Link href={href(page + 1)} className="btn-secondary">
          Далее
          <ChevronRight size={15} />
        </Link>
      )}
    </nav>
  );
}
