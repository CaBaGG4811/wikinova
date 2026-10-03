'use client';

import { usePathname } from 'next/navigation';

export function SiteFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <footer className="mt-16 border-t border-line">{children}</footer>;
}
