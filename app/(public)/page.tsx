import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { cardInclude } from '@/lib/article';
import { getBlocks } from '@/lib/blocks';
import { ArticleCard } from '@/components/article/ArticleCard';
import { HeroSearch } from '@/components/HeroSearch';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Главная',
  description: 'Локальная энциклопедия WikiNova: статьи по науке, истории, технологиям и искусству.',
};

export default async function HomePage() {
  const [featured, fresh, categories, blocks] = await Promise.all([
    db.article.findMany({
      where: { status: 'published', featured: true },
      include: cardInclude,
      orderBy: { views: 'desc' },
      take: 3,
    }),
    db.article.findMany({
      where: { status: 'published' },
      include: cardInclude,
      orderBy: { publishedAt: 'desc' },
      take: 9,
    }),
    db.category.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { articles: { _count: 'desc' } },
      take: 8,
    }),
    getBlocks([
      'home.hero.title',
      'home.hero.subtitle',
      'home.featured.title',
      'home.fresh.title',
      'home.categories.title',
      'home.request.cta',
    ]),
  ]);

  const heroIds = new Set(featured.map((a) => a.id));
  const heroCards = [...featured];
  for (const a of fresh) {
    if (heroCards.length >= 3) break;
    if (!heroIds.has(a.id)) {
      heroCards.push(a);
      heroIds.add(a.id);
    }
  }
  const freshList = fresh.filter((a) => !heroIds.has(a.id)).slice(0, 6);

  return (
    <div>
      <section className="stagger-item" style={{ animationDelay: '0ms' }}>
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14">
          <p className="mb-3 text-caption font-medium text-primary">Локальная энциклопедия</p>
          <h1 className="font-display max-w-[15ch] text-hero font-bold">
            <EditableBlock
              blockKey="home.hero.title"
              as="span"
              defaultValue={blocks['home.hero.title']}
            />
          </h1>
          <EditableBlock
            blockKey="home.hero.subtitle"
            as="p"
            className="mt-4 max-w-[54ch] text-body text-muted"
            multiline
            defaultValue={blocks['home.hero.subtitle']}
          />
          <div className="mt-8 max-w-2xl">
            <HeroSearch />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-h2 font-bold">
            <EditableBlock
              blockKey="home.featured.title"
              as="span"
              defaultValue={blocks['home.featured.title']}
            />
          </h2>
          <Link
            href="/articles"
            className="text-caption font-medium text-primary transition-colors duration-150 hover:text-accent"
          >
            Весь каталог
          </Link>
        </div>
        {heroCards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line py-10 text-center text-caption text-muted">
            Статей пока нет
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ArticleCard article={heroCards[0]} priority stretch />
            </div>
            <div className="flex flex-col gap-5">
              {heroCards.slice(1, 3).map((a) => (
                <div key={a.id} className="flex-1">
                  <ArticleCard article={a} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {freshList.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-h2 font-bold">
              <EditableBlock
                blockKey="home.fresh.title"
                as="span"
                defaultValue={blocks['home.fresh.title']}
              />
            </h2>
            <Link
              href="/articles?sort=new"
              className="text-caption font-medium text-primary transition-colors duration-150 hover:text-accent"
            >
              Все новые
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {freshList.map((a, i) => (
              <div key={a.id} className="stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
                <ArticleCard article={a} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="font-display mb-6 text-h2 font-bold">
          <EditableBlock
            blockKey="home.categories.title"
            as="span"
            defaultValue={blocks['home.categories.title']}
          />
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="card p-4 transition-colors duration-150 hover:border-ink/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display flex items-center gap-2 font-semibold">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
                <span className="badge">{c._count.articles}</span>
              </div>
              {c.description ? (
                <p className="mt-1.5 line-clamp-2 text-caption text-muted">{c.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="font-display text-h3 font-semibold">
              <EditableBlock
                blockKey="home.request.cta"
                as="span"
                defaultValue={blocks['home.request.cta']}
              />
            </h2>
            <p className="mt-1 text-caption text-muted">
              Опишите тему и уровень детализации, редакция подготовит материал.
            </p>
          </div>
          <Link href="/request" className="btn-primary shrink-0">
            Оставить заявку
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
