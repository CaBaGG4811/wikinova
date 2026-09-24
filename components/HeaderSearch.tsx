'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
    >
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск статей"
        className="input !w-44 !py-1.5 !pl-8 text-sm focus:!w-60 transition-[width] duration-200"
        aria-label="Поиск"
      />
    </form>
  );
}
