import { ArticleCard, type ArticleCardItem } from '@/components/article/ArticleCard';
import { cn } from '@/lib/utils';

interface Props {
  items: ArticleCardItem[];
  view?: 'grid' | 'list';
  stagger?: boolean;
  emptyText?: string;
}

export function ArticleGrid({ items, view = 'grid', stagger = false, emptyText = 'Ничего не найдено' }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line py-10 text-center text-caption text-muted">
        {emptyText}
      </p>
    );
  }

  const delay = (i: number) => (stagger ? { animationDelay: `${i * 60}ms` } : undefined);

  if (view === 'list') {
    return (
      <div className="flex flex-col gap-4">
        {items.map((a, i) => (
          <div key={a.id} className={cn(stagger && 'stagger-item')} style={delay(i)}>
            <ArticleCard article={a} variant="wide" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a, i) => (
        <div key={a.id} className={cn(stagger && 'stagger-item')} style={delay(i)}>
          <ArticleCard article={a} />
        </div>
      ))}
    </div>
  );
}
