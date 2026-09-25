'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { BookOpen, Home, Library, LogOut, Network, User } from 'lucide-react';
import { useAuthModal } from '@/components/auth/AuthModal';

const navItems = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/articles', label: 'Статьи', icon: BookOpen },
  { href: '/collections', label: 'Коллекции', icon: Library },
  { href: '/graph', label: 'Карта знаний', icon: Network },
];

const labelClass =
  'text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open } = useAuthModal();

  return (
    <aside
      className="group fixed inset-y-0 left-0 z-50 flex w-16 flex-col overflow-hidden whitespace-nowrap border-r border-line bg-white transition-all duration-300 ease-in-out hover:w-60"
      aria-label="Боковая навигация"
    >
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-3 px-4 transition-colors hover:bg-gray-50"
        aria-label="WikiNova — на главную"
      >
        <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
        <span className="font-display text-lg font-extrabold tracking-tight text-gray-900 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          WikiNova
        </span>
      </Link>

      <nav className="mt-3 flex flex-col gap-1 px-2" aria-label="Основные разделы">
        {navItems.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group/item flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span className={labelClass}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-2 pb-4">
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="group/item flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <User size={20} className="shrink-0" />
              <span className={labelClass}>
                {session.user.name ?? session.user.email ?? 'Профиль'}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/' })}
              className="group/item flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600"
            >
              <LogOut size={20} className="shrink-0" />
              <span className={labelClass}>Выйти</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => open('login')}
            className="group/item flex items-center gap-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-3 py-2.5 text-white shadow-sm transition hover:from-green-700 hover:to-emerald-700"
          >
            <User size={20} className="shrink-0" />
            <span className={labelClass}>Войти</span>
          </button>
        )}
      </div>
    </aside>
  );
}
