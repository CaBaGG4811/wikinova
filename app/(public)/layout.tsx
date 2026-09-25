import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthModalProvider } from '@/components/auth/AuthModal';
import { AssistantDock } from '@/components/ai/AssistantDock';
import { Providers } from '@/components/Providers';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const blocks = await getBlocks(['footer.copyright', 'footer.tagline']);

  return (
    <Providers>
      <AuthModalProvider>
        <div className="flex min-h-screen flex-col bg-white pl-16">
          <Sidebar />
          <main className="flex-1">{children}</main>
          <footer className="mt-16 border-t border-line">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-3">
              <div>
                <div className="font-display font-semibold text-ink mb-2">WikiNova</div>
                <p>
                  <EditableBlock
                    blockKey="footer.tagline"
                    as="span"
                    defaultValue={blocks['footer.tagline']}
                  />
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Link href="/articles" className="hover:text-ink">Каталог статей</Link>
                <Link href="/collections" className="hover:text-ink">Коллекции</Link>
                <Link href="/graph" className="hover:text-ink">Карта знаний</Link>
                <Link href="/request" className="hover:text-ink">Заявка на статью</Link>
                <Link href="/contact" className="hover:text-ink">Контакты</Link>
              </div>
              <div className="flex flex-col gap-1.5">
                <Link href="/about" className="hover:text-ink">О проекте</Link>
                <Link href="/rules" className="hover:text-ink">Правила редактирования</Link>
                <span className="font-mono text-xs">
                  <EditableBlock
                    blockKey="footer.copyright"
                    as="span"
                    defaultValue={blocks['footer.copyright']}
                  />
                </span>
              </div>
            </div>
          </footer>
          <AssistantDock />
        </div>
      </AuthModalProvider>
    </Providers>
  );
}
