'use client';

import { useSession } from 'next-auth/react';

export function useIsEditor() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isEditor = role === 'ADMIN' || role === 'EDITOR';
  return { isEditor, isLoading: status === 'loading' };
}
