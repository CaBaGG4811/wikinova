import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

function safeFrom(from: string | undefined): string {
  if (from && from.startsWith('/') && !from.startsWith('//')) return from;
  return '/admin';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect(safeFrom(searchParams.from));

  return <LoginForm from={safeFrom(searchParams.from)} />;
}
