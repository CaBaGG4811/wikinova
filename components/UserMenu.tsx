'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ChevronDown, LogOut, User } from 'lucide-react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (status === 'loading') {
    return <span className="hidden sm:inline-block w-24 h-8 rounded-md bg-ink/5" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost !py-1.5 text-sm">
          Войти
        </Link>
        <Link href="/register" className="btn-primary !py-1.5 text-sm">
          Регистрация
        </Link>
      </div>
    );
  }

  const role = session.user.role;
  const name = session.user.name ?? session.user.email ?? 'Пользователь';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost !py-1.5 !px-2.5 text-sm flex items-center gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={15} />
        <span className="max-w-[12ch] truncate">{name}</span>
        <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 w-52 card rounded-xl p-1.5 z-50 shadow-md">
          <button
            type="button"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150"
            onClick={() => {
              setOpen(false);
              router.push('/profile');
            }}
          >
            Профиль
          </button>
          {role === 'ADMIN' || role === 'EDITOR' ? (
            <button
              type="button"
              className="w-full text-left rounded-md px-3 py-2 text-sm text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-150"
              onClick={() => {
                setOpen(false);
                router.push('/admin');
              }}
            >
              Админка
            </button>
          ) : null}
          <button
            type="button"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-muted hover:text-danger hover:bg-ink/5 transition-colors duration-150 flex items-center gap-2"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: '/' });
            }}
          >
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}
