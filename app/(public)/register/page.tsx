import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { from?: string; callbackUrl?: string };
}) {
  const from = searchParams?.from ?? searchParams?.callbackUrl;
  const next =
    from && from.startsWith('/') ? `/?auth=register&from=${encodeURIComponent(from)}` : '/?auth=register';
  redirect(next);
}
