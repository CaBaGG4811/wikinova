import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <>{children}</>;

  return (
    <AdminShell
      role={session.user.role}
      name={session.user.name ?? session.user.email ?? 'Пользователь'}
      email={session.user.email ?? ''}
    >
      {children}
    </AdminShell>
  );
}
