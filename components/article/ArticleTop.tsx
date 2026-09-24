'use client';

import { useState } from 'react';
import { ArticleAiActions } from '@/components/ai/ArticleAiActions';
import { SummaryPanel } from '@/components/ai/SummaryPanel';

interface Props {
  articleId: string;
  children?: React.ReactNode;
}

export function ArticleTop({ articleId, children }: Props) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <ArticleAiActions
          articleId={articleId}
          summaryOpen={summaryOpen}
          onToggleSummary={() => setSummaryOpen((v) => !v)}
        />
        {children}
      </div>
      <SummaryPanel
        articleId={articleId}
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
      />
    </div>
  );
}
