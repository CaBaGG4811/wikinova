import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { RequestForm } from '@/components/RequestForm';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Заказать статью',
  description: 'Заявка редакции WikiNova на новую энциклопедическую статью.',
};

export default async function RequestPage() {
  const [categories, blocks] = await Promise.all([
    db.category.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true },
    }),
    getBlocks(['request.title', 'request.subtitle']),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Заказать статью' }]} />

      <div className="max-w-2xl">
        <h1 className="font-display mb-3 text-h2 font-bold">
          <EditableBlock
            blockKey="request.title"
            as="span"
            defaultValue={blocks['request.title']}
          />
        </h1>
        <EditableBlock
          blockKey="request.subtitle"
          as="p"
          className="mb-8 max-w-[68ch] text-body text-muted"
          multiline
          defaultValue={blocks['request.subtitle']}
        />

        <RequestForm categories={categories} />
      </div>
    </div>
  );
}
