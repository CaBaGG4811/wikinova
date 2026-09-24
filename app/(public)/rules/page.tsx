import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Правила редактирования',
  description: 'Правила WikiNova: тон, источники, статусы, конфликты правок.',
};

export default async function RulesPage() {
  const blocks = await getBlocks(['rules.title', 'rules.body']);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Правила' }]} />

      <div className="max-w-[68ch]">
        <h1 className="font-display mb-6 text-h2 font-bold">
          <EditableBlock
            blockKey="rules.title"
            as="span"
            defaultValue={blocks['rules.title']}
          />
        </h1>

        <div className="space-y-6 text-body leading-relaxed">
          <EditableBlock
            blockKey="rules.body"
            as="p"
            multiline
            defaultValue={blocks['rules.body']}
          />

          <h2 className="font-display mt-10 text-h3 font-semibold">Тон и язык</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Нейтральный изложительный стиль, без рекламных оборотов и лозунгов.</li>
            <li>Факты отделяются от оценок, оценки подписываются источником.</li>
            <li>Заголовки разделов короткие и описательные, без кликбейта.</li>
          </ul>

          <h2 className="font-display mt-10 text-h3 font-semibold">Источники</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Контроверсийные утверждения опираются на проверяемые источники.</li>
            <li>Ссылки на первоисточники предпочтительнее пересказов.</li>
            <li>Без источника остаются только общеизвестные факты и описания терминов.</li>
          </ul>

          <h2 className="font-display mt-10 text-h3 font-semibold">Статусы статей</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Черновик</strong> виден только редакции, в поиск выдаётся после публикации.
            </li>
            <li>
              <strong>Опубликована</strong> доступна всем, попадает в каталог и в выдачу поиска.
            </li>
            <li>
              <strong>В архиве</strong> убирается из общей ленты, но остаётся по прямой ссылке.
            </li>
          </ul>

          <h2 className="font-display mt-10 text-h3 font-semibold">Конфликты правок</h2>
          <p>
            История версий хранит каждую сохранённую редакцию. При споре редакторы возвращаются
            к предыдущей версии и обсуждают изменение в заявке, а не в тексте статьи.
          </p>

          <h2 className="font-display mt-10 text-h3 font-semibold">Заявки и ошибки</h2>
          <p>
            Ошибки в опубликованной статье можно отправить кнопкой «Сообщить об ошибке» внизу
            материала. Новые темы оформляются через{' '}
            <Link
              href="/request"
              className="text-primary underline underline-offset-2 transition-colors duration-150 hover:text-accent"
            >
              форму заявки
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
