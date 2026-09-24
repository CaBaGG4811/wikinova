'use client';

import { useState } from 'react';
import { Check, Link2, Send } from 'lucide-react';

export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(
    typeof window !== 'undefined' ? window.location.href : '',
  )}&text=${encodeURIComponent(title)}`;

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => void copyLink()} className="btn-ghost !py-1.5 !px-2.5 text-sm">
        {copied ? <Check size={15} className="text-ok" /> : <Link2 size={15} />}
        <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Скопировать ссылку'}</span>
      </button>
      <a
        href={telegramHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost !py-1.5 !px-2.5 text-sm"
      >
        <Send size={15} />
        <span className="hidden sm:inline">Telegram</span>
      </a>
    </div>
  );
}
