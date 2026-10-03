'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useAuthModal } from '@/components/auth/AuthModal';

export function TopLogin() {
  const { data: session } = useSession();
  const { open } = useAuthModal();

  if (session?.user) {
    return (
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-full border border-line bg-white/90 px-4 py-1.5 text-sm font-semibold text-ink shadow-sm backdrop-blur transition hover:border-accent/40 hover:text-accent"
      >
        {session.user.name ?? session.user.email ?? 'Профиль'}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open('login')}
      className="rounded-full border border-line bg-white/90 px-5 py-1.5 text-sm font-bold text-ink shadow-sm backdrop-blur transition hover:border-accent/40 hover:text-accent"
    >
      Войти
    </button>
  );
}
