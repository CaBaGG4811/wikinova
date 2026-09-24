'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const primaryNav = [
  { href: '/articles', label: 'Статьи' },
  { href: '/collections', label: 'Коллекции' },
  { href: '/graph', label: 'Карта знаний' },
  { href: '/request', label: 'Заказать статью' },
];

const secondaryNav = [
  { href: '/about', label: 'О проекте' },
  { href: '/rules', label: 'Правила' },
];

const allNav = [...primaryNav, ...secondaryNav];

const linkClass =
  'px-2.5 py-1.5 rounded-md text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150 whitespace-nowrap';

export function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav className="hidden lg:flex items-center gap-1 text-sm" aria-label="Основная навигация">
        {primaryNav.map((n) => (
          <Link key={n.href} href={n.href} className={linkClass}>
            {n.label}
          </Link>
        ))}
        {secondaryNav.map((n) => (
          <Link key={n.href} href={n.href} className={`${linkClass} hidden xl:inline-flex`}>
            {n.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="lg:hidden btn-ghost w-9 h-9 !p-0 shrink-0"
        aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.nav
            id="mobile-nav"
            ref={ref}
            key="mobile-nav"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="lg:hidden absolute left-0 right-0 top-full overflow-hidden border-b border-line bg-bg shadow-md"
            aria-label="Мобильная навигация"
          >
            <div className="flex flex-col px-4 py-2">
              {allNav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-3 py-3 text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150 whitespace-nowrap"
                  onClick={() => setOpen(false)}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
