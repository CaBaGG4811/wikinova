'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function ProfileSignOut() {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => void signOut({ callbackUrl: '/' })}
    >
      <LogOut size={15} />
      Выйти
    </button>
  );
}
