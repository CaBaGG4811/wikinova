'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import {
  GalileoAssistantIcon,
  GalileoBookIcon,
  GalileoCollectionsIcon,
  GalileoUserIcon,
} from '@/components/layout/NavIcons';

const navItems = [
  { href: '/articles', label: 'Р­РЅС†РёРєР»РѕРїРµРґРёСЏ', icon: GalileoBookIcon },
  { href: '/collections', label: 'РљРѕР»Р»РµРєС†РёРё', icon: GalileoCollectionsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col border-r border-line bg-white md:w-60"
      aria-label="Р‘РѕРєРѕРІР°СЏ РЅР°РІРёРіР°С†РёСЏ"
    >
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2.5 px-4 transition-colors hover:bg-surface"
        aria-label="Р“РђР›РР›Р•Рћ вЂ” Р°СЃСЃРёСЃС‚РµРЅС‚"
      >
        <span className="font-display text-xl font-extrabold tracking-tight text-ink">
          <span className="md:hidden">Р“</span>
          <span className="hidden md:inline">Р“РђР›РР›Р•Рћ</span>
        </span>
      </Link>

      <nav className="mt-3 flex flex-col gap-1 px-2" aria-label="РћСЃРЅРѕРІРЅС‹Рµ СЂР°Р·РґРµР»С‹">
        <Link
          href="/"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
            pathname === '/'
              ? 'bg-primary-soft/70 text-primary'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <GalileoAssistantIcon size={22} />
          <span className="hidden text-sm font-medium md:inline">РђСЃСЃРёСЃС‚РµРЅС‚</span>
        </Link>

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
                  ? 'bg-primary-soft/70 text-primary'
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
                {session.user.name ?? session.user.email ?? 'РџСЂРѕС„РёР»СЊ'}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: '/' })}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600"
            >
              <LogOut size={20} className="shrink-0" />
              <span className="hidden text-sm font-medium md:inline">Р’С‹Р№С‚Рё</span>
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
