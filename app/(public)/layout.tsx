import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeaderSearch } from '@/components/HeaderSearch';
import { HeaderNav } from '@/components/HeaderNav';
import { AssistantDock } from '@/components/ai/AssistantDock';
import { Providers } from '@/components/Providers';
import { UserMenu } from '@/components/UserMenu';
import { getBlocks } from '@/lib/blocks';
import { EditableBlock } from '@/components/admin/EditableBlock';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const blocks = await getBlocks(['footer.copyright', 'footer.tagline']);

  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-[2px]">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3 md:gap-4 xl:gap-6 relative">
            <Link
              href="/"
              className="font-display font-bold text-lg tracking-tight shrink-0 whitespace-nowrap"
            >
              Wiki<span className="text-primary">Nova</span>
            </Link>
            <HeaderNav />
            <div className="flex-1" />
            <HeaderSearch />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line mt-16">
          <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm text-muted">
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
    </Providers>
  );
}
