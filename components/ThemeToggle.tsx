'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('wn-theme', next ? 'dark' : 'light');
    } catch {}
  }

  if (!mounted) return <button className="btn-ghost w-9 h-9 !p-0" aria-label="Тема" />;

  return (
    <button onClick={toggle} className="btn-ghost w-9 h-9 !p-0" aria-label="Переключить тему">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
