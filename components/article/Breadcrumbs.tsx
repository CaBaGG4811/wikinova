import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="mb-6 flex flex-wrap items-center gap-1.5 text-caption text-muted">
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 ? <ChevronRight size={12} className="shrink-0 text-muted/60" /> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors duration-150 hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
