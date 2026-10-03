import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopLogin } from '@/components/layout/TopLogin';
import { AuthModalProvider } from '@/components/auth/AuthModal';
import { Providers } from '@/components/Providers';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';
import { SiteFooter } from '@/components/layout/SiteFooter';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const blocks = await getBlocks(['footer.copyright', 'footer.tagline']);

  return (
    <Providers>
      <AuthModalProvider>
        <div className="flex min-h-screen flex-col bg-white pl-16 md:pl-60">
          <Sidebar />
          <div className="fixed right-6 top-4 z-40">
            <TopLogin />
          </div>
          <main className="flex-1">{children}</main>
          <SiteFooter>
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-3">
              <div>
                <div className="font-display font-semibold text-ink mb-2">ГАЛИЛЕО</div>
                <p>
                  <EditableBlock
                    blockKey="footer.tagline"
                    as="span"
                    defaultValue={blocks['footer.tagline']}
                  />
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Link href="/articles" className="hover:text-ink">Энциклопедия</Link>
                <Link href="/collections" className="hover:text-ink">Коллекции</Link>
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
          </SiteFooter>
        </div>
      </AuthModalProvider>
    </Providers>
  );
}
