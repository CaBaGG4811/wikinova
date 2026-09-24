import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import ArticleEditor from '@/components/admin/ArticleEditor';
import type { ArticleStatus } from '@/types';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const [article, session] = await Promise.all([
    db.article.findUnique({
      where: { id: params.id },
      include: { tags: { select: { tagId: true } } },
    }),
    getServerSession(authOptions),
  ]);
  if (!article) notFound();

  return (
    <ArticleEditor
      initial={{
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        coverImage: article.coverImage,
        status: article.status as ArticleStatus,
        featured: article.featured,
        categoryId: article.categoryId,
        tagIds: article.tags.map((t) => t.tagId),
        authorId: article.authorId,
        seoTitle: article.seoTitle ?? '',
        seoDescription: article.seoDescription ?? '',
        ogImage: article.ogImage ?? '',
      }}
      isAdmin={session?.user.role === 'ADMIN'}
    />
  );
}
