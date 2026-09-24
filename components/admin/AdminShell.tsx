'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import {
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
  Inbox,
  Folder,
  Hash,
  Users,
  Settings,
  SlidersHorizontal,
  ScrollText,
  Gauge,
  Terminal,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastProvider } from '@/components/admin/ToastProvider';
import type { Role } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
}

const mainNav: NavItem[] = [
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/admin/articles', label: 'Статьи', icon: FileText },
  { href: '/admin/media', label: 'Медиа', icon: ImageIcon },
  { href: '/admin/requests', label: 'Заявки', icon: Inbox },
  { href: '/admin/categories', label: 'Категории', icon: Folder },
  { href: '/admin/tags', label: 'Теги', icon: Hash },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/settings', label: 'Настройки', icon: Settings },
];

const aiNav: NavItem[] = [
  { href: '/admin/ai/settings', label: 'Настройки AI', icon: SlidersHorizontal },
  { href: '/admin/ai/prompts', label: 'Промты', icon: ScrollText },
  { href: '/admin/ai/usage', label: 'Использование', icon: Gauge },
  { href: '/admin/ai/logs', label: 'Логи', icon: Terminal },
];

const roleLabel: Record<Role, string> = {
  ADMIN: 'Администратор',
  EDITOR: 'Редактор',
  USER: 'Читатель',
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: Role;
  onNavigate?: () => void;
}) {
  const items = mainNav.filter((n) => n.href !== '/admin/users' || role === 'ADMIN');
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                  active
                    ? 'bg-ink/8 text-ink font-medium'
                    : 'text-muted hover:text-ink hover:bg-ink/5',
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div>
        <div className="px-3 mb-1.5 text-xs font-medium text-muted/80">AI-раздел</div>
        <ul className="space-y-1">
          {aiNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    active
                      ? 'bg-ink/8 text-ink font-medium'
                      : 'text-muted hover:text-ink hover:bg-ink/5',
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

interface AdminShellProps {
  role: Role;
  name: string;
  email: string;
  children: React.ReactNode;
}

export default function AdminShell({ role, name, email, children }: AdminShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SessionProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col border-r border-line bg-surface overflow-y-auto">
            <div className="h-14 flex items-center px-5 border-b border-line shrink-0">
              <Link href="/admin" className="font-display font-bold text-lg tracking-tight inline-flex items-center gap-2">
                <img src="/logo.png" alt="WikiNova" className="h-8 w-auto dark:drop-shadow-[0_1px_3px_rgba(245,245,244,0.3)]" />
                <span className="text-xs font-normal text-muted">админка</span>
              </Link>
            </div>
            <NavList pathname={pathname} role={role} />
            <div className="border-t border-line px-3 py-3 space-y-1">
              <div className="px-2 py-1.5">
                <div className="text-sm font-medium text-ink truncate">{name}</div>
                <div className="text-xs text-muted">{roleLabel[role]}</div>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150"
              >
                <ExternalLink size={16} />
                На сайт
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/admin/login' })}
                className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:text-danger hover:bg-ink/5 transition-colors duration-150"
              >
                <LogOut size={16} />
                Выйти
              </button>
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between gap-3 border-b border-line bg-surface px-4">
              <Link href="/admin" className="font-display font-bold text-lg tracking-tight inline-flex items-center">
                <img src="/logo.png" alt="WikiNova" className="h-8 w-auto dark:drop-shadow-[0_1px_3px_rgba(245,245,244,0.3)]" />
              </Link>
              <div className="flex items-center gap-1">
                <Link href="/" className="btn-ghost !px-2.5" aria-label="На сайт">
                  <ExternalLink size={18} />
                </Link>
                <button
                  type="button"
                  className="btn-ghost !px-2.5"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Открыть меню"
                >
                  <Menu size={20} />
                </button>
              </div>
            </header>

            <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
          </div>

          {menuOpen ? (
            <div className="md:hidden fixed inset-0 z-50 flex">
              <div
                className="absolute inset-0 bg-ink/40"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="relative w-64 max-w-[80vw] bg-surface border-r border-line flex flex-col">
                <div className="h-14 flex items-center justify-between px-4 border-b border-line">
                <img src="/logo.png" alt="WikiNova" className="h-8 w-auto dark:drop-shadow-[0_1px_3px_rgba(245,245,244,0.3)]" />
                  <button
                    type="button"
                    className="btn-ghost !px-2"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Закрыть меню"
                  >
                    <X size={18} />
                  </button>
                </div>
                <NavList
                  pathname={pathname}
                  role={role}
                  onNavigate={() => setMenuOpen(false)}
                />
                <div className="border-t border-line px-3 py-3 space-y-1">
                  <div className="px-2 py-1.5">
                    <div className="text-sm font-medium text-ink truncate">{email}</div>
                    <div className="text-xs text-muted">{roleLabel[role]}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/admin/login' })}
                    className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted hover:text-danger hover:bg-ink/5"
                  >
                    <LogOut size={16} />
                    Выййти
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
