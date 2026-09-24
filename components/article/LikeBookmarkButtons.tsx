'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  articleId: string;
  likeCount: number;
  initialLiked: boolean;
  initialBookmarked: boolean;
}

export function LikeBookmarkButtons({
  articleId,
  likeCount,
  initialLiked,
  initialBookmarked,
}: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likes, setLikes] = useState(likeCount);
  const [busy, setBusy] = useState(false);

  async function toggle(kind: 'like' | 'bookmark') {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/${kind}`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { liked?: boolean; bookmarked?: boolean; count?: number };
      if (kind === 'like') {
        setLiked(Boolean(data.liked));
        if (typeof data.count === 'number') setLikes(data.count);
      } else {
        setBookmarked(Boolean(data.bookmarked));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void toggle('like')}
        disabled={busy}
        aria-pressed={liked}
        className={cn('btn-ghost !py-1.5 !px-2.5 text-sm', liked && 'text-accent')}
      >
        <Heart size={15} className={cn(liked && 'fill-current')} />
        <span className="tabular-nums">{likes}</span>
      </button>
      <button
        type="button"
        onClick={() => void toggle('bookmark')}
        disabled={busy}
        aria-pressed={bookmarked}
        aria-label="В закладки"
        className={cn('btn-ghost w-9 h-9 !p-0', bookmarked && 'text-primary')}
      >
        <Bookmark size={15} className={cn(bookmarked && 'fill-current')} />
      </button>
    </div>
  );
}
