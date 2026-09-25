import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string; callbackUrl?: string };
}) {
  const from = searchParams?.from ?? searchParams?.callbackUrl;
  const next = from && from.startsWith('/') ? `/?auth=login&from=${encodeURIComponent(from)}` : '/?auth=login';
  redirect(next);
}
