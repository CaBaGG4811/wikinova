import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { Breadcrumbs } from '@/components/article/Breadcrumbs';
import { ContactForm } from '@/components/ContactForm';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Контакты',
  description: 'Связаться с редакцией WikiNova.',
};

export default async function ContactPage() {
  const blocks = await getBlocks(['contact.title', 'contact.body', 'contact.email']);
  const email = blocks['contact.email'] || 'hello@wikinova.local';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs items={[{ label: 'Главная', href: '/' }, { label: 'Контакты' }]} />

      <div className="max-w-[68ch]">
        <h1 className="font-display mb-6 text-h2 font-bold">
          <EditableBlock
            blockKey="contact.title"
            as="span"
            defaultValue={blocks['contact.title']}
          />
        </h1>

        <EditableBlock
          blockKey="contact.body"
          as="p"
          className="text-body leading-relaxed"
          multiline
          defaultValue={blocks['contact.body']}
        />

        <a
          href={`mailto:${email}`}
          className="btn-secondary mt-6 inline-flex"
        >
          <Mail size={15} />
          <EditableBlock
            blockKey="contact.email"
            as="span"
            defaultValue={email}
          />
        </a>

        <div className="mt-8 space-y-3 text-caption text-muted">
          <p>Форма ниже работает как заглушка: она не отправляет письма и не сохраняет данные.</p>
          <p>Время ответа: обычно несколько дней, заявки на статьи разбираются в порядке очереди.</p>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
