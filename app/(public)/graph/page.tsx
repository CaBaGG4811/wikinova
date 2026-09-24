import type { Metadata } from 'next';
import { buildKnowledgeGraph, graphCategories } from '@/lib/graph';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { GraphCanvas } from '@/components/graph/GraphCanvas';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Карта знаний',
  description: 'Интерактивная карта связей между статьями WikiNova.',
};

export default async function GraphPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const category = typeof searchParams.category === 'string' ? searchParams.category : '';
  const [data, categories] = await Promise.all([
    buildKnowledgeGraph(category || undefined),
    graphCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Карта знаний' }]} />

      <header className="mb-6">
        <h1 className="font-display text-h2 font-bold">Карта знаний</h1>
        <p className="mt-1 text-caption text-muted">
          Связи между опубликованными статьями: общие теги, категория и совпадения в тексте.
        </p>
      </header>

      {data.nodes.length === 0 ? (
        <div className="card p-6 text-sm text-muted">
          {category
            ? 'В этой категории пока нет опубликованных статей.'
            : 'Пока недостаточно опубликованных статей для карты.'}
        </div>
      ) : (
        <GraphCanvas data={data} categories={categories} activeCategory={category} />
      )}
    </div>
  );
}
