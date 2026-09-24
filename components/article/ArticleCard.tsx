import Link from 'next/link';
import Image from 'next/image';
import { Clock, Eye } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export interface ArticleCardItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  status: string;
  views: number;
  readingTime: number;
  featured: boolean;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  author: { id: string; name: string };
  category: { slug: string; name: string; color: string } | null;
  tags: { tag: { slug: string; name: string } }[];
  _count?: { likes: number };
}

interface Props {
  article: ArticleCardItem;
  variant?: 'default' | 'compact' | 'wide';
  priority?: boolean;
  stretch?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') return null;
  return (
    <span className="badge !border-accent/40 !text-accent">
      {status === 'draft' ? 'Черновик' : 'В архиве'}
    </span>
  );
}

function CategoryBadge({ article }: { article: ArticleCardItem }) {
  if (!article.category) return null;
  return (
    <span className="badge">
      <span
        className="mr-1.5 h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: article.category.color }}
      />
      {article.category.name}
    </span>
  );
}

function Meta({ article, small }: { article: ArticleCardItem; small?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted',
        small && 'text-xs',
      )}
    >
      <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
      <span className="inline-flex items-center gap-1">
        <Eye size={13} />
        {article.views}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock size={13} />
        {article.readingTime} мин
      </span>
    </div>
  );
}

export function ArticleCard({ article, variant = 'default', priority = false, stretch = false }: Props) {
  if (variant === 'compact') {
    return (
      <Link
        href={`/article/${article.slug}`}
        className="card group flex flex-col gap-1.5 p-3.5 transition-colors duration-150 hover:border-ink/30"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge article={article} />
          <StatusBadge status={article.status} />
        </div>
        <h3 className="font-display text-base font-semibold leading-snug transition-colors duration-150 group-hover:text-primary">
          {article.title}
        </h3>
        <Meta article={article} small />
      </Link>
    );
  }

  if (variant === 'wide') {
    return (
      <Link
        href={`/article/${article.slug}`}
        className="card group flex gap-4 p-4 transition-colors duration-150 hover:border-ink/30"
      >
        {article.coverImage ? (
          <div className="hidden w-40 shrink-0 overflow-hidden rounded-sm bg-ink/5 sm:block">
            <Image
              src={article.coverImage}
              alt=""
              width={160}
              height={120}
              loading="lazy"
              sizes="160px"
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge article={article} />
            <StatusBadge status={article.status} />
          </div>
          <h3 className="font-display text-lg font-semibold leading-snug transition-colors duration-150 group-hover:text-primary">
            {article.title}
          </h3>
          {article.excerpt ? (
            <p className="line-clamp-2 text-caption text-muted">{article.excerpt}</p>
          ) : null}
          <div className="mt-auto pt-0.5">
            <Meta article={article} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/article/${article.slug}`}
      className="card group flex h-full flex-col overflow-hidden transition-colors duration-150 hover:border-ink/30"
    >
      {article.coverImage ? (
        <div
          className={cn(
            'relative overflow-hidden bg-ink/5',
            stretch ? 'min-h-[240px] flex-1' : 'aspect-[16/9]',
          )}
        >
          <Image
            src={article.coverImage}
            alt=""
            fill
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            sizes={
              stretch
                ? '(max-width: 1024px) 100vw, 60vw'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
            className="object-cover"
          />
        </div>
      ) : null}
      <div className={cn('flex flex-col gap-2 p-4', !stretch && 'flex-1')}>
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryBadge article={article} />
          <StatusBadge status={article.status} />
        </div>
        <h3
          className={cn(
            'font-display font-semibold leading-snug transition-colors duration-150 group-hover:text-primary',
            stretch ? 'text-h3' : 'text-lg',
          )}
        >
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className={cn('text-caption text-muted', stretch ? 'line-clamp-4' : 'line-clamp-2')}>
            {article.excerpt}
          </p>
        ) : null}
        <div className={cn('pt-1', !stretch && 'mt-auto')}>
          <Meta article={article} />
        </div>
      </div>
    </Link>
  );
}
