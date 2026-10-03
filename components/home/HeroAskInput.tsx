'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Mic } from 'lucide-react';

export function HeroAskInput() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [searchMode, setSearchMode] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    if (searchMode) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      return;
    }
    window.dispatchEvent(new CustomEvent('galileo:assistant', { detail: { question: query } }));
  }

  return (
    <form onSubmit={submit} role="search" className="w-full max-w-2xl mx-auto">
      <div className="mb-3 flex items-center gap-2.5 pl-1">
        <button
          type="button"
          role="switch"
          aria-checked={searchMode}
          aria-label="Поиск по статьям"
          onClick={() => setSearchMode((v) => !v)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
            searchMode ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
              searchMode ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-muted">Поиск по статьям</span>
      </div>

      <div className="flex flex-col rounded-2xl border border-accent/50 bg-white px-5 pb-3 pt-4 shadow-[0_18px_46px_-24px_rgb(84_92_161/0.45),0_2px_6px_rgb(4_36_64/0.05)] transition-all duration-200 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.form;
              if (form) form.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Напишите вопрос или используйте голосовой ввод"
          aria-label="Задайте вопрос"
          autoComplete="off"
          className="min-h-[64px] w-full resize-none bg-transparent text-lg leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            aria-label="Голосовой ввод"
            title="Голосовой ввод скоро заработает"
            className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            aria-label="Спросить"
            className="rounded-lg bg-gradient-to-r from-primary to-accent p-2 text-white shadow-[0_8px_20px_-8px_rgb(76_132_188/0.7)] transition hover:from-[#41719f] hover:to-[#4a5193]"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </form>
  );
}
