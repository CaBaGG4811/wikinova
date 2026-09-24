import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { Clock, Eye, Pencil, Star } from 'lucide-react';
import { db } from '@/lib/db';
import { authOptions, hasRole } from '@/lib/auth';
import { buildTocWithIds, cardInclude, parseSources } from '@/lib/article';
import { formatDate } from '@/lib/utils';
import { designTokens } from '@/lib/design-tokens';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { ReadingProgress } from '@/components/article/ReadingProgress';
import { ArticleToc } from '@/components/article/ArticleToc';
import { ShareButtons } from '@/components/article/ShareButtons';
import { LikeBookmarkButtons } from '@/components/article/LikeBookmarkButtons';
import { ReportErrorButton } from '@/components/article/ReportErrorButton';
import { ArticleTop } from '@/components/article/ArticleTop';
import { AiRelated } from '@/components/article/AiRelated';
import { ArticleCard } from '@/components/article/ArticleCard';
import { RatingStars } from '@/components/article/RatingStars';
import { AddToCollectionButton } from '@/components/article/AddToCollectionButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
}

async function getArticle(slug: string) {
  return db.article.findUnique({ where: { slug }, include: cardInclude });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article || article.status !== 'published') return { title: 'Статья' };
  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
  };
}

export default async function ArticlePage({ params }: Props) {
  const [session, article] = await Promise.all([
    getServerSession(authOptions),
    getArticle(params.slug),
  ]);
  const isEditor = hasRole(session?.user?.role, 'EDITOR');
  if (!article || (article.status !== 'published' && !isEditor)) notFound();

  const userId = session?.user?.id;
  const [likeRow, bookmarkRow, ratingRow, ratingAgg] = userId
    ? await Promise.all([
        db.articleLike.findUnique({
          where: { userId_articleId: { userId, articleId: article.id } },
        }),
        db.bookmark.findUnique({
          where: { userId_articleId: { userId, articleId: article.id } },
        }),
        db.articleRating.findUnique({
          where: { articleId_userId: { userId, articleId: article.id } },
        }),
        db.articleRating.aggregate({
          where: { articleId: article.id },
          _avg: { value: true },
          _count: { value: true },
        }),
      ])
    : [
        null,
        null,
        null,
        await db.articleRating.aggregate({
          where: { articleId: article.id },
          _avg: { value: true },
          _count: { value: true },
        }),
      ];

  const ratingAvg = ratingAgg._avg.value ?? 0;
  const ratingCount = ratingAgg._count.value ?? 0;

  const { html: contentHtml, toc } = buildTocWithIds(article.content);
  const sources = parseSources(article.excerpt);

  const or: Prisma.ArticleWhereInput[] = [];
  if (article.categoryId) or.push({ categoryId: article.categoryId });
  const tagSlugs = article.tags.map((t) => t.tag.slug);
  if (tagSlugs.length > 0) or.push({ tags: { some: { tag: { slug: { in: tagSlugs } } } } });

  const similar =
    or.length > 0
      ? await db.article.findMany({
          where: { status: 'published', id: { not: article.id }, OR: or },
          include: cardInclude,
          orderBy: { views: 'desc' },
          take: 3,
        })
      : [];

  const crumbs = [
    { label: 'Главная', href: '/' },
    { label: 'Статьи', href: '/articles' },
    ...(article.category
      ? [{ label: article.category.name, href: `/category/${article.category.slug}` }]
      : []),
    { label: article.title },
  ];

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <ReadingProgress />
      <Breadcrumbs items={crumbs} />

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {article.category ? (
            <Link href={`/category/${article.category.slug}`} className="badge hover:border-ink/40 transition-colors duration-150">
              <span
                className="mr-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: article.category.color }}
              />
              {article.category.name}
            </Link>
          ) : null}
          {article.status !== 'published' ? (
            <span className="badge !border-accent/40 !text-accent">
              {article.status === 'draft' ? 'Черновик' : 'В архиве'}
            </span>
          ) : null}
          {article.featured ? <span className="badge !border-primary/40 !text-primary">Избранное</span> : null}
        </div>

        <h1 className="font-display max-w-[24ch] text-hero font-bold">{article.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted">
          <Link
            href={`/articles?author=${article.author.id}`}
            className="font-medium text-ink transition-colors duration-150 hover:text-primary"
          >
            {article.author.name}
          </Link>
          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Star size={13} className="text-accent" />
            <RatingStars
              articleId={article.id}
              average={ratingAvg}
              count={ratingCount}
              userValue={ratingRow?.value ?? null}
              canRate={Boolean(userId)}
            />
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} />
            {article.readingTime} мин чтения
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={13} />
            {article.views}
          </span>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <ArticleTop articleId={article.id}>
            <div className="flex-1" />
            <LikeBookmarkButtons
              articleId={article.id}
              likeCount={article._count.likes}
              initialLiked={likeRow !== null}
              initialBookmarked={bookmarkRow !== null}
            />
            {userId ? <AddToCollectionButton articleId={article.id} /> : null}
            <ShareButtons title={article.title} />
            {isEditor ? (
              <Link href={`/admin/articles/${article.id}/edit`} className="btn-ghost !py-1.5 !px-2.5 text-sm">
                <Pencil size={15} />
                Редактировать
              </Link>
            ) : null}
          </ArticleTop>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          {article.coverImage ? (
            <img
              src={article.coverImage}
              alt=""
              className="mb-8 aspect-[21/9] w-full rounded-lg border border-line object-cover"
            />
          ) : null}

          <div className="prose-wiki" style={{ maxWidth: designTokens.readingColumn }} dangerouslySetInnerHTML={{ __html: contentHtml }} />

          {sources.length > 0 ? (
            <section className="mt-10 border-t border-line pt-6" style={{ maxWidth: designTokens.readingColumn }}>
              <h2 className="font-display mb-3 text-h3 font-semibold">Источники</h2>
              <ul className="list-disc space-y-2 pl-5 text-caption text-muted">
                {sources.map((src, i) => (
                  <li key={`${i}-${src.slice(0, 24)}`}>
                    {/^https?:\/\//.test(src) ? (
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 transition-colors duration-150 hover:text-accent"
                      >
                        {src}
                      </a>
                    ) : (
                      src
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <AiRelated articleId={article.id} />

          {similar.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display mb-4 text-h3 font-semibold">Похожие статьи</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {similar.map((a, i) => (
                  <div
                    key={a.id}
                    className="stagger-item"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <ArticleCard article={a} variant="compact" />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            <p className="text-caption text-muted">
              Заметили ошибку? Сообщите, редакция проверит и поправит.
            </p>
            <ReportErrorButton articleTitle={article.title} />
          </div>
        </div>

        <ArticleToc items={toc} />
      </div>
    </article>
  );
}
