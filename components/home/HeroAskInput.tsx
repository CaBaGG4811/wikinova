'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mic, Search } from 'lucide-react';

export function HeroAskInput() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={submit} role="search" className="w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-[0_18px_46px_-20px_rgb(22_101_52/0.45),0_2px_6px_rgb(17_24_39/0.04)] transition-all duration-200 focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-100">
        <Search size={22} className="shrink-0 text-violet-600" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Задайте вопрос — найдём ответ в статьях"
          aria-label="Задайте вопрос"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-lg text-gray-900 outline-none placeholder:text-gray-400 focus:border-violet-500"
        />
        <button
          type="button"
          aria-label="Голосовой ввод"
          title="Голосовой ввод скоро заработает"
          className="shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
        >
          <Mic size={20} />
        </button>
        <button
          type="submit"
          aria-label="Спросить"
          className="shrink-0 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 p-2.5 text-white shadow-[0_8px_20px_-6px_rgb(22_101_52/0.7)] transition hover:from-green-700 hover:to-emerald-700"
        >
          <ArrowRight size={20} />
        </button>
      </div>
    </form>
  );
}
