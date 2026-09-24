import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'О проекте',
  description: 'Как устроена WikiNova: роли, редакционный процесс, принципы материалов.',
};

export default async function AboutPage() {
  const blocks = await getBlocks(['about.title', 'about.body']);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'О проекте' }]} />

      <div className="max-w-[68ch]">
        <h1 className="font-display mb-6 text-h2 font-bold">
          <EditableBlock
            blockKey="about.title"
            as="span"
            defaultValue={blocks['about.title']}
          />
        </h1>

        <div className="space-y-6 text-body leading-relaxed">
          <EditableBlock
            blockKey="about.body"
            as="p"
            multiline
            defaultValue={blocks['about.body']}
          />

          <h2 className="font-display mt-10 text-h3 font-semibold">Что здесь лежит</h2>
          <p>
            Статьи разложены по категориям: наука, технологии, история, искусство, философия,
            медицина, космос и природа. Внутри статьи есть оглавление, источники и блок с
            похожими материалами, чтобы читатель не упирался в тупик.
          </p>

          <h2 className="font-display mt-10 text-h3 font-semibold">Роли</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Читатель</strong> ищет, читает, ставит лайки и закладки, заказывает
              недостающие статьи.
            </li>
            <li>
              <strong>Редактор</strong> пишет и правит статьи, ведёт категории и теги, разбирает
              заявки.
            </li>
            <li>
              <strong>Администратор</strong> управляет пользователями, настройками и удаляет
              материалы.
            </li>
          </ul>

          <h2 className="font-display mt-10 text-h3 font-semibold">Как предлагать темы</h2>
          <p>
            Если статьи нет, откройте <Link href="/request" className="text-primary underline underline-offset-2 hover:text-accent transition-colors duration-150">форму заявки</Link>,
            опишите тему, желаемый уровень детализации и способ связи. Заявка получает статус и
            не теряется в переписке.
          </p>

          <h2 className="font-display mt-10 text-h3 font-semibold">Помощник для чтения</h2>
          <p>
            Рядом со статьёй работает локальная модель: краткий пересказ, вопрос по тексту,
            перевод и проверка утверждений. Она не заменяет источники, а помогает освоить
            длинный материал быстрее.
          </p>
        </div>
      </div>
    </div>
  );
}
