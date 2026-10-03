'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { useAuthModal } from '@/components/auth/AuthModal';
import {
  GalileoAssistantIcon,
  GalileoBookIcon,
  GalileoCollectionsIcon,
  GalileoHomeIcon,
  GalileoUserIcon,
} from '@/components/layout/NavIcons';

const navItems = [
  { href: '/', label: 'Главная', icon: GalileoHomeIcon },
  { href: '/articles', label: 'Статьи', icon: GalileoBookIcon },
  { href: '/collections', label: 'Коллекции', icon: GalileoCollectionsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open } = useAuthModal();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col border-r border-line bg-white md:w-60"
      aria-label="Боковая навигация"
    >
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 px-4 transition-colors hover:bg-surface"
        aria-label="ГАЛИЛЕО — на главную"
      >
        <img
          src="/logo.png"
          alt=""
          className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_2px_10px_rgb(84_92_161/0.35)]"
        />
        <span className="font-display text-lg font-extrabold tracking-tight text-ink hidden md:inline">
          ГАЛИЛЕО
        </span>
      </Link>

      <nav className="mt-3 flex flex-col gap-1 px-2" aria-label="Основные разделы">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('galileo:assistant'))}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          aria-label="Открыть ассистента"
        >
          <GalileoAssistantIcon size={22} />
          <span className="hidden text-sm font-medium md:inline">Ассистент</span>
        </button>

        {navItems.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-primary-soft/70 text-primary shadow-[0_4px_16px_-8px_rgb(76_132_188/0.55)]'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={22} />
              <span className="hidden text-sm font-medium md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-2 pb-4">
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <GalileoUserIcon size={22} />
              <span className="hidden truncate text-sm font-medium md:inline">
                {session.user.name ?? session.user.email ?? 'Профиль'}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/' })}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="hidden text-sm font-medium md:inline">Выйти</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => open('login')}
            className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2.5 text-white shadow-[0_8px_20px_-8px_rgb(76_132_188/0.8)] transition hover:from-[#41719f] hover:to-[#4a5193]"
          >
            <GalileoUserIcon size={22} />
            <span className="hidden text-sm font-semibold md:inline">Войти</span>
          </button>
        )}
      </div>
    </aside>
  );
}
