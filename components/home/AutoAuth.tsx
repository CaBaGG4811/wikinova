'use client';

import { useEffect } from 'react';
import { useAuthModal } from '@/components/auth/AuthModal';

export function AutoAuth({ mode }: { mode?: string }) {
  const { open } = useAuthModal();

  useEffect(() => {
    if (mode === 'login' || mode === 'register') open(mode);
  }, [mode, open]);

  return null;
}
