import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ArticleEditor from '@/components/admin/ArticleEditor';

export default async function NewArticlePage() {
  const session = await getServerSession(authOptions);
  return <ArticleEditor initial={null} isAdmin={session?.user.role === 'ADMIN'} />;
}
